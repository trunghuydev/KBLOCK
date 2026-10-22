// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * DNR (declarativeNetRequest) converter.
 *
 * Converts parsed EasyList AST nodes into Safari-compatible DNR rules.
 *
 * Rules that cannot be accurately converted are SKIPPED and REPORTED —
 * they are NEVER silently converted with changed meaning.
 *
 * Element-hide rules are NOT converted to DNR (they require content scripts).
 * They are collected separately for content script injection.
 */

import type {
  ParseResult,
  ParsedNetworkRule,
  ResourceType,
} from './types.js';

// ─── DNR Types (subset of Chrome/Safari declarativeNetRequest) ────────────────

export type DnrActionType = 'block' | 'allow' | 'allowAllRequests' | 'redirect' | 'modifyHeaders';

export interface DnrCondition {
  urlFilter?: string;
  regexFilter?: string;
  isUrlFilterCaseSensitive?: boolean;
  resourceTypes?: string[];
  domainType?: 'firstParty' | 'thirdParty';
  initiatorDomains?: string[];
  excludedInitiatorDomains?: string[];
  requestDomains?: string[];
}

export interface DnrAction {
  type: DnrActionType;
}

export interface DnrRule {
  id: number;
  priority: number;
  action: DnrAction;
  condition: DnrCondition;
  // For debugging: original filter text (not part of DNR spec, stripped before packaging)
  _comment?: string;
}

// ─── Conversion Result ────────────────────────────────────────────────────────

export interface ConversionResult {
  rules: DnrRule[];
  elementHideSelectors: ElementHideEntry[];
  skipped: SkippedRule[];
  stats: ConversionStats;
}

export interface ElementHideEntry {
  selector: string;
  domains: string[];      // Empty = all domains
  isException: boolean;
}

export interface SkippedRule {
  raw: string;
  lineNumber: number;
  reason: string;
}

export interface ConversionStats {
  inputNetworkRules: number;
  convertedBlock: number;
  convertedAllow: number;
  elementHideCollected: number;
  skipped: number;
  duplicatesRemoved: number;
}

// ─── Priority Mapping ─────────────────────────────────────────────────────────

const PRIORITY_ALLOW = 900;        // Allow rules (@@) override block
const PRIORITY_BLOCK_IMPORTANT = 500; // $important block rules
const PRIORITY_BLOCK = 100;        // Normal block rules

// ─── Resource Type Mapping ────────────────────────────────────────────────────

const RESOURCE_TYPE_TO_DNR: Record<ResourceType, string> = {
  script: 'script',
  image: 'image',
  stylesheet: 'stylesheet',
  object: 'object',
  xmlhttprequest: 'xmlhttprequest',
  other: 'other',
  sub_frame: 'sub_frame',
  websocket: 'websocket',
  media: 'media',
  font: 'font',
  ping: 'ping',
};

// ─── ID Generator ─────────────────────────────────────────────────────────────

let nextId = 1;

function resetIdCounter(start = 1): void {
  nextId = start;
}

function getNextId(): number {
  return nextId++;
}

// ─── Network Rule Converter ───────────────────────────────────────────────────

