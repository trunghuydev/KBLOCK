// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';

// ─── Basic Network Rules ──────────────────────────────────────────────────────

describe('Parser — Network block rules', () => {
  it('parses a basic domain block rule', () => {
    const result = parse('||example.com^');
    const rule = result.rules[0];
    expect(rule.kind).toBe('network-block');
    if (rule.kind === 'network-block') {
      expect(rule.urlFilter).toBe('||example.com^');
      expect(rule.isRegex).toBe(false);
      expect(rule.options).toEqual({});
    }
  });

  it('parses a rule with $third-party option', () => {
    const result = parse('||ads.example.com^$third-party');
    const rule = result.rules[0];
    expect(rule.kind).toBe('network-block');
    if (rule.kind === 'network-block') {
      expect(rule.options.thirdParty).toBe(true);
    }
  });

  it('parses a rule with resource type options', () => {
    const result = parse('||ad.example.com^$script,image');
    const rule = result.rules[0];
    expect(rule.kind).toBe('network-block');
    if (rule.kind === 'network-block') {
      expect(rule.options.resourceTypes).toContain('script');
      expect(rule.options.resourceTypes).toContain('image');
    }
  });

  it('parses a rule with $domain= modifier', () => {
    const result = parse('||ads.example.com^$domain=site.com|~other.com');
    const rule = result.rules[0];
    expect(rule.kind).toBe('network-block');
    if (rule.kind === 'network-block') {
      expect(rule.options.domains).toContain('site.com');
      expect(rule.options.notDomains).toContain('other.com');
    }
  });

  it('parses $important modifier', () => {
    const result = parse('||tracker.example.com^$important');
    const rule = result.rules[0];
    expect(rule.kind).toBe('network-block');
    if (rule.kind === 'network-block') {
      expect(rule.options.important).toBe(true);
    }
  });
});

// ─── Allow Rules ─────────────────────────────────────────────────────────────

describe('Parser — Network allow (whitelist) rules', () => {
  it('parses an allow rule', () => {
    const result = parse('@@||example.com^');
    const rule = result.rules[0];
    expect(rule.kind).toBe('network-allow');
    if (rule.kind === 'network-allow') {
      expect(rule.urlFilter).toBe('||example.com^');
    }
  });

  it('parses an allow rule with options', () => {
    const result = parse('@@||cdn.example.com^$script');
    const rule = result.rules[0];
    expect(rule.kind).toBe('network-allow');
    if (rule.kind === 'network-allow') {
      expect(rule.options.resourceTypes).toContain('script');
    }
  });
});

// ─── Element Hide Rules ───────────────────────────────────────────────────────

describe('Parser — Element hide rules', () => {
  it('parses a global element hide rule', () => {
    const result = parse('##.ad-banner');
    const rule = result.rules[0];
    expect(rule.kind).toBe('element-hide');
    if (rule.kind === 'element-hide') {
      expect(rule.selector).toBe('.ad-banner');
      expect(rule.domains).toEqual([]);
    }
  });

  it('parses a domain-specific element hide rule', () => {
    const result = parse('example.com,site.vn##.quangcao');
    const rule = result.rules[0];
    expect(rule.kind).toBe('element-hide');
    if (rule.kind === 'element-hide') {
      expect(rule.selector).toBe('.quangcao');
      expect(rule.domains).toContain('example.com');
      expect(rule.domains).toContain('site.vn');
    }
  });

  it('parses an element hide exception rule', () => {
    const result = parse('example.com#@#.ad-banner');
    const rule = result.rules[0];
    expect(rule.kind).toBe('element-hide-exception');
  });
});

// ─── Comments & Metadata ──────────────────────────────────────────────────────

describe('Parser — Comments and metadata', () => {
  it('parses a comment line', () => {
    const result = parse('! This is a comment');
    const rule = result.rules[0];
    expect(rule.kind).toBe('comment');
  });

  it('parses filter list metadata', () => {
    const result = parse('! Title: ABPVN\n! Version: 2.0.0\n! Homepage: https://github.com/abpvn/abpvn');
    expect(result.metadata.title).toBe('ABPVN');
    expect(result.metadata.version).toBe('2.0.0');
    expect(result.metadata.homepage).toBe('https://github.com/abpvn/abpvn');
  });
});

// ─── Unsupported Rules ────────────────────────────────────────────────────────

describe('Parser — Unsupported rules (must be reported, not silently skipped)', () => {
  it('reports scriptlet injection as unsupported', () => {
    const result = parse('example.com##+js(hide-if-contains, .ads)');
    const rule = result.rules[0];
    expect(rule.kind).toBe('unsupported');
    if (rule.kind === 'unsupported') {
      expect(rule.reason).toBe('script-injection');
    }
  });

  it('reports $redirect as unsupported', () => {
    const result = parse('||ads.example.com^$redirect=blank-mp3');
    const rule = result.rules[0];
    expect(rule.kind).toBe('unsupported');
    if (rule.kind === 'unsupported') {
      expect(rule.reason).toBe('redirect');
    }
  });

  it('reports $csp as unsupported', () => {
    const result = parse("||example.com^$csp=script-src 'self'");
    const rule = result.rules[0];
    expect(rule.kind).toBe('unsupported');
    if (rule.kind === 'unsupported') {
      expect(rule.reason).toBe('csp');
    }
  });

  it('reports $badfilter as unsupported', () => {
    const result = parse('||ads.example.com^$badfilter');
    const rule = result.rules[0];
    expect(rule.kind).toBe('unsupported');
    if (rule.kind === 'unsupported') {
      expect(rule.reason).toBe('badfilter');
    }
  });

  it('reports extended CSS as unsupported', () => {
    const result = parse('example.com##div:has(.ad)');
    const rule = result.rules[0];
    expect(rule.kind).toBe('unsupported');
    if (rule.kind === 'unsupported') {
      expect(rule.reason).toBe('extended-css');
    }
  });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

describe('Parser — Stats accuracy', () => {
  it('counts all rule types correctly', () => {
    const input = [
      '! Title: Test',            // metadata
      '||block.com^',             // network-block
      '@@||allow.com^',           // network-allow
      '##.ad',                    // element-hide
      'example.com##+js(test)',   // unsupported (scriptlet)
      '! comment',                // comment
    ].join('\n');

    const result = parse(input);
    expect(result.stats.networkBlock).toBe(1);
    expect(result.stats.networkAllow).toBe(1);
    expect(result.stats.elementHide).toBe(1);
    expect(result.stats.unsupported).toBe(1);
    expect(result.stats.totalLines).toBe(6);
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe('Parser — Edge cases and error safety', () => {
  it('handles empty input without throwing', () => {
    expect(() => parse('')).not.toThrow();
    const result = parse('');
    expect(result.rules).toBeDefined();
  });

  it('handles a line with only whitespace', () => {
    const result = parse('   ');
    expect(result.rules[0].kind).toBe('comment'); // treated as empty comment
  });

  it('throws on input exceeding 5MB', () => {
    const huge = 'a'.repeat(6 * 1024 * 1024);
    expect(() => parse(huge)).toThrow(/too large/i);
  });

  it('does not crash on 1000 lines', () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `||example${i}.com^`).join('\n');
    expect(() => parse(lines)).not.toThrow();
    const result = parse(lines);
    expect(result.stats.networkBlock).toBe(1000);
  });
});
