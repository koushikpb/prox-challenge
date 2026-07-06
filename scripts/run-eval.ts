import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MODEL } from '@/agent/runtime';
import { parseEvent, type StreamEvent, type UserContentBlock } from '@/streaming';
import { applyRubric } from '@/evals/rubric';
import {
  entryQuestionImages,
  entryQuestionText,
  evalCaseSchema,
  type EvalCase,
} from '@/evals/types';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const CASES_PATH = path.join(REPO_ROOT, 'evals', 'cases.jsonl');
const FIXTURES_DIR = path.join(REPO_ROOT, 'evals', 'fixtures');
const REPORT_PATH = path.join(REPO_ROOT, 'evals', 'last-run.md');

const IMAGE_MEDIA_TYPES: Record<string, 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
const PORT = Number(process.env.PORT ?? '3000');
const HOST = '127.0.0.1';
const READY_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 120_000;

type RunRow = ReturnType<typeof applyRubric>;

function loadEntries(): EvalCase[] {
  const raw = readFileSync(CASES_PATH, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  const entries: EvalCase[] = [];
  for (const [i, line] of lines.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(`cases.jsonl line ${i + 1}: invalid JSON — ${(err as Error).message}`);
    }
    const result = evalCaseSchema.safeParse(parsed);
    if (!result.success) {
      const detail = result.error.issues
        .map((iss) => `${iss.path.join('.') || '(root)'}: ${iss.message}`)
        .join('; ');
      throw new Error(`cases.jsonl line ${i + 1}: schema rejected — ${detail}`);
    }
    entries.push(result.data);
  }
  return entries;
}

function probePort(port: number, host: string, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(timeoutMs, () => finish(false));
  });
}

async function waitForPort(port: number, host: string, deadlineMs: number): Promise<boolean> {
  const start = Date.now();
  let delay = 250;
  while (Date.now() - start < deadlineMs) {
    if (await probePort(port, host)) return true;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 2000);
  }
  return false;
}

type ServerHandle =
  | { kind: 'external' }
  | { kind: 'spawned'; child: ChildProcess };

async function ensureServer(): Promise<ServerHandle> {
  if (await probePort(PORT, HOST)) {
    console.log(`[eval] reusing dev server already on ${HOST}:${PORT}`);
    return { kind: 'external' };
  }
  console.log(`[eval] spawning \`npm run dev\` on port ${PORT} …`);
  const child = spawn('npm', ['run', 'dev'], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  child.stdout?.on('data', (buf: Buffer) => process.stdout.write(`[dev] ${buf}`));
  child.stderr?.on('data', (buf: Buffer) => process.stderr.write(`[dev] ${buf}`));
  child.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`[eval] dev server exited prematurely (code=${code}, signal=${signal})`);
    }
  });
  const ready = await waitForPort(PORT, HOST, READY_TIMEOUT_MS);
  if (!ready) {
    teardown({ kind: 'spawned', child });
    throw new Error(`Dev server did not bind to ${HOST}:${PORT} within ${READY_TIMEOUT_MS}ms`);
  }
  // Next dev binds the port before route handlers compile on first request, so
  // probe the chat route once to warm the compile and surface a clear error if
  // /api/chat is broken before we burn through 20 questions.
  await new Promise((r) => setTimeout(r, 500));
  return { kind: 'spawned', child };
}

function teardown(handle: ServerHandle): void {
  if (handle.kind !== 'spawned') return;
  const { child } = handle;
  if (child.exitCode !== null || child.killed) return;
  try {
    if (child.pid !== undefined) {
      process.kill(-child.pid, 'SIGTERM');
    } else {
      child.kill('SIGTERM');
    }
  } catch {
    // process group may already be gone
    try {
      child.kill('SIGTERM');
    } catch {
      /* noop */
    }
  }
}

function buildContent(entry: EvalCase): string | UserContentBlock[] {
  const images = entryQuestionImages(entry);
  const text = entryQuestionText(entry);
  if (images.length === 0) return text;
  const blocks: UserContentBlock[] = [{ type: 'text', text }];
  for (const rel of images) {
    const abs = path.join(FIXTURES_DIR, rel);
    const ext = path.extname(rel).toLowerCase();
    const media = IMAGE_MEDIA_TYPES[ext];
    if (!media) {
      throw new Error(`Unsupported image extension for fixture ${rel}`);
    }
    const data = readFileSync(abs).toString('base64');
    blocks.push({
      type: 'image',
      source: { type: 'base64', media_type: media, data },
    });
  }
  return blocks;
}

async function runEntry(entry: EvalCase): Promise<{ events: StreamEvent[]; row: RunRow }> {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`http://${HOST}:${PORT}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: buildContent(entry) }],
      }),
      signal: ac.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} for ${entry.id}: ${await res.text().catch(() => '(no body)')}`);
  }
  const events: StreamEvent[] = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  outer: while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const record = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const trimmed = record.trim();
      if (!trimmed) continue;
      const evt = parseEvent(trimmed + '\n\n');
      events.push(evt);
      if (evt.type === 'done') break outer;
    }
  }
  const row = applyRubric(events, entry);
  return { events, row };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function checkCell(ok: boolean): string {
  return ok ? '✓' : '✗';
}