function convertNetworkRule(
  rule: ParsedNetworkRule,
  skipped: SkippedRule[],
): DnrRule | null {
  const condition: DnrCondition = {};

  // URL filter or regex filter
  if (rule.isRegex) {
    condition.regexFilter = rule.urlFilter;
    condition.isUrlFilterCaseSensitive = false;
  } else {
    const urlFilter = rule.urlFilter;

    if (!urlFilter || urlFilter === '*') {
      skipped.push({ raw: rule.raw, lineNumber: rule.lineNumber, reason: 'Empty or wildcard-only url filter' });
      return null;
    }

    condition.urlFilter = urlFilter;
    condition.isUrlFilterCaseSensitive = false;
  }

  // Domain type
  if (rule.options.thirdParty) {
    condition.domainType = 'thirdParty';
  } else if (rule.options.firstParty) {
    condition.domainType = 'firstParty';
  }

  // Resource types
  if (rule.options.resourceTypes && rule.options.resourceTypes.length > 0) {
    condition.resourceTypes = rule.options.resourceTypes.map((t) => RESOURCE_TYPE_TO_DNR[t]);
  }

  // Initiator domains ($domain= modifier)
  if (rule.options.domains && rule.options.domains.length > 0) {
    condition.initiatorDomains = rule.options.domains;
  }
  if (rule.options.notDomains && rule.options.notDomains.length > 0) {
    condition.excludedInitiatorDomains = rule.options.notDomains;
  }

  const isAllow = rule.kind === 'network-allow';
  const priority = isAllow
    ? PRIORITY_ALLOW
    : rule.options.important
    ? PRIORITY_BLOCK_IMPORTANT
    : PRIORITY_BLOCK;

  return {
    id: getNextId(),
    priority,
    action: { type: isAllow ? 'allow' : 'block' },
    condition,
    _comment: rule.raw,
  };
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

function deduplicateRules(rules: DnrRule[]): { rules: DnrRule[]; removed: number } {
  const seen = new Set<string>();
  const deduped: DnrRule[] = [];
  let removed = 0;

  for (const rule of rules) {
    // Fingerprint: action + urlFilter/regexFilter + domainType + resourceTypes
    const fingerprint = JSON.stringify({
      action: rule.action.type,
      urlFilter: rule.condition.urlFilter,
      regexFilter: rule.condition.regexFilter,
      domainType: rule.condition.domainType,
      resourceTypes: rule.condition.resourceTypes?.sort(),
      initiatorDomains: rule.condition.initiatorDomains?.sort(),
    });

    if (seen.has(fingerprint)) {
      removed++;
    } else {
      seen.add(fingerprint);
      deduped.push(rule);
    }
  }

  return { rules: deduped, removed };
}

// ─── Main Converter ───────────────────────────────────────────────────────────

export function convert(parseResult: ParseResult, idStart = 1): ConversionResult {
  resetIdCounter(idStart);

  const dnrRules: DnrRule[] = [];
  const elementHideSelectors: ElementHideEntry[] = [];
  const skipped: SkippedRule[] = [];

  const stats: ConversionStats = {
    inputNetworkRules: 0,
    convertedBlock: 0,
    convertedAllow: 0,
    elementHideCollected: 0,
    skipped: 0,
    duplicatesRemoved: 0,
  };

  for (const rule of parseResult.rules) {
    switch (rule.kind) {
      case 'network-block':
      case 'network-allow': {
        stats.inputNetworkRules++;
        const dnrRule = convertNetworkRule(rule, skipped);
        if (dnrRule) {
          dnrRules.push(dnrRule);
          if (rule.kind === 'network-block') stats.convertedBlock++;
          else stats.convertedAllow++;
        } else {
          stats.skipped++;
        }
        break;
      }

      case 'element-hide':
      case 'element-hide-exception': {
        elementHideSelectors.push({
          selector: rule.selector,
          domains: rule.domains,
          isException: rule.kind === 'element-hide-exception',
        });
        stats.elementHideCollected++;
        break;
      }

      case 'unsupported': {
        skipped.push({
          raw: rule.raw,
          lineNumber: rule.lineNumber,
          reason: rule.reason,
        });
        stats.skipped++;
        break;
      }

      case 'comment':
      case 'metadata':
        // No conversion needed
        break;
    }
  }

  // Deduplicate
  const { rules: deduped, removed } = deduplicateRules(dnrRules);
  stats.duplicatesRemoved = removed;

  return {
    rules: deduped,
    elementHideSelectors,
    skipped,
    stats,
  };
}

/**
 * Strip debug comments (_comment field) from rules before packaging for DNR.
 * The DNR spec does not include a comment field.
 */
export function stripDebugComments(rules: DnrRule[]): Omit<DnrRule, '_comment'>[] {
  return rules.map(({ _comment: _c, ...rest }) => rest);
}
