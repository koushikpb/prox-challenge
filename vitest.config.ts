import { existsSync } from 'node:fs';
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
    if (existsSync(inSrc) || hasResolvableExt(inSrc)) return inSrc;
    return path.join(projectRoot, tail);
  },
};

function hasResolvableExt(p: string): boolean {
  return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'].some((ext) => existsSync(p + ext));
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
