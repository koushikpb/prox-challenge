import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const projectRoot = __dirname;

// Mirror tsconfig.json "@/*": ["./src/*", "./*"] — prefer src/, fall back to repo root.
const aliasResolver = {
  name: 'tsconfig-paths-alias',
  resolveId(source: string) {
    if (!source.startsWith('@/')) return null;
    const tail = source.slice(2);
    const inSrc = path.join(projectRoot, 'src', tail);
    const resolvedSrc = resolveTarget(inSrc);
    if (resolvedSrc) return resolvedSrc;
    const inRoot = path.join(projectRoot, tail);
    const resolvedRoot = resolveTarget(inRoot);
    if (resolvedRoot) return resolvedRoot;
    return inSrc;
  },
};

const RESOLVABLE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

function resolveTarget(p: string): string | null {
  if (existsSync(p)) {
    if (statSync(p).isDirectory()) {
      for (const ext of RESOLVABLE_EXTS) {
        const indexed = path.join(p, `index${ext}`);
        if (existsSync(indexed)) return indexed;
      }
      return null;
    }
    return p;
  }
  for (const ext of RESOLVABLE_EXTS) {
    if (existsSync(p + ext)) return p + ext;
  }
  return null;
}

export default defineConfig({
  plugins: [aliasResolver],
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules/**', '.next/**', 'dist/**'],
    passWithNoTests: true,
  },
});
