/**
 * Build script: copies non-TypeScript assets from src/ to dist/
 * AND syncs full dist bundle into apps/ios/Extension/Resources/
 *
 * Usage: node scripts/copy-assets.mjs
 */
import { cpSync, mkdirSync, readdirSync, rmSync, existsSync } from 'fs';
import { join, extname, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');
const distDir = join(__dirname, '..', 'dist');
const iosExtensionResourcesDir = join(__dirname, '..', '..', 'ios', 'Extension', 'Resources');

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

// Sync complete dist/ into iOS Extension Resources (clean first so stale
// files from previous builds, e.g. unbundled modules, don't linger)
console.log('[KBlock] Syncing dist/ → apps/ios/Extension/Resources/');
rmSync(iosExtensionResourcesDir, { recursive: true, force: true });
mkdirSync(iosExtensionResourcesDir, { recursive: true });
cpSync(distDir, iosExtensionResourcesDir, { recursive: true });
console.log('[KBlock] Synced to iOS Extension Resources ✓');
