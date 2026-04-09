import './dom-stubs';

import { describe, expect, it, vi } from 'vitest';
import {
  SYNTAX_PRESETS,
  isLogicMergeTagValue,
  getLogicMergeTagKeyword,
} from '@templatical/types';

// Mock .vue imports to avoid needing @vitejs/plugin-vue in tests
vi.mock('../src/extensions/LogicMergeTagNodeView.vue', () => ({ default: {} }));

import { LogicMergeTagNode } from '../src/extensions/LogicMergeTagNode';

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

describe('LogicMergeTagNode extension config', () => {
  it('has name "logicMergeTagNode"', () => {
    expect(LogicMergeTagNode.config.name).toBe('logicMergeTagNode');
  });

  it('has group "inline"', () => {
    expect(LogicMergeTagNode.config.group).toBe('inline');
  });

  it('is inline', () => {
    expect(LogicMergeTagNode.config.inline).toBe(true);
  });

  it('is atom', () => {
    expect(LogicMergeTagNode.config.atom).toBe(true);
  });

  it('addAttributes returns value and keyword with parseHTML extractors', () => {
    const attrs = (LogicMergeTagNode.config.addAttributes as Function).call({});
    expect(attrs.value.default).toBe('');
    expect(typeof attrs.value.parseHTML).toBe('function');
    expect(attrs.keyword.default).toBe('');
    expect(typeof attrs.keyword.parseHTML).toBe('function');
  });

  it('parseHTML returns array with tag span[data-logic-merge-tag]', () => {
    const rules = (LogicMergeTagNode.config.parseHTML as Function).call({});
    expect(Array.isArray(rules)).toBe(true);
    expect(rules).toHaveLength(1);
    expect(rules[0].tag).toBe('span[data-logic-merge-tag]');
  });

  it('default options use liquid syntax', () => {
    const options = (LogicMergeTagNode.config.addOptions as Function).call({});
    expect(options.syntax).toEqual(SYNTAX_PRESETS.liquid);
  });

  it('has no mergeTags in default options (only syntax)', () => {
    const options = (LogicMergeTagNode.config.addOptions as Function).call({});
    expect(Object.keys(options)).toEqual(['syntax']);
  });
});

describe('LogicMergeTagNode source structure', () => {
  const { readFileSync } = require('node:fs');
  const { resolve } = require('node:path');
  const src = readFileSync(
    resolve(__dirname, '../src/extensions/LogicMergeTagNode.ts'),
    'utf-8',
  );

  it('imports isNodeSelected from shared module', () => {
    expect(src).toContain('import { isNodeSelected } from "./isNodeSelected"');
    expect(src).not.toContain('const isLogicMergeTagSelected');
  });

  it('uses renderVueNodeView wrapper instead of direct VueNodeViewRenderer cast', () => {
    expect(src).toContain('import { renderVueNodeView } from "./renderVueNodeView"');
    expect(src).toContain('renderVueNodeView(LogicMergeTagNodeView)');
    expect(src).not.toContain('as any');
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
