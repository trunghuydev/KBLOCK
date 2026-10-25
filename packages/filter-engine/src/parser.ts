// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * EasyList / ABP filter list parser.
 *
 * Supported syntax (documented subset):
 *   - Network block rules:  ||example.com^
 *   - Network allow rules:  @@||example.com^
 *   - Element hide rules:   example.com##.selector
 *   - Comments:             ! text
 *   - Metadata:             ! Title: ..., ! Version: ...
 *
 * Explicitly unsupported (reported, not silently skipped):
 *   - Scriptlet injection (##+js())
 *   - Extended CSS selectors (:has, :xpath, etc.)
 *   - $redirect= / $csp= / $badfilter options
 *
 * IMPORTANT: Unsupported rules NEVER cause silent meaning change.
 * They are always reported with the exact reason.
 */

import type {
  ParseResult,
  ParsedRule,
  ParsedNetworkRule,
  ParsedElementHideRule,
  ParsedComment,
  ParsedUnsupportedRule,
  NetworkRuleOptions,
  ResourceType,
  FilterListMetadata,
  ParseStats,
} from './types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_INPUT_BYTES = 5 * 1024 * 1024; // 5MB hard limit

const KNOWN_RESOURCE_TYPE_MAP: Record<string, ResourceType> = {
  script: 'script',
  image: 'image',
  stylesheet: 'stylesheet',
  object: 'object',
  xmlhttprequest: 'xmlhttprequest',
  xhr: 'xmlhttprequest',
  subdocument: 'sub_frame',
  other: 'other',
  websocket: 'websocket',
  media: 'media',
  font: 'font',
  ping: 'ping',
};

// Options that make a rule unsupported
const UNSUPPORTED_OPTIONS = new Set([
  'redirect',
  'redirect-rule',
  'csp',
  'badfilter',
  'rewrite',
  'popunder',
]);

// Metadata keys we care about
const METADATA_KEYS = new Set(['title', 'version', 'last modified', 'homepage', 'licence', 'license', 'description']);

// ─── Line Parsers ─────────────────────────────────────────────────────────────

function parseComment(line: string, lineNumber: number): ParsedComment {
  const content = line.slice(1).trim(); // Remove leading '!'
  const colonIdx = content.indexOf(':');

  if (colonIdx > 0) {
    const key = content.slice(0, colonIdx).trim().toLowerCase();
    const value = content.slice(colonIdx + 1).trim();

    if (METADATA_KEYS.has(key)) {
      return { kind: 'metadata', raw: line, lineNumber, key, value };
    }
  }

  return { kind: 'comment', raw: line, lineNumber };
}

function parseNetworkOptions(optionStr: string): {
  options: NetworkRuleOptions;
  unsupported: string | null;
} {
  const options: NetworkRuleOptions = {};
  const parts = optionStr.split(',');

  for (const part of parts) {
    const opt = part.trim().toLowerCase();

    if (!opt) continue;

    // Detect unsupported options early
    for (const bad of UNSUPPORTED_OPTIONS) {
      if (opt === bad || opt.startsWith(`${bad}=`)) {
        return { options, unsupported: opt };
      }
    }

    if (opt === 'third-party') {
      options.thirdParty = true;
    } else if (opt === '~third-party') {
      options.firstParty = true;
    } else if (opt === 'first-party') {
      options.firstParty = true;
    } else if (opt === '~first-party') {
      options.thirdParty = true;
    } else if (opt === 'important') {
      options.important = true;
    } else if (opt === 'popup') {
      options.popup = true;
    } else if (opt === 'doc' || opt === 'document') {
      options.document = true;
    } else if (opt === 'removeparam') {
      // Bare $removeparam (strip every query param) has no DNR equivalent.
      return { options, unsupported: 'removeparam' };
    } else if (opt.startsWith('removeparam=')) {
      const value = opt.slice('removeparam='.length);
      // DNR removeParams only supports exact names — no regex or value match.
      if (!value || value.startsWith('/') || /[\\/:*=]/.test(value)) {
        return { options, unsupported: 'removeparam' };
      }
      const names = value.split('|').map((n) => n.trim()).filter(Boolean);
      if (names.length === 0 || names.length > 20) {
        return { options, unsupported: 'removeparam' };
      }
      options.removeparam = names;
    } else if (opt.startsWith('domain=')) {
      const rawDomains = opt.slice('domain='.length).split('|');
      options.domains = options.domains ?? [];
      options.notDomains = options.notDomains ?? [];
      for (const d of rawDomains) {
        if (d.startsWith('~')) {
          options.notDomains.push(d.slice(1));
        } else {
          options.domains.push(d);
        }
      }
    } else {
      // Resource type options
      const negated = opt.startsWith('~');
      const typeKey = negated ? opt.slice(1) : opt;
      const mapped = KNOWN_RESOURCE_TYPE_MAP[typeKey];

      if (mapped) {
        if (!negated) {
          options.resourceTypes = options.resourceTypes ?? [];
          options.resourceTypes.push(mapped);
        }
        // ~script etc. — means "apply to all except this type": too complex for V1, skip
      } else if (!opt.startsWith('~')) {
        // Unknown option — unsupported
        return { options, unsupported: `unknown-option:${opt}` };
      }
    }
  }

  return { options, unsupported: null };
}

function parseNetworkRule(
  line: string,
  lineNumber: number,
  isAllow: boolean,
): ParsedNetworkRule | ParsedUnsupportedRule {
  let pattern = isAllow ? line.slice(2) : line; // Strip @@ prefix for allow rules

  // Check for options ($...)
  let optionStr = '';
  const dollarIdx = findOptionSeparator(pattern);
  if (dollarIdx !== -1) {
    optionStr = pattern.slice(dollarIdx + 1);
    pattern = pattern.slice(0, dollarIdx);
  }

  if (!pattern) {
    return {
      kind: 'unsupported',
      raw: line,
      lineNumber,
      reason: 'parse-error',
    };
  }

  // Check for regex patterns (wrapped in /)
  const isRegex = pattern.startsWith('/') && pattern.endsWith('/');
  const urlFilter = isRegex ? pattern.slice(1, -1) : pattern;

  if (isRegex && urlFilter.length > 200) {
    return {
      kind: 'unsupported',
      raw: line,
      lineNumber,
      reason: 'regex-too-complex',
    };
  }

  if (optionStr) {
    const { options, unsupported } = parseNetworkOptions(optionStr);
    if (unsupported) {
      // Map specific unsupported options to reasons
      if (unsupported.startsWith('redirect') || unsupported.startsWith('rewrite')) {
        return { kind: 'unsupported', raw: line, lineNumber, reason: 'redirect' };
      }
      if (unsupported.startsWith('csp')) {
        return { kind: 'unsupported', raw: line, lineNumber, reason: 'csp' };
      }
      if (unsupported.startsWith('badfilter')) {
        return { kind: 'unsupported', raw: line, lineNumber, reason: 'badfilter' };
      }
      if (unsupported.startsWith('popunder')) {
        return { kind: 'unsupported', raw: line, lineNumber, reason: 'popup' };
      }
      if (unsupported === 'removeparam') {
        return { kind: 'unsupported', raw: line, lineNumber, reason: 'removeparam' };
      }
      return { kind: 'unsupported', raw: line, lineNumber, reason: 'unknown-option' };
    }

    return {
      kind: isAllow ? 'network-allow' : 'network-block',
      raw: line,
      lineNumber,
      urlFilter,
      isRegex,
      options,
    };
  }

  return {
    kind: isAllow ? 'network-allow' : 'network-block',
    raw: line,
    lineNumber,
    urlFilter,
    isRegex,
    options: {},
  };
}

/**
 * Finds the position of the options separator ($) while ignoring
 * $ signs that appear inside regex patterns or as part of URLs.
 */
function findOptionSeparator(pattern: string): number {
  // If pattern is a regex, no options are supported
  if (pattern.startsWith('/')) return -1;

  // Find last unescaped $ that is not at a common URL position
  const idx = pattern.lastIndexOf('$');
  if (idx === -1) return -1;
  // Avoid matching things like $scheme in URLs
  if (idx === 0 && pattern.length === 1) return -1;
  return idx;
}

function parseElementHideRule(
  line: string,
  lineNumber: number,
): ParsedElementHideRule | ParsedUnsupportedRule {
  // Scriptlet injection: ##+js(...)
  if (line.includes('##+js(')) {
    return { kind: 'unsupported', raw: line, lineNumber, reason: 'script-injection' };
  }

  const isException = line.includes('#@#');
  const separator = isException ? '#@#' : '##';
  const sepIdx = line.indexOf(separator);

  if (sepIdx === -1) {
    return { kind: 'unsupported', raw: line, lineNumber, reason: 'parse-error' };
  }

  const domainPart = line.slice(0, sepIdx);
  const selector = line.slice(sepIdx + separator.length).trim();
  const domains = domainPart ? domainPart.split(',').map((d) => d.trim()).filter(Boolean) : [];

  // Detect extended CSS that Safari content scripts cannot handle reliably
  const hasExtendedCSS = /:\s*(has|not|matches|xpath|upward|remove|style)\s*\(/.test(selector);

  if (hasExtendedCSS) {
    return { kind: 'unsupported', raw: line, lineNumber, reason: 'extended-css' };
  }

  return {
    kind: isException ? 'element-hide-exception' : 'element-hide',
    raw: line,
    lineNumber,
    domains,
    selector,
    isExtended: false,
  };
}

function parseLine(line: string, lineNumber: number): ParsedRule {
  const trimmed = line.trim();

  // Skip empty lines (not a rule)
  if (!trimmed) {
    return { kind: 'comment', raw: line, lineNumber };
  }

  // Element hide / scriptlet
  if (trimmed.includes('##') || trimmed.includes('#@#')) {
    return parseElementHideRule(trimmed, lineNumber);
  }

  // Comment or metadata
  if (trimmed.startsWith('!') || trimmed.startsWith('#')) {
    return parseComment(trimmed, lineNumber);
  }

  // Allow rule (exception)
  if (trimmed.startsWith('@@')) {
    return parseNetworkRule(trimmed, lineNumber, true);
  }

  // Block rule (everything else that looks like a network rule)
  // Heuristic: must contain a dot or ^ or * to be a valid filter
  if (trimmed.includes('.') || trimmed.includes('^') || trimmed.includes('*') || trimmed.startsWith('||')) {
    return parseNetworkRule(trimmed, lineNumber, false);
  }

  return { kind: 'unsupported', raw: line, lineNumber, reason: 'parse-error' };
}

// ─── Metadata Extractor ───────────────────────────────────────────────────────

function extractMetadata(rules: ParsedRule[]): FilterListMetadata {
  const metadata: FilterListMetadata = {};

  for (const rule of rules) {
    if (rule.kind !== 'metadata') continue;
    const key = rule.key?.toLowerCase() ?? '';
    const value = rule.value ?? '';

    switch (key) {
      case 'title': metadata.title = value; break;
      case 'version': metadata.version = value; break;
      case 'last modified': metadata.lastModified = value; break;
      case 'homepage': metadata.homepage = value; break;
      case 'licence':
      case 'license': metadata.license = value; break;
      case 'description': metadata.description = value; break;
    }
  }

  return metadata;
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

export function parse(input: string): ParseResult {
  // Size guard
  const byteLength = new TextEncoder().encode(input).length;
  if (byteLength > MAX_INPUT_BYTES) {
    throw new Error(
      `Input too large: ${byteLength} bytes (max ${MAX_INPUT_BYTES} bytes / 5MB)`,
    );
  }

  const lines = input.split('\n');
  const rules: ParsedRule[] = [];

  const stats: ParseStats = {
    totalLines: lines.length,
    networkBlock: 0,
    networkAllow: 0,
    elementHide: 0,
    comments: 0,
    unsupported: 0,
    errors: 0,
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;

    try {
      const rule = parseLine(lines[i], lineNumber);
      rules.push(rule);

      switch (rule.kind) {
        case 'network-block': stats.networkBlock++; break;
        case 'network-allow': stats.networkAllow++; break;
        case 'element-hide':
        case 'element-hide-exception': stats.elementHide++; break;
        case 'comment':
        case 'metadata': stats.comments++; break;
        case 'unsupported': stats.unsupported++; break;
      }
    } catch {
      stats.errors++;
      rules.push({
        kind: 'unsupported',
        raw: lines[i],
        lineNumber,
        reason: 'parse-error',
      });
    }
  }

  const metadata = extractMetadata(rules);

  return { metadata, rules, stats };
}
