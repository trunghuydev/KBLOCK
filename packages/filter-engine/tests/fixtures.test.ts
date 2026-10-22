// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../src/parser.js';
import { convert } from '../src/converter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Integration — sample-easylist.txt fixture', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'sample-easylist.txt');
  const fixtureContent = fs.readFileSync(fixturePath, 'utf-8');

  it('correctly parses metadata and extracts title/version/license', () => {
    const parsed = parse(fixtureContent);
    expect(parsed.metadata.title).toBe('EasyList Sample for KBlock Tests');
    expect(parsed.metadata.version).toBe('2026102201');
    expect(parsed.metadata.license).toBe('https://creativecommons.org/licenses/by-sa/3.0/');
  });

  it('converts to Safari DNR rules with 100% valid schema', () => {
    const parsed = parse(fixtureContent);
    const result = convert(parsed);

    // Network rules that should be converted
    expect(result.rules.length).toBeGreaterThanOrEqual(5);

    for (const rule of result.rules) {
      expect(typeof rule.id).toBe('number');
      expect(rule.id).toBeGreaterThan(0);
      expect(typeof rule.priority).toBe('number');
      expect(['block', 'allow']).toContain(rule.action.type);
      expect(rule.condition.urlFilter).toBeDefined();
    }

    // Element hide rules collected separately
    expect(result.elementHideSelectors.length).toBeGreaterThanOrEqual(2);

    // Unsupported rules safely reported in skipped list
    expect(result.skipped.length).toBeGreaterThanOrEqual(3);
    const skippedReasons = result.skipped.map((s) => s.reason);
    expect(skippedReasons).toContain('redirect');
    expect(skippedReasons).toContain('script-injection');
    expect(skippedReasons).toContain('extended-css');
  });
});
