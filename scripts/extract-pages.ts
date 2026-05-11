import { createRequire } from 'node:module';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// pdfjs-dist@4 uses Node 22's `process.getBuiltinModule` to auto-polyfill DOMMatrix,
// ImageData, Path2D. On Node 20.15 that API is absent, so we install the polyfills
// from `canvas` + `path2d` ourselves before importing pdf-to-img/pdfjs.
const requireCJS = createRequire(import.meta.url);
const canvasModule = requireCJS('canvas') as { DOMMatrix: unknown; ImageData: unknown };
const path2dModule = requireCJS('path2d') as { Path2D: unknown };
const globalAny = globalThis as Record<string, unknown>;
if (typeof globalAny.DOMMatrix === 'undefined') globalAny.DOMMatrix = canvasModule.DOMMatrix;
if (typeof globalAny.ImageData === 'undefined') globalAny.ImageData = canvasModule.ImageData;
if (typeof globalAny.Path2D === 'undefined') globalAny.Path2D = path2dModule.Path2D;

const { pdf: renderPdf } = await import('pdf-to-img');
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const FILES_DIR = path.join(REPO_ROOT, 'files');
const PAGES_DIR = path.join(REPO_ROOT, 'data', 'pages');
const INDEX_PATH = path.join(REPO_ROOT, 'data', 'index.json');

// 300 DPI from PDF's native 72 DPI requires scale = 300/72 ≈ 4.1667.
const RENDER_SCALE = 300 / 72;

type Source = 'owner-manual' | 'quick-start' | 'selection-chart';

interface SourceSpec {
  source: Source;
  pdfFilename: string;
  expectedPages: number;
  sectionFor: (page: number) => string;
  stripFooter: (text: string) => string;
}

interface IndexEntry {
  page: number;
  source: Source;
  section: string;
  headings: string[];
  text: string;
  image_path: string;
  region_ids: string[];
}

const OWNER_MANUAL_SECTIONS: ReadonlyArray<{ section: string; pages: readonly number[] }> = [
  { section: 'Safety', pages: range(1, 9) },
  { section: 'Controls', pages: range(10, 12) },
  { section: 'Wire', pages: range(13, 22) },
  { section: 'TIG-Stick', pages: range(23, 28) },
  { section: 'Welding Tips', pages: range(29, 34) },
  { section: 'Maintenance', pages: range(35, 48) },
];

const OWNER_MANUAL_PAGE_TO_SECTION: Record<number, string> = (() => {
  const map: Record<number, string> = {};
  for (const { section, pages } of OWNER_MANUAL_SECTIONS) {
    for (const p of pages) map[p] = section;
  }
  return map;
})();

function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

function pad3(n: number): string {
  return n.toString().padStart(3, '0');
}

const OWNER_MANUAL_FOOTER_PATTERNS: readonly RegExp[] = [
  /^Item\s+57812$/i,
  /^For\s+technical\s+questions/i,
  /^Page\s+\d+$/i,
  // Phone-number line that accompanies the "technical questions" footer.
  /^1[-\s]?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}\.?$/,
  /^please\s+call/i,
];

// pdfjs concatenates the running header (Page N + phone + Item 57812) into a single
// line with no separator, so substring-based removal is required in addition to the
// per-line pattern match. The composite regex is anchored on the "Item 57812" tag
// which is unique to this manual.
const OWNER_MANUAL_HEADER_RE =
  /Page\s*\d+\s*For technical questions[^.]*\.\s*Item\s*57812/gi;

function stripOwnerManualFooter(text: string): string {
  // First strip the joined header/footer phrase wherever it appears.
  let body = text.replace(OWNER_MANUAL_HEADER_RE, '');
  const lines = body.split('\n');
  // Also drop any lines that individually match a known footer pattern.
  const kept = lines.filter((raw) => {
    const line = raw.trim();
    if (line === '') return true;
    return !OWNER_MANUAL_FOOTER_PATTERNS.some((re) => re.test(line));
  });
  // Collapse leading/trailing blank lines from the removal.
  body = kept.join('\n').replace(/^\s*\n/, '').trimEnd();
  return body;
}

function noopFooter(text: string): string {
  return text.trimEnd();
}

const SOURCES: readonly SourceSpec[] = [
  {
    source: 'owner-manual',
    pdfFilename: 'owner-manual.pdf',
    expectedPages: 48,
    sectionFor: (page) => OWNER_MANUAL_PAGE_TO_SECTION[page] ?? 'Maintenance',
    stripFooter: stripOwnerManualFooter,
  },
  {
    source: 'quick-start',
    pdfFilename: 'quick-start-guide.pdf',
    expectedPages: 2,
    sectionFor: () => 'Quick Start',
    stripFooter: noopFooter,
  },
  {
    source: 'selection-chart',
    pdfFilename: 'selection-chart.pdf',
    expectedPages: 1,
    sectionFor: () => 'Selection Chart',
    stripFooter: noopFooter,
  },
];

