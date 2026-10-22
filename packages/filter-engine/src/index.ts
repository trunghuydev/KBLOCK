// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * @kblock/filter-engine
 *
 * Core engine for parsing EasyList/ABP adblock filter lists and
 * compiling them into Safari DeclarativeNetRequest (DNR) rule structures.
 */

export { parse } from './parser.js';
export { convert, stripDebugComments } from './converter.js';

export type {
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

export type {
  DnrRule,
  DnrCondition,
  DnrAction,
  DnrActionType,
  ConversionResult,
  ElementHideEntry,
  SkippedRule,
  ConversionStats,
} from './converter.js';
