// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * EasyList / ABP filter syntax types.
 *
 * We define a strict subset of what KBlock supports.
 * Unsupported syntax is NOT silently converted — it is reported and skipped.
 */

// ─── Supported Rule Types ─────────────────────────────────────────────────────

export type ParsedRuleKind =
  | 'network-block'       // ||example.com^
  | 'network-allow'       // @@||example.com^
  | 'element-hide'        // example.com##.ad-banner
  | 'element-hide-exception' // example.com#@#.ad-banner
  | 'comment'             // ! comment
  | 'metadata'            // ! Title: ... / ! Version: ...
  | 'unsupported';        // anything we explicitly skip

// ─── Network Rule AST ─────────────────────────────────────────────────────────

export type ResourceType =
  | 'script'
  | 'image'
  | 'stylesheet'
  | 'object'
  | 'xmlhttprequest'
  | 'other'
  | 'sub_frame'
  | 'websocket'
  | 'media'
  | 'font'
  | 'ping';

export interface NetworkRuleOptions {
  thirdParty?: boolean;        // $third-party / $~third-party
  firstParty?: boolean;        // $first-party
  resourceTypes?: ResourceType[];  // $script, $image, etc.
  domains?: string[];          // $domain=example.com|~other.com
  notDomains?: string[];       // domains prefixed with ~
  important?: boolean;         // $important
}

export interface ParsedNetworkRule {
  kind: 'network-block' | 'network-allow';
  raw: string;                 // Original line, for debugging
  lineNumber: number;
  urlFilter: string;           // The URL pattern (may be regex if wrapped in /)
  isRegex: boolean;
  options: NetworkRuleOptions;
}

// ─── Element Hide Rule AST ────────────────────────────────────────────────────

export interface ParsedElementHideRule {
  kind: 'element-hide' | 'element-hide-exception';
  raw: string;
  lineNumber: number;
  domains: string[];           // Which domains this applies to (empty = all)
  selector: string;            // CSS selector
  isExtended: boolean;         // true if uses :has(), :not(), etc. (often unsupported)
}

// ─── Comment / Metadata ───────────────────────────────────────────────────────

export interface ParsedComment {
  kind: 'comment' | 'metadata';
  raw: string;
  lineNumber: number;
  key?: string;                // For metadata: "Title", "Version", etc.
  value?: string;
}

// ─── Unsupported ──────────────────────────────────────────────────────────────

export interface ParsedUnsupportedRule {
  kind: 'unsupported';
  raw: string;
  lineNumber: number;
  reason: UnsupportedReason;
}

export type UnsupportedReason =
  | 'script-injection'         // ##+js() — scriptlet injection, not allowed
  | 'extended-css'             // :has(), :xpath(), etc.
  | 'redirect'                 // $redirect= — requires redirect resource
  | 'csp'                      // $csp=
  | 'badfilter'                // $badfilter
  | 'popup'                    // $popup, $popunder
  | 'unknown-option'           // Unknown $ modifier
  | 'parse-error'              // Could not parse at all
  | 'regex-too-complex';       // Regex pattern likely to cause performance issues

// ─── Union Type ───────────────────────────────────────────────────────────────

export type ParsedRule =
  | ParsedNetworkRule
  | ParsedElementHideRule
  | ParsedComment
  | ParsedUnsupportedRule;

// ─── Filter List Metadata ─────────────────────────────────────────────────────

export interface FilterListMetadata {
  title?: string;
  version?: string;
  lastModified?: string;
  homepage?: string;
  license?: string;
  description?: string;
}

// ─── Parse Result ─────────────────────────────────────────────────────────────

export interface ParseResult {
  metadata: FilterListMetadata;
  rules: ParsedRule[];
  stats: ParseStats;
}

export interface ParseStats {
  totalLines: number;
  networkBlock: number;
  networkAllow: number;
  elementHide: number;
  comments: number;
  unsupported: number;
  errors: number;
}
