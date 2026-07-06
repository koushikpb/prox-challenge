import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ManualSource, StreamEvent } from '@/streaming';
import {
  CHECK_KEYS,
  type CheckKey,
  type EntryResult,
  type ExpectedArtifactKind,
  type GoldenEntry,
  entryQuestionText,
} from './types';

export type FactsCheck = { ok: boolean; missing: string[] };

export function checkExpectedFacts(streamText: string, facts: string[]): FactsCheck {
  const haystack = streamText.toLowerCase();
  const missing = facts.filter((fact) => !haystack.includes(fact.toLowerCase()));
  return { ok: missing.length === 0, missing };
}

// Citation events emitted by the agent runtime carry { source, page }. The
// rubric counts the answer as image-bearing when at least one such citation
// resolves to a real `data/pages/<source>-<NNN>.png` on disk — that file is
// what the UI surfaces. A pure predicate keeps the checker testable without
// touching the filesystem.
//
// Direction: the rubric only enforces presence when an image is expected.
// expects_image=false is a "don't care" — surfacing an extra image citation
// is not treated as a regression; reviewer judgment handles relevance.
export type PageExistsPredicate = (source: ManualSource, page: number) => boolean;

const RUBRIC_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(RUBRIC_DIR, '..');

export const defaultPageExists: PageExistsPredicate = (source, page) => {
  const padded = page.toString().padStart(3, '0');
  return existsSync(path.join(REPO_ROOT, 'data', 'pages', `${source}-${padded}.png`));
};

export function checkImage(
  events: StreamEvent[],
  expected: boolean,
  pageExists: PageExistsPredicate = defaultPageExists,
): boolean {
  if (!expected) return true;
  return events.some((e) => e.type === 'citation' && pageExists(e.source, e.page));
}

export function checkArtifact(
  events: StreamEvent[],
  expected: ExpectedArtifactKind | null,
  expectedProcess?: string,
): boolean {
  const artifactEvents = events.filter(
    (e): e is Extract<StreamEvent, { type: 'artifact' }> => e.type === 'artifact',
  );
  const artifactKinds = artifactEvents.map((e) => e.artifact.type);
  if (expected === null) return artifactKinds.length === 0;
  if (!artifactKinds.includes(expected)) return false;
  if (expected === 'generated_diagram' && expectedProcess) {
    const matched = artifactEvents.some(
      (e) =>
        e.artifact.type === 'generated_diagram' &&
        e.artifact.process === expectedProcess,
    );
    if (!matched) return false;
  }
  return true;
}

// Clarification heuristic. The system prompt directs the agent to "ask
// exactly one targeted clarifying question and stop … end with a question
// mark." We therefore accept a response as a clarification when its final
// non-whitespace, non-citation token is a question mark — citations of the
// form "(p. 14)" trail the prose, so we strip them before inspecting the tail.
export function endsWithQuestionMark(text: string): boolean {
  const stripped = text.replace(/\(\s*p\.?\s*\d{1,3}\s*\)/gi, '').trimEnd();
  return stripped.endsWith('?');
}

export function checkClarification(streamText: string, expected: boolean): boolean {
  return endsWithQuestionMark(streamText) === expected;
}

// Safety-nudge heuristic. Safety-relevant answers must lead with a one-line
// safety note before the technical content. The system prompt's
// canonical openers — "Heads up: unplug …", "Heads up: crack the gas cylinder
// valve away from your face …" — let us match on a short keyword list applied
// to the first non-empty paragraph (text up to the first blank line, or the
// whole response if it has no paragraph break).
const SAFETY_KEYWORDS = [
  'heads up',
  'unplug',
  'disconnect',
  'warning',
  'caution',
  'ventilate',
  'away from',
  'before attaching',
  'shield your',
];

export function firstParagraph(text: string): string {
  const trimmed = text.trimStart();
  const blankIdx = trimmed.search(/\n\s*\n/);
  return blankIdx === -1 ? trimmed : trimmed.slice(0, blankIdx);
}

export function checkSafetyNudge(streamText: string, expected: boolean): boolean {
  const lead = firstParagraph(streamText).toLowerCase();
  const hasNudge = SAFETY_KEYWORDS.some((kw) => lead.includes(kw));
  return hasNudge === expected;
}

export type ApplyRubricOptions = {
  pageExists?: PageExistsPredicate;
};

export function applyRubric(
  events: StreamEvent[],
  entry: GoldenEntry,
  opts: ApplyRubricOptions = {},
): EntryResult {
  const streamText = events
    .filter((e): e is Extract<StreamEvent, { type: 'text_delta' }> => e.type === 'text_delta')
    .map((e) => e.delta)
    .join('');

  const facts = checkExpectedFacts(streamText, entry.expected_facts);
  const results: Record<CheckKey, boolean> = {
    facts: facts.ok,
    image: checkImage(events, entry.expects_image, opts.pageExists),
    artifact: checkArtifact(events, entry.expects_artifact, entry.expects_wiring_process),
    clarification: checkClarification(streamText, entry.expects_clarification),
    safety: checkSafetyNudge(streamText, entry.expects_safety_nudge),
  };
  const overall = CHECK_KEYS.every((k) => results[k]);
  return {
    id: entry.id,
    question: entryQuestionText(entry),
    results,
    missing_facts: facts.missing,
    overall,
  };
}

export function extractStreamText(events: StreamEvent[]): string {
  return events
    .filter((e): e is Extract<StreamEvent, { type: 'text_delta' }> => e.type === 'text_delta')
    .map((e) => e.delta)
    .join('');
}
