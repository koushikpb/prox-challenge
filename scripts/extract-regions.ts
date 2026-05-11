import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(REPO_ROOT, 'data', 'pages');
const REGIONS_DIR = path.join(REPO_ROOT, 'data', 'regions');
const REGIONS_JSON = path.join(REPO_ROOT, 'data', 'regions.json');
const INDEX_JSON = path.join(REPO_ROOT, 'data', 'index.json');

type Source = 'owner-manual' | 'quick-start' | 'selection-chart';
interface Bbox {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface RegionSpec {
  region_id: string;
  source: Source;
  page: number;
  bbox: Bbox;
  caption: string;
  source_pages?: number[];
}
interface RegionRecord extends RegionSpec {
  image_path: string;
  source_pages: number[];
}

// Page PNGs are A4 at 300 DPI: 2480 × 3507. The selection chart is 5000 × 5000
// with the chart content in a horizontal band roughly y ∈ [1500, 3320].
//
// Bboxes are eyeballed off the rendered PNGs (see Task Log). Side-tab graphics
// run along the right edge of owner-manual pages from roughly x = 2300 onward,
// so most crops stop at x = 2280 to exclude them.
const REGIONS: readonly RegionSpec[] = [
  {
    region_id: 'duty_cycle_specifications',
    source: 'owner-manual',
    page: 7,
    bbox: { x: 100, y: 80, w: 2200, h: 2400 },
    caption:
      'Specifications block: rated duty cycles for MIG, TIG, and Stick at 120 V and 240 V. For example, MIG at 200 A on 240 V is rated 25 % — 2½ minutes welding per 10-minute period. (p. 7)',
  },
  {
    region_id: 'polarity_DCEN_flux_cored',
    source: 'owner-manual',
    page: 13,
    bbox: { x: 100, y: 1880, w: 2150, h: 1480 },
    caption:
      'Safety: unplug the welder before changing cable polarity. Flux-cored (gasless) MIG runs DCEN: plug the ground clamp cable into the Positive (+) socket and the wire-feed power cable into the Negative (−) socket. (p. 13)',
  },
  {
    region_id: 'polarity_DCEP_solid_core',
    source: 'owner-manual',
    page: 14,
    bbox: { x: 100, y: 80, w: 2200, h: 1300 },
    caption:
      'Safety: unplug the welder before changing cable polarity. Solid-core (gas-shielded) MIG runs DCEP: plug the ground clamp cable into the Negative (−) socket and the wire-feed power cable into the Positive (+) socket. (p. 14)',
  },
  {
    region_id: 'polarity_TIG',
    source: 'owner-manual',
    page: 24,
    bbox: { x: 200, y: 680, w: 2080, h: 2300 },
    caption:
      'Safety: unplug the welder before changing cable polarity. TIG runs DCEN: plug the ground clamp cable into the Positive (+) socket and the TIG torch cable into the Negative (−) socket. (p. 24)',
  },
  {
    region_id: 'polarity_Stick',
    source: 'owner-manual',
    page: 27,
    bbox: { x: 100, y: 50, w: 2200, h: 1900 },
    caption:
      'Safety: unplug the welder before changing cable polarity. Stick (SMAW) is set up DCEP per the manual: plug the ground clamp cable into the Negative (−) socket and the electrode holder cable into the Positive (+) socket. Always follow the electrode manufacturer’s polarity instructions — some specialty rods call for DCEN. (p. 27)',
  },
  {
    region_id: 'lcd_synergic_display',
    source: 'owner-manual',
    page: 20,
    bbox: { x: 200, y: 1700, w: 2280, h: 1100 },
    caption:
      'Auto Weld synergic display: after dialing in wire diameter and material thickness with the left and right knobs, the welder shows its recommended amperage and voltage (here, 121 A and 13.8 V for 0.030″ wire on 24 gauge). (p. 20)',
  },
  {
    region_id: 'selection_chart',
    source: 'selection-chart',
    page: 1,
    bbox: { x: 0, y: 1500, w: 5000, h: 1820 },
    caption:
      'Welder selection chart: matches each process (Flux-Cored, MIG, Stick, TIG) to skill level, shielding-gas requirement, materials, thickness range, cleanliness, and typical applications. (selection chart)',
  },
  {
    region_id: 'wiring_schematic',
    source: 'owner-manual',
    page: 45,
    bbox: { x: 100, y: 80, w: 2200, h: 3300 },
    caption:
      'Safety: all internal service requires the welder to be unplugged and fully discharged before any panel is opened. Internal wiring schematic showing the PFC stage, MCU board, IGBT inverter, and output rectification. (p. 45)',
  },
  {
    region_id: 'parts_diagram',
    source: 'owner-manual',
    page: 47,
    bbox: { x: 100, y: 80, w: 2200, h: 3300 },
    caption:
      'Exploded assembly diagram with numbered callouts that line up with the parts list on p. 46. (p. 47)',
  },
];

function pad3(n: number): string {
  return n.toString().padStart(3, '0');
}

function pageFile(source: Source, page: number): string {
  return path.join(PAGES_DIR, `${source}-${pad3(page)}.png`);
}

async function ensureCleanRegionsDir(): Promise<void> {
  await mkdir(REGIONS_DIR, { recursive: true });
  const existing = await readdir(REGIONS_DIR);
  await Promise.all(
    existing
      .filter((name) => name.endsWith('.png'))
      .map((name) => rm(path.join(REGIONS_DIR, name))),
  );
}

async function cropRegion(spec: RegionSpec): Promise<RegionRecord> {
  const input = pageFile(spec.source, spec.page);
  const outputName = `${spec.region_id}.png`;
  const outputPath = path.join(REGIONS_DIR, outputName);

  const meta = await sharp(input).metadata();
  if (typeof meta.width !== 'number' || typeof meta.height !== 'number') {
    throw new Error(`Cannot read dimensions for ${input}`);
  }
  const { x, y, w, h } = spec.bbox;
  const safeW = Math.min(w, meta.width - x);
  const safeH = Math.min(h, meta.height - y);
  if (safeW <= 0 || safeH <= 0) {
    throw new Error(
      `Bbox for ${spec.region_id} is outside page bounds (${meta.width}×${meta.height})`,
    );
  }

  await sharp(input)
    .extract({ left: x, top: y, width: safeW, height: safeH })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  console.log(
    `region ${spec.region_id}: cropped from ${path.basename(input)} at ${x},${y} ${safeW}x${safeH}`,
  );

  return {
    ...spec,
    bbox: { x, y, w: safeW, h: safeH },
    image_path: `/data/regions/${outputName}`,
    source_pages: spec.source_pages ?? [spec.page],
  };
}

interface PageIndexEntry {
  page: number;
  source: Source;
  section: string;
  headings: string[];
  text: string;
  image_path: string;
  region_ids: string[];
}

async function updatePageIndex(records: RegionRecord[]): Promise<number> {
  const raw = JSON.parse(await readFile(INDEX_JSON, 'utf8')) as PageIndexEntry[];

  const idsByKey = new Map<string, string[]>();
  for (const r of records) {
    const key = `${r.source}:${r.page}`;
    const list = idsByKey.get(key) ?? [];
    list.push(r.region_id);
    idsByKey.set(key, list);
  }

  let touched = 0;
  for (const entry of raw) {
    const key = `${entry.source}:${entry.page}`;
    const ids = idsByKey.get(key);
    if (ids) {
      entry.region_ids = [...ids].sort();
      touched += 1;
    } else {
      entry.region_ids = [];
    }
  }

  await writeFile(INDEX_JSON, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  return touched;
}

async function run(): Promise<void> {
  await ensureCleanRegionsDir();

  const records: RegionRecord[] = [];
  for (const spec of REGIONS) {
    records.push(await cropRegion(spec));
  }

  records.sort((a, b) => a.region_id.localeCompare(b.region_id));
  await writeFile(REGIONS_JSON, JSON.stringify(records, null, 2) + '\n', 'utf8');

  const touched = await updatePageIndex(records);

  console.log(
    `Wrote ${records.length} regions to ${path.relative(REPO_ROOT, REGIONS_JSON)}; updated ${touched} pages in ${path.relative(REPO_ROOT, INDEX_JSON)}`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
