// Writes 1-rule stubs for the generated rulesets so a fresh clone builds
// even before `npm run build` fetches the real filter lists.
// Real pipeline output overwrites these files locally (git: intentionally
// left as modified — do not commit full lists, see FILTER_SOURCES.md).
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'rules', 'generated');

const stub = [
  {
    id: 1,
    priority: 1,
    action: { type: 'block' },
    condition: { urlFilter: '||kblock-stub.invalid^', resourceTypes: ['other'] },
  },
];

for (const f of ['abpvn_full.json', 'easylist_full.json', 'easyprivacy_full.json']) {
  writeFileSync(join(outDir, f), JSON.stringify(stub, null, 2) + '\n');
}
writeFileSync(
  join(outDir, 'element-hide.json'),
  JSON.stringify({ global: [], scoped: [], exceptions: {} }) + '\n',
);
writeFileSync(
  join(outDir, 'meta.json'),
  JSON.stringify(
    {
      generatedAt: 'stub',
      note: 'Stub committed to git. Run `npm run build` in apps/safari-extension to generate the real rulesets from ABPVN/EasyList/EasyPrivacy.',
      sources: {},
    },
    null,
    2,
  ) + '\n',
);
console.log('[KBlock] generated-rule stubs written ✓');
