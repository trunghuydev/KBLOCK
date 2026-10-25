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
import { rmSync } from 'fs';

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
