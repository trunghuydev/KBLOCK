/**
 * Build script: copies non-TypeScript assets from src/ to dist/
 * Runs after `tsc` compiles .ts → .js
 *
 * Usage: node scripts/copy-assets.mjs
 */
import { cpSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, extname, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');
const distDir = join(__dirname, '..', 'dist');

const ASSET_EXTENSIONS = new Set(['.json', '.html', '.css', '.png', '.svg', '.ico']);

function copyAssets(src, dest) {
  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyAssets(srcPath, destPath);
    } else if (ASSET_EXTENSIONS.has(extname(entry.name))) {
      mkdirSync(dirname(destPath), { recursive: true });
      cpSync(srcPath, destPath);
      const relPath = relative(srcDir, srcPath);
      console.log(`  Copied: ${relPath}`);
    }
  }
}

console.log('[KBlock] Copying assets src/ → dist/');
mkdirSync(distDir, { recursive: true });
copyAssets(srcDir, distDir);
console.log('[KBlock] Assets copied ✓');
