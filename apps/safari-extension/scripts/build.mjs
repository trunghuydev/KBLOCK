/**
 * Build script: bundles the TypeScript sources with esbuild.
 *
 * Why esbuild instead of plain tsc:
 * - Content scripts must be classic scripts (no import/export statements).
 * - Safari module resolution requires explicit file extensions; tsc's emitted
 *   `import ... from '../shared/types'` (no .js) kills the service worker and
 *   popup at load time. esbuild bundles everything into self-contained files.
 */
import { build } from 'esbuild';
import { rmSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The updater bundles @kblock/filter-engine — make sure its dist exists.
const engineDist = join(__dirname, '..', '..', '..', 'packages', 'filter-engine', 'dist', 'src', 'index.js');
if (!existsSync(engineDist)) {
  console.log('[KBlock Build] building @kblock/filter-engine first...');
  const res = spawnSync('npm', ['run', 'build'], {
    cwd: join(__dirname, '..', '..', '..', 'packages', 'filter-engine'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    console.error('[KBlock Build] filter-engine build failed');
    process.exit(1);
  }
}

// Clean previous output so stale files (e.g. old tsc artifacts) never leak
// into the bundled extension or the iOS Resources sync.
rmSync('dist', { recursive: true, force: true });

const entries = [
  'src/background/background.ts',
  'src/content/content.ts',
  'src/content/injected.ts',
  'src/popup/popup.ts',
];

await build({
  entryPoints: entries,
  outdir: 'dist',
  outbase: 'src',
  bundle: true,
  format: 'iife',
  target: ['safari15'],
  sourcemap: false,
  minify: true,
  logLevel: 'info',
});

console.log('[KBlock] JS bundle built ✓');
