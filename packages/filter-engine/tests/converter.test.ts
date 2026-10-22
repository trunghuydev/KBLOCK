// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { convert, stripDebugComments } from '../src/converter.js';

// ─── Basic DNR Output ─────────────────────────────────────────────────────────

describe('Converter — Basic DNR output', () => {
  it('converts a block rule to DNR', () => {
    const parsed = parse('||ads.example.com^');
    const result = convert(parsed);

    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].action.type).toBe('block');
    expect(result.rules[0].condition.urlFilter).toBe('||ads.example.com^');
    expect(result.rules[0].priority).toBe(100);
  });

  it('converts an allow rule with higher priority than block', () => {
    const parsed = parse('@@||cdn.example.com^');
    const result = convert(parsed);

    expect(result.rules[0].action.type).toBe('allow');
    expect(result.rules[0].priority).toBeGreaterThan(100); // Higher than block priority
  });

  it('$important rules get elevated priority', () => {
    const parsed = parse('||tracker.example.com^$important');
    const result = convert(parsed);

    expect(result.rules[0].priority).toBeGreaterThan(100);
    expect(result.rules[0].priority).toBeLessThan(900); // Less than allow priority
  });

  it('assigns sequential IDs starting from idStart', () => {
    const parsed = parse('||a.com^\n||b.com^\n||c.com^');
    const result = convert(parsed, 500);

    expect(result.rules[0].id).toBe(500);
    expect(result.rules[1].id).toBe(501);
    expect(result.rules[2].id).toBe(502);
  });
});

// ─── Resource Types ───────────────────────────────────────────────────────────

describe('Converter — Resource types', () => {
  it('maps $script to DNR resourceTypes', () => {
    const parsed = parse('||ads.com^$script');
    const result = convert(parsed);

    expect(result.rules[0].condition.resourceTypes).toContain('script');
  });

  it('maps multiple resource types', () => {
    const parsed = parse('||ads.com^$script,image,xmlhttprequest');
    const result = convert(parsed);

    const types = result.rules[0].condition.resourceTypes ?? [];
    expect(types).toContain('script');
    expect(types).toContain('image');
    expect(types).toContain('xmlhttprequest');
  });
});

// ─── Domain Conditions ────────────────────────────────────────────────────────

describe('Converter — Domain conditions', () => {
  it('maps $third-party to domainType', () => {
    const parsed = parse('||ads.com^$third-party');
    const result = convert(parsed);

    expect(result.rules[0].condition.domainType).toBe('thirdParty');
  });

  it('maps $domain= to initiatorDomains', () => {
    const parsed = parse('||ads.com^$domain=site.com');
    const result = convert(parsed);

    expect(result.rules[0].condition.initiatorDomains).toContain('site.com');
  });

  it('maps ~domain= to excludedInitiatorDomains', () => {
    const parsed = parse('||ads.com^$domain=~other.com');
    const result = convert(parsed);

    expect(result.rules[0].condition.excludedInitiatorDomains).toContain('other.com');
  });
});

// ─── Element Hide (not converted to DNR) ─────────────────────────────────────

describe('Converter — Element hide rules', () => {
  it('collects element hide rules separately (not DNR)', () => {
    const parsed = parse('example.com##.ad-banner');
    const result = convert(parsed);

    expect(result.rules).toHaveLength(0); // Not added to DNR
    expect(result.elementHideSelectors).toHaveLength(1);
    expect(result.elementHideSelectors[0].selector).toBe('.ad-banner');
    expect(result.elementHideSelectors[0].domains).toContain('example.com');
  });

  it('marks element hide exceptions correctly', () => {
    const parsed = parse('example.com#@#.ad-banner');
    const result = convert(parsed);

    expect(result.elementHideSelectors[0].isException).toBe(true);
  });
});

// ─── Unsupported Rules ────────────────────────────────────────────────────────

describe('Converter — Unsupported rules are skipped and reported', () => {
  it('skips scriptlet injection and adds to skipped list', () => {
    const parsed = parse('example.com##+js(test)');
    const result = convert(parsed);

    expect(result.rules).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toBe('script-injection');
  });

  it('skips $redirect rules', () => {
    const parsed = parse('||ads.com^$redirect=blank-mp3');
    const result = convert(parsed);

    expect(result.rules).toHaveLength(0);
    expect(result.skipped.length).toBeGreaterThan(0);
  });

  it('does not crash on 100% unsupported input', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `example${i}.com##+js(test)`).join('\n');
    const parsed = parse(lines);
    expect(() => convert(parsed)).not.toThrow();
    const result = convert(parsed);
    expect(result.rules).toHaveLength(0);
    expect(result.skipped.length).toBeGreaterThan(0);
  });
});

// ─── Deduplication ────────────────────────────────────────────────────────────

describe('Converter — Deduplication', () => {
  it('removes exact duplicate rules', () => {
    const input = '||ads.com^\n||ads.com^';
    const parsed = parse(input);
    const result = convert(parsed);

    expect(result.rules).toHaveLength(1);
    expect(result.stats.duplicatesRemoved).toBe(1);
  });

  it('keeps rules that differ only in resource type', () => {
    const input = '||ads.com^$script\n||ads.com^$image';
    const parsed = parse(input);
    const result = convert(parsed);

    expect(result.rules).toHaveLength(2);
    expect(result.stats.duplicatesRemoved).toBe(0);
  });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

describe('Converter — Stats accuracy', () => {
  it('reports correct conversion stats', () => {
    const input = [
      '||block.com^',           // block
      '@@||allow.com^',         // allow
      '##.hide-me',             // element-hide
      'x##+js(test)',           // skipped (scriptlet)
    ].join('\n');

    const parsed = parse(input);
    const result = convert(parsed);

    expect(result.stats.convertedBlock).toBe(1);
    expect(result.stats.convertedAllow).toBe(1);
    expect(result.stats.elementHideCollected).toBe(1);
    expect(result.stats.skipped).toBeGreaterThan(0);
  });
});

// ─── stripDebugComments ───────────────────────────────────────────────────────

describe('Converter — stripDebugComments', () => {
  it('removes _comment from rules before packaging', () => {
    const parsed = parse('||ads.com^');
    const result = convert(parsed);
    const stripped = stripDebugComments(result.rules);

    expect('_comment' in stripped[0]).toBe(false);
    expect(stripped[0].action).toBeDefined();
    expect(stripped[0].condition).toBeDefined();
  });
});
