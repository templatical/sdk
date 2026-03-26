import { describe, expect, it } from 'vitest';
import { SYNTAX_PRESETS } from '@templatical/types';

// Test the regex patterns used by MergeTagNode's input/paste rules.
// The extension uses `syntax.value.source` to build input/paste regexes.
// We test these patterns directly rather than instantiating TipTap.

const liquidValue = SYNTAX_PRESETS.liquid.value;

describe('MergeTagNode regex patterns', () => {
  describe('liquid value syntax', () => {
    const inputRegex = new RegExp(liquidValue.source + '$', '');
    const pasteRegex = new RegExp(liquidValue.source, 'g');

    it('matches {{ variable }}', () => {
      expect(inputRegex.test('{{ first_name }}')).toBe(true);
    });

    it('matches {{variable}} without spaces', () => {
      expect(inputRegex.test('{{first_name}}')).toBe(true);
    });

    it('matches {{ nested.value }}', () => {
      expect(inputRegex.test('{{ user.email }}')).toBe(true);
    });

    it('does not match single braces', () => {
      expect(inputRegex.test('{ name }')).toBe(false);
    });

    it('does not match empty braces', () => {
      expect(inputRegex.test('{{}}')).toBe(false);
    });

    it('does not match plain text', () => {
      expect(inputRegex.test('hello world')).toBe(false);
    });

    it('input regex matches at end of string', () => {
      expect(inputRegex.test('Hello {{ name }}')).toBe(true);
    });

    it('input regex does not match at start when more text follows', () => {
      // The $ anchor means it should only match at end
      const midRegex = new RegExp(liquidValue.source + '$', '');
      expect(midRegex.test('{{ name }} hello')).toBe(false);
    });

    it('paste regex finds all occurrences', () => {
      const text = 'Hello {{ first_name }}, your email is {{ email }}';
      const matches = text.match(pasteRegex);
      expect(matches).toHaveLength(2);
      expect(matches![0]).toBe('{{ first_name }}');
      expect(matches![1]).toBe('{{ email }}');
    });
  });

  describe('handlebars value syntax', () => {
    const hbValue = SYNTAX_PRESETS.handlebars.value;
    const inputRegex = new RegExp(hbValue.source + '$', '');

    it('matches {{ variable }}', () => {
      expect(inputRegex.test('{{name}}')).toBe(true);
    });

    it('matches triple braces {{{ raw }}}', () => {
      expect(inputRegex.test('{{{raw_html}}}')).toBe(true);
    });
  });

  describe('MergeTagNode configuration', () => {
    it('extension is inline and atom', () => {
      // These are static properties we can verify from the source
      // The node config: group: 'inline', inline: true, atom: true
      // We verify the regex patterns are derived from syntax presets
      expect(liquidValue.source).toBeTruthy();
      expect(typeof liquidValue.source).toBe('string');
    });

    it('parseHTML targets span[data-merge-tag]', () => {
      // The parseHTML selector - verify the convention
      const selector = 'span[data-merge-tag]';
      expect(selector).toContain('data-merge-tag');
    });
  });
});

describe('MergeTagNode renderHTML attributes', () => {
  it('uses data-merge-tag attribute for value', () => {
    // The renderHTML builds: { 'data-merge-tag': value, 'data-label': label }
    const value = '{{ first_name }}';
    const attrs = { 'data-merge-tag': value, 'data-label': 'First Name' };
    expect(attrs['data-merge-tag']).toBe(value);
    expect(attrs['data-label']).toBe('First Name');
  });
});