function renderConsoleTable(rows: RunRow[]): void {
  console.log('');
  console.log('| ID  | Question                                                | facts | image | artifact | clar | safety | OVERALL |');
  console.log('| --- | ------------------------------------------------------- | ----- | ----- | -------- | ---- | ------ | ------- |');
  for (const r of rows) {
    const line = [
      r.id.padEnd(3),
      truncate(r.question, 55).padEnd(55),
      checkCell(r.results.facts).padEnd(5),
      checkCell(r.results.image).padEnd(5),
      checkCell(r.results.artifact).padEnd(8),
      checkCell(r.results.clarification).padEnd(4),
      checkCell(r.results.safety).padEnd(6),
      (r.overall ? 'PASS' : 'FAIL').padEnd(7),
    ].join(' | ');
    console.log(`| ${line} |`);
  }
}

const NOTES_MARKER = '<!-- investigation-notes:keep -->';

function renderMarkdown(rows: RunRow[], passCount: number, totalCount: number, model: string): string {
  const timestamp = new Date().toISOString();
  const lines: string[] = [];
  lines.push(`# Eval Suite — last run`);
  lines.push('');
  lines.push(`- Timestamp: \`${timestamp}\``);
  lines.push(`- Model: \`${model}\``);
  lines.push(`- Result: **${passCount} / ${totalCount} pass**`);
  lines.push('');
  lines.push('## Per-entry results');
  lines.push('');
  lines.push('| ID | Question | facts | image | artifact | clarification | safety | OVERALL |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of rows) {
    lines.push(
      `| ${r.id} | ${truncate(r.question, 80)} | ${checkCell(r.results.facts)} | ${checkCell(
        r.results.image,
      )} | ${checkCell(r.results.artifact)} | ${checkCell(r.results.clarification)} | ${checkCell(
        r.results.safety,
      )} | ${r.overall ? 'PASS' : 'FAIL'} |`,
    );
  }
  lines.push('');
  const failures = rows.filter((r) => !r.overall);
  if (failures.length === 0) {
    lines.push('## Failures');
    lines.push('');
    lines.push('_None — every entry passed every rubric check._');
  } else {
    lines.push('## Failures');
    lines.push('');
    for (const r of failures) {
      lines.push(`### ${r.id} — ${r.question}`);
      const failed = (Object.keys(r.results) as (keyof typeof r.results)[]).filter(
        (k) => !r.results[k],
      );
      lines.push(`- Failing checks: ${failed.join(', ')}`);
      if (r.missing_facts.length > 0) {
        lines.push(`- Missing facts: ${r.missing_facts.map((f) => `\`${f}\``).join(', ')}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n') + '\n';
}

// Anything below the NOTES_MARKER in a previous report is hand-written
// hypothesis text; preserve it verbatim across runs so investigation notes
// aren't wiped by a re-execution.
function preservedNotes(): string {
  if (!existsSync(REPORT_PATH)) return '';
  const prior = readFileSync(REPORT_PATH, 'utf8');
  const idx = prior.indexOf(NOTES_MARKER);
  if (idx === -1) return '';
  return prior.slice(idx);
}

function parseIdFilter(): Set<string> | null {
  const arg = process.argv.slice(2).find((a) => a.startsWith('--ids='));
  const env = process.env.EVAL_IDS;
  const raw = arg ? arg.slice('--ids='.length) : env;
  if (!raw) return null;
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return ids.length > 0 ? new Set(ids) : null;
}

async function main(): Promise<void> {
  if (!existsSync(CASES_PATH)) {
    console.error(`cases.jsonl not found at ${CASES_PATH}`);
    process.exit(2);
  }
  const allEntries = loadEntries();
  const idFilter = parseIdFilter();
  const entries = idFilter ? allEntries.filter((e) => idFilter.has(e.id)) : allEntries;
  if (idFilter) {
    const missing = [...idFilter].filter((id) => !allEntries.some((e) => e.id === id));
    if (missing.length > 0) {
      console.error(`[eval] unknown ids in --ids filter: ${missing.join(', ')}`);
      process.exit(2);
    }
    console.log(
      `[eval] filtered to ${entries.length} / ${allEntries.length} entries: ${entries.map((e) => e.id).join(', ')}`,
    );
  } else {
    console.log(`[eval] loaded ${entries.length} entries from evals/cases.jsonl`);
  }

  const server = await ensureServer();
  const cleanup = () => teardown(server);
  process.once('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });
  process.once('exit', cleanup);

  const rows: RunRow[] = [];
  try {
    for (const entry of entries) {
      process.stdout.write(`[eval] ${entry.id} … `);
      try {
        const { row } = await runEntry(entry);
        rows.push(row);
        console.log(row.overall ? 'PASS' : `FAIL (${Object.entries(row.results).filter(([, v]) => !v).map(([k]) => k).join(',')})`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`ERROR — ${message}`);
        rows.push({
          id: entry.id,
          question: entryQuestionText(entry),
          results: { facts: false, image: false, artifact: false, clarification: false, safety: false },
          missing_facts: entry.expected_facts,
          overall: false,
        });
      }
    }
  } finally {
    cleanup();
  }

  renderConsoleTable(rows);
  const passCount = rows.filter((r) => r.overall).length;
  if (idFilter) {
    console.log('');
    console.log(`[eval] ${passCount} / ${rows.length} pass (filtered run — report not written)`);
  } else {
    const notes = preservedNotes();
    const markdown = renderMarkdown(rows, passCount, rows.length, DEFAULT_MODEL) + notes;
    writeFileSync(REPORT_PATH, markdown, 'utf8');
    console.log('');
    console.log(`[eval] ${passCount} / ${rows.length} pass`);
    console.log(`[eval] report written to ${path.relative(REPO_ROOT, REPORT_PATH)}`);
  }
  process.exit(passCount === rows.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
