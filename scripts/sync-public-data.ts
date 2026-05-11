/*
 * Mirrors generated `data/` artifacts into `public/data/` so Next.js serves
 * them as ordinary static assets at the `/data/...` URLs the agent tools
 * and client artifact components consume.
 *
 * Wired to `npm run prebuild` (and `npm install` postinstall) so reviewers
 * and Vercel builds get the mirrored copy automatically.
 *
 * Intentionally narrow: we copy only the assets that need to be CDN-served.
 * `data/index.json` and the source PDFs stay server-side only.
 */
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');

const sourceDirs = ['pages', 'regions'] as const;
const sourceFiles = [
  'duty_cycle.json',
  'settings.json',
  'polarity.json',
  'troubleshooting.json',
] as const;

function sync(): void {
  const dataRoot = path.join(projectRoot, 'data');
  const publicDataRoot = path.join(projectRoot, 'public', 'data');
  mkdirSync(publicDataRoot, { recursive: true });

  for (const dir of sourceDirs) {
    const src = path.join(dataRoot, dir);
    const dest = path.join(publicDataRoot, dir);
    if (!existsSync(src)) {
      console.warn(`[sync-public-data] skipping ${dir} — ${src} does not exist`);
      continue;
    }
    rmSync(dest, { recursive: true, force: true });
    cpSync(src, dest, { recursive: true });
    console.log(`[sync-public-data] mirrored ${src} → ${dest}`);
  }

  for (const file of sourceFiles) {
    const src = path.join(dataRoot, file);
    const dest = path.join(publicDataRoot, file);
    if (!existsSync(src)) {
      console.warn(`[sync-public-data] skipping ${file} — ${src} does not exist`);
      continue;
    }
    copyFileSync(src, dest);
    console.log(`[sync-public-data] copied ${src} → ${dest}`);
  }
}

sync();
