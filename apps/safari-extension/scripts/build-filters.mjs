/**
 * KBlock — Filter pipeline (Phase 2)
 *
 * Downloads community filter lists (ABPVN, EasyList, EasyPrivacy), converts
 * them through @kblock/filter-engine into Safari DNR rulesets + a cosmetic
 * element-hide bundle, and writes them under src/rules/generated/.
 *
 * - Converted output is NOT committed (see .gitignore): the repo never
 *   distributes the lists; each build fetches its own copy (cached locally).
 * - If a download fails and there is no cache, a harmless 1-rule stub is
 *   written so the extension manifest always resolves.
 *
 * Usage: node scripts/build-filters.mjs [--force]
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const engineDist = join(__dirname, '..', '..', '..', 'packages', 'filter-engine', 'dist', 'src', 'index.js');
const srcDir = join(__dirname, '..', 'src');
const outDir = join(srcDir, 'rules', 'generated');
const cacheDir = join(__dirname, '..', '.filter-cache');

const FORCE = process.argv.includes('--force');

// ─── Sources (see filters/sources.json for licenses) ─────────────────────────
//
// Static-ruleset budget: Safari allows 150,000 DNR rules per extension.
// Worst case with every cap hit: 55+42+15+20+12+10+2.5 ≈ 156.5K — the caps
// below are tuned so real-world totals stay ≈ 140K (most caps never bite).

const SOURCES = [
  {
    id: 'abpvn',
    out: 'abpvn_full.json',
    url: 'https://raw.githubusercontent.com/abpvn/abpvn/master/filter/abpvn.txt',
    maxRules: 15000,
  },
  {
    id: 'easylist',
    out: 'easylist_full.json',
    url: 'https://easylist.to/easylist/easylist.txt',
    maxRules: 60000,
  },
  {
    id: 'easyprivacy',
    out: 'easyprivacy_full.json',
    url: 'https://easylist.to/easylist/easyprivacy.txt',
    maxRules: 50000,
  },
  {
    id: 'adguard_mobile',
    out: 'adguard_mobile_full.json',
    url: 'https://filters.adtidy.org/extension/chromium/filters/11.txt',
    maxRules: 20000,
  },
  {
    id: 'adguard_spyware',
    out: 'adguard_spyware_full.json',
    url: 'https://filters.adtidy.org/extension/chromium/filters/4.txt',
    maxRules: 12000,
  },
  {
    id: 'fanboy_annoyance',
    out: 'fanboy_annoyance_full.json',
    url: 'https://secure.fanboy.co.nz/fanboy-annoyance.txt',
    maxRules: 10000,
  },
  {
    id: 'adguard_urltracking',
    out: 'adguard_urltracking_full.json',
    url: 'https://filters.adtidy.org/extension/chromium/filters/17.txt',
    maxRules: 2500,
  },
];

const MAX_GLOBAL_SELECTORS = 8000;
const MAX_SCOPED_SELECTORS = 4000;

// ─── Ensure filter-engine is built ───────────────────────────────────────────

if (!existsSync(engineDist)) {
  console.log('[KBlock Filters] filter-engine dist missing — building it...');
  const res = spawnSync('npm', ['run', 'build'], {
    cwd: join(__dirname, '..', '..', '..', 'packages', 'filter-engine'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    console.error('[KBlock Filters] Failed to build @kblock/filter-engine');
    process.exit(1);
  }
}

const { parse, convert, stripDebugComments } = await import(
  `file://${engineDist.replace(/\\/g, '/')}`
);

// ─── Download with cache ─────────────────────────────────────────────────────

async function fetchList(source) {
  const cachePath = join(cacheDir, `${source.id}.txt`);
  if (!FORCE && existsSync(cachePath)) {
    const stat = await import('fs').then((fs) => fs.statSync(cachePath));
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < 24 * 60 * 60 * 1000) {
      console.log(`[KBlock Filters] ${source.id}: cached copy (${Math.round(ageMs / 3600000)}h old)`);
      return readFileSync(cachePath, 'utf8');
    }
  }

  try {
    console.log(`[KBlock Filters] ${source.id}: downloading...`);
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'KBlock/0.2.0 (filter pipeline)' },
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // arrayBuffer + decode avoids undici's streaming text parser, which
    // crashes with an internal assertion on some responses (Node 22).
    const buf = await res.arrayBuffer();
    const text = new TextDecoder().decode(buf);
    if (text.length < 1000) throw new Error('Response suspiciously small');
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(cachePath, text);
    return text;
  } catch (err) {
    if (existsSync(cachePath)) {
      console.warn(`[KBlock Filters] ${source.id}: download failed (${err.message}) — using stale cache`);
      return readFileSync(cachePath, 'utf8');
    }
    console.warn(`[KBlock Filters] ${source.id}: download failed (${err.message}) — writing stub`);
    return null;
  }
}

// ─── Sanitization ────────────────────────────────────────────────────────────

/** RE2-safe check: DNR regexFilter rejects lookarounds; skip those rules. */
function isSafeRegex(re) {
  return re.length <= 2000 && !/\(\?[,=!<]/.test(re);
}

function isSafeSelector(sel) {
  return (
    typeof sel === 'string' &&
    sel.length > 0 &&
    sel.length <= 2000 &&
    !/[{}@<>]/.test(sel) &&
    !sel.toLowerCase().includes('url(')
  );
}

/** Pure-domain pattern like ||ads.example.com^ — matched against the
 * hostname only, which is always lowercase, so the case-insensitive flag
 * carries no information and can be dropped (~34 bytes/rule saved). */
const PURE_DOMAIN_FILTER = /^\|\|[\p{L}\p{N}][\p{L}\p{N}\-.]*\^?$/u;

/** Converter parse artifacts: urlFilter ending in "$option,option" is an
 * ABP options suffix that was never stripped — such rules are no-ops. */
const ARTIFACT_OPTIONS = /\$[a-z][a-z\-]*(,[a-z][a-z\-]*)+$/i;

/**
 * Global navigation guard: EasyList/EasyPrivacy contain thousands of broad
 * patterns ("-assets/ads.", "&track=...") and their rules carry no
 * resourceTypes, so DNR would match MAIN_FRAME too and pages would fail to
 * load. Converter skips $popup/$document rules, so NOTHING intentionally
 * blocks main_frame — one high-priority allow rule makes navigation always
 * possible while every subresource rule still applies.
 * (priority 2 beats the converted block rules at priority 1, but stays below
 * custom user rules at 100 and the whitelist at 3000.)
 */
const MAIN_FRAME_ALLOW_RULE = {
  id: 999999,
  priority: 2,
  action: { type: 'allow' },
  condition: { resourceTypes: ['main_frame'] },
};

function slimRule(rule) {
  const condition = rule.condition || {};
  const urlFilter = condition.urlFilter;

  // Skip parse artifacts (filter text with a raw $options suffix) and
  // list-header lines like "[Adblock Plus 2.0]" leaking through as patterns.
  if (urlFilter && (ARTIFACT_OPTIONS.test(urlFilter) || urlFilter.startsWith('['))) return null;

  // Block rules don't need priority 100 — the main-frame allow guard at
  // priority 2 must stay above them, and allow rules beat blocks at equal
  // priority anyway. Priority 1 keeps semantics and saves bytes.
  let slim = rule;
  if (rule.action?.type === 'block') {
    slim = { ...rule, priority: 1 };
  }

  if (
    urlFilter &&
    PURE_DOMAIN_FILTER.test(urlFilter) &&
    slim.condition.isUrlFilterCaseSensitive === false
  ) {
    const { isUrlFilterCaseSensitive, ...rest } = slim.condition;
    slim.condition = rest;
  }
  return slim;
}

function sanitizeDnrRules(rules, maxRules) {
  const out = [];
  const seen = new Set();
  for (const rule of rules) {
    if (out.length >= maxRules) break;

    if (rule.condition?.regexFilter && !isSafeRegex(rule.condition.regexFilter)) continue;
    const urlFilter = rule.condition?.urlFilter;
    if (urlFilter && (urlFilter.length > 2000 || /[\r\n]/.test(urlFilter))) continue;

    const slim = slimRule(rule);
    if (!slim) continue;

    // Deduplicate identical rules within a file.
    const key = JSON.stringify([slim.action, slim.condition]);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push(slim);
  }
  return out;
}

// ─── Stub so the manifest always resolves ────────────────────────────────────

function writeStub(file) {
  writeFileSync(
    join(outDir, file),
    JSON.stringify(
      [
        {
          id: 1,
          priority: 1,
          action: { type: 'block' },
          condition: {
            urlFilter: '||kblock-stub.invalid^',
            resourceTypes: ['other'],
          },
        },
      ],
      null,
      2,
    ),
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

const meta = { generatedAt: new Date().toISOString(), sources: {} };
const hideGlobal = [];
const hideScoped = [];
const hideExceptions = [];

for (const source of SOURCES) {
  const text = await fetchList(source);

  if (!text) {
    writeStub(source.out);
    meta.sources[source.id] = { status: 'stub' };
    continue;
  }

  console.log(`[KBlock Filters] ${source.id}: parsing ${(text.length / 1024).toFixed(0)} KB...`);
  const parsed = parse(text);
  const converted = convert(parsed);

  const rules = sanitizeDnrRules(stripDebugComments(converted.rules), source.maxRules);
  writeFileSync(join(outDir, source.out), JSON.stringify([...rules, MAIN_FRAME_ALLOW_RULE]));

  let globalCount = 0;
  for (const entry of converted.elementHideSelectors) {
    if (!isSafeSelector(entry.selector)) continue;
    if (entry.isException) {
      hideExceptions.push(entry);
      continue;
    }
    if (entry.domains.length === 0) {
      if (hideGlobal.length < MAX_GLOBAL_SELECTORS) {
        hideGlobal.push(entry.selector);
        globalCount++;
      }
    } else if (hideScoped.length < MAX_SCOPED_SELECTORS) {
      hideScoped.push({ selector: entry.selector, domains: entry.domains });
    }
  }

  meta.sources[source.id] = {
    status: 'ok',
    networkRules: rules.length,
    elementHide: globalCount,
    skipped: converted.skipped.length,
    unsupported: parsed.stats.unsupported,
  };
  console.log(
    `[KBlock Filters] ${source.id}: ${rules.length} DNR rules, ` +
      `${converted.skipped.length} skipped, ${parsed.stats.unsupported} unsupported`,
  );
}

// Exceptions: selectors that must NOT be hidden on specific domains.
const exceptionMap = {};
for (const exc of hideExceptions) {
  const key = exc.selector;
  if (!exceptionMap[key]) exceptionMap[key] = new Set();
  for (const d of exc.domains) exceptionMap[key].add(d);
}

const elementHide = {
  global: hideGlobal,
  scoped: hideScoped,
  // selector -> domains where it must stay visible
  exceptions: Object.fromEntries(
    Object.entries(exceptionMap).map(([sel, domains]) => [sel, [...domains]]),
  ),
};
writeFileSync(join(outDir, 'element-hide.json'), JSON.stringify(elementHide));

meta.elementHide = {
  global: hideGlobal.length,
  scoped: hideScoped.length,
  exceptions: Object.keys(elementHide.exceptions).length,
};
writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));

console.log('[KBlock Filters] Done ✓ → src/rules/generated/');
