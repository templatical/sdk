import { describe, expect, it } from 'vitest';
import {
  SYNTAX_PRESETS,
  isLogicMergeTagValue,
  getLogicMergeTagKeyword,
} from '@templatical/types';

// Test the regex patterns and logic used by LogicMergeTagNode.
// The extension uses `syntax.logic.source` for input/paste rules
// and delegates to isLogicMergeTagValue / getLogicMergeTagKeyword.

const liquidLogic = SYNTAX_PRESETS.liquid.logic;
const liquidSyntax = SYNTAX_PRESETS.liquid;

describe('LogicMergeTagNode regex patterns', () => {
  describe('liquid logic syntax', () => {
    const inputRegex = new RegExp(liquidLogic.source + '$', '');
    const pasteRegex = new RegExp(liquidLogic.source, 'g');

    it('matches {% if condition %}', () => {
      expect(inputRegex.test('{% if show_header %}')).toBe(true);
    });

    it('matches {% endif %}', () => {
      expect(inputRegex.test('{% endif %}')).toBe(true);
    });

    it('matches {% else %}', () => {
      expect(inputRegex.test('{% else %}')).toBe(true);
    });

    it('matches {% for item in list %}', () => {
      expect(inputRegex.test('{% for item in products %}')).toBe(true);
    });

    it('matches {%- trimmed -%}', () => {
      expect(inputRegex.test('{%- if active -%}')).toBe(true);
    });

    it('does not match value syntax {{ }}', () => {
      expect(inputRegex.test('{{ name }}')).toBe(false);
    });

    it('does not match plain text', () => {
      expect(inputRegex.test('hello world')).toBe(false);
    });

    it('paste regex finds all logic tags', () => {
      const text = '{% if active %}Show this{% else %}Hide{% endif %}';
      const matches = text.match(pasteRegex);
      expect(matches).toHaveLength(3);
      expect(matches).toContain('{% if active %}');
      expect(matches).toContain('{% else %}');
      expect(matches).toContain('{% endif %}');
    });
  });

  describe('handlebars logic syntax', () => {
    const hbLogic = SYNTAX_PRESETS.handlebars.logic;
    const inputRegex = new RegExp(hbLogic.source + '$', '');

    it('matches {{#if condition}}', () => {
      expect(inputRegex.test('{{#if show}}')).toBe(true);
    });

    it('matches {{/if}}', () => {
      expect(inputRegex.test('{{/if}}')).toBe(true);
    });

    it('matches {{#each items}}', () => {
      expect(inputRegex.test('{{#each products}}')).toBe(true);
    });
  });
});

describe('isLogicMergeTagValue', () => {
  it('returns true for valid logic tags', () => {
    expect(isLogicMergeTagValue('{% if active %}', liquidSyntax)).toBe(true);
    expect(isLogicMergeTagValue('{% endif %}', liquidSyntax)).toBe(true);
    expect(isLogicMergeTagValue('{% else %}', liquidSyntax)).toBe(true);
    expect(isLogicMergeTagValue('{%- if x -%}', liquidSyntax)).toBe(true);
  });

  it('returns false for value tags', () => {
    expect(isLogicMergeTagValue('{{ name }}', liquidSyntax)).toBe(false);
  });

  it('returns false for plain text', () => {
    expect(isLogicMergeTagValue('hello', liquidSyntax)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isLogicMergeTagValue('', liquidSyntax)).toBe(false);
  });

  it('trims whitespace', () => {
    expect(isLogicMergeTagValue('  {% if x %}  ', liquidSyntax)).toBe(true);
  });
});

describe('getLogicMergeTagKeyword', () => {
  it('extracts keyword from if tag (uppercased)', () => {
    expect(getLogicMergeTagKeyword('{% if active %}', liquidSyntax)).toBe('IF');
  });

  it('extracts keyword from endif tag (uppercased)', () => {
    expect(getLogicMergeTagKeyword('{% endif %}', liquidSyntax)).toBe('ENDIF');
  });

  it('extracts keyword from else tag (uppercased)', () => {
    expect(getLogicMergeTagKeyword('{% else %}', liquidSyntax)).toBe('ELSE');
  });

  it('extracts keyword from for tag (uppercased)', () => {
    expect(getLogicMergeTagKeyword('{% for item in list %}', liquidSyntax)).toBe(
      'FOR',
    );
  });

  it('extracts keyword from trimmed tag (uppercased)', () => {
    expect(getLogicMergeTagKeyword('{%- if active -%}', liquidSyntax)).toBe(
      'IF',
    );
  });

  it('returns original value for non-logic values', () => {
    expect(getLogicMergeTagKeyword('not a tag', liquidSyntax)).toBe('not a tag');
  });
});