// Heading detection: short uppercase-ish lines, no terminal punctuation.
// Best-effort only — empty array is acceptable per the Task Prompt.
function inferHeadings(text: string): string[] {
  const headings: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.length === 0 || line.length > 60) continue;
    if (/[.,;:?]$/.test(line)) continue;
    const letters = line.replace(/[^A-Za-z]/g, '');
    if (letters.length < 3) continue;
    const upperRatio = letters.replace(/[^A-Z]/g, '').length / letters.length;
    if (upperRatio >= 0.7) headings.push(line);
  }
  // Cap to a reasonable number to avoid noise.
  return headings.slice(0, 8);
}

const PDFJS_ROOT = path.dirname(requireCJS.resolve('pdfjs-dist/package.json'));

async function extractPdfPageTexts(pdfPath: string): Promise<string[]> {
  const data = new Uint8Array(await readFile(pdfPath));
  const loadingTask = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
    standardFontDataUrl: path.join(PDFJS_ROOT, 'standard_fonts') + path.sep,
    cMapUrl: path.join(PDFJS_ROOT, 'cmaps') + path.sep,
    cMapPacked: true,
  });
  const doc = await loadingTask.promise;
  try {
    const out: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // pdfjs returns items with `str` plus a `hasEOL` flag indicating a forced line break.
      let acc = '';
      let prevY: number | null = null;
      for (const item of content.items) {
        // TextItem has str; some items are TextMarkedContent with no str — skip those.
        if (typeof (item as { str?: unknown }).str !== 'string') continue;
        const textItem = item as { str: string; hasEOL?: boolean; transform?: number[] };
        const y = Array.isArray(textItem.transform) ? (textItem.transform[5] ?? null) : null;
        if (prevY !== null && y !== null && Math.abs(y - prevY) > 1) {
          if (!acc.endsWith('\n')) acc += '\n';
        }
        acc += textItem.str;
        if (textItem.hasEOL) acc += '\n';
        prevY = y;
      }
      out.push(acc);
      page.cleanup();
    }
    return out;
  } finally {
    await doc.destroy();
  }
}

async function ensureCleanPagesDir(): Promise<void> {
  await mkdir(PAGES_DIR, { recursive: true });
  const existing = await readdir(PAGES_DIR);
  await Promise.all(
    existing
      .filter((name) => name.endsWith('.png') || name.endsWith('.txt'))
      .map((name) => rm(path.join(PAGES_DIR, name))),
  );
}

async function run(): Promise<void> {
  await ensureCleanPagesDir();

  const indexEntries: IndexEntry[] = [];

  for (const spec of SOURCES) {
    const pdfPath = path.join(FILES_DIR, spec.pdfFilename);
    const pageTexts = await extractPdfPageTexts(pdfPath);
    if (pageTexts.length !== spec.expectedPages) {
      console.warn(
        `[warn] ${spec.source}: expected ${spec.expectedPages} pages, got ${pageTexts.length}`,
      );
    }

    const document = await renderPdf(pdfPath, { scale: RENDER_SCALE });
    let pageNumber = 0;
    for await (const pngBuffer of document) {
      pageNumber += 1;
      const padded = pad3(pageNumber);
      const baseName = `${spec.source}-${padded}`;
      const pngPath = path.join(PAGES_DIR, `${baseName}.png`);
      const txtPath = path.join(PAGES_DIR, `${baseName}.txt`);

      const rawText = pageTexts[pageNumber - 1] ?? '';
      const cleanText = spec.stripFooter(rawText);

      await writeFile(pngPath, pngBuffer);
      await writeFile(txtPath, cleanText, 'utf8');

      indexEntries.push({
        page: pageNumber,
        source: spec.source,
        section: spec.sectionFor(pageNumber),
        headings: inferHeadings(cleanText),
        text: cleanText,
        image_path: `/data/pages/${baseName}.png`,
        region_ids: [],
      });

      console.log(`page ${pageNumber} of ${spec.source}: PNG + text written`);
    }
  }

  // Sort: owner-manual, quick-start, selection-chart; pages ascending within each.
  const sourceOrder: Record<Source, number> = {
    'owner-manual': 0,
    'quick-start': 1,
    'selection-chart': 2,
  };
  indexEntries.sort((a, b) => {
    const s = sourceOrder[a.source] - sourceOrder[b.source];
    if (s !== 0) return s;
    return a.page - b.page;
  });

  await writeFile(INDEX_PATH, JSON.stringify(indexEntries, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${indexEntries.length} entries to ${path.relative(REPO_ROOT, INDEX_PATH)}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
