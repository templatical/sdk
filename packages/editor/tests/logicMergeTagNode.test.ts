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
    expect(attrs.value.parseHTML).toEqual(expect.any(Function));
    expect(attrs.keyword.default).toBe('');
    expect(attrs.keyword.parseHTML).toEqual(expect.any(Function));
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

describe('LogicMergeTagNode addAttributes parseHTML', () => {
  const attrs = (LogicMergeTagNode.config.addAttributes as Function).call({});

  describe('value parseHTML', () => {
    it('extracts data-logic-merge-tag attribute from element', () => {
      const element = {
        getAttribute: (name: string) =>
          name === 'data-logic-merge-tag' ? '{% if active %}' : null,
        textContent: 'IF',
      };
      expect(attrs.value.parseHTML(element)).toBe('{% if active %}');
    });

    it('returns empty string when data-logic-merge-tag is missing', () => {
      const element = {
        getAttribute: () => null,
        textContent: 'IF',
      };
      expect(attrs.value.parseHTML(element)).toBe('');
    });

    it('returns empty string when data-logic-merge-tag is empty', () => {
      const element = {
        getAttribute: () => '',
        textContent: 'IF',
      };
      expect(attrs.value.parseHTML(element)).toBe('');
    });
  });

  describe('keyword parseHTML', () => {
    it('extracts data-keyword attribute from element', () => {
      const element = {
        getAttribute: (name: string) =>
          name === 'data-keyword' ? 'IF' : null,
        textContent: 'fallback',
      };
      expect(attrs.keyword.parseHTML(element)).toBe('IF');
    });

    it('falls back to textContent when data-keyword is missing', () => {
      const element = {
        getAttribute: () => null,
        textContent: 'ENDIF',
      };
      expect(attrs.keyword.parseHTML(element)).toBe('ENDIF');
    });

    it('returns empty string when both data-keyword and textContent are empty', () => {
      const element = {
        getAttribute: () => '',
        textContent: '',
      };
      expect(attrs.keyword.parseHTML(element)).toBe('');
    });

    it('prefers data-keyword over textContent', () => {
      const element = {
        getAttribute: (name: string) =>
          name === 'data-keyword' ? 'FOR' : null,
        textContent: 'ELSE',
      };
      expect(attrs.keyword.parseHTML(element)).toBe('FOR');
    });
  });
});

describe('LogicMergeTagNode renderHTML', () => {
  const renderHTML = LogicMergeTagNode.config.renderHTML as Function;

  it('renders span with data-logic-merge-tag and keyword for valid logic tag', () => {
    const context = {
      node: { attrs: { value: '{% if active %}', keyword: '' } },
      HTMLAttributes: {},
    };
    const result = renderHTML.call(
      { options: { syntax: SYNTAX_PRESETS.liquid } },
      context,
    );
    expect(result[0]).toBe('span');
    expect(result[1]['data-logic-merge-tag']).toBe('{% if active %}');
    expect(result[1]['data-keyword']).toBe('IF');
    expect(result[2]).toBe('IF');
  });

  it('renders plain span without attributes for invalid logic tag value', () => {
    const context = {
      node: { attrs: { value: 'not a logic tag', keyword: '' } },
      HTMLAttributes: {},
    };
    const result = renderHTML.call(
      { options: { syntax: SYNTAX_PRESETS.liquid } },
      context,
    );
    expect(result[0]).toBe('span');
    expect(result[1]).toEqual({});
    expect(result[2]).toBe('not a logic tag');
  });

  it('renders endif keyword correctly', () => {
    const context = {
      node: { attrs: { value: '{% endif %}', keyword: '' } },
      HTMLAttributes: {},
    };
    const result = renderHTML.call(
      { options: { syntax: SYNTAX_PRESETS.liquid } },
      context,
    );
    expect(result[1]['data-keyword']).toBe('ENDIF');
    expect(result[2]).toBe('ENDIF');
  });

  it('renders else keyword correctly', () => {
    const context = {
      node: { attrs: { value: '{% else %}', keyword: '' } },
      HTMLAttributes: {},
    };
    const result = renderHTML.call(
      { options: { syntax: SYNTAX_PRESETS.liquid } },
      context,
    );
    expect(result[1]['data-keyword']).toBe('ELSE');
    expect(result[2]).toBe('ELSE');
  });

  it('merges HTMLAttributes into the output for valid logic tags', () => {
    const context = {
      node: { attrs: { value: '{% if show %}', keyword: '' } },
      HTMLAttributes: { class: 'logic-tag', id: 'tag-1' },
    };
    const result = renderHTML.call(
      { options: { syntax: SYNTAX_PRESETS.liquid } },
      context,
    );
    expect(result[1].class).toBe('logic-tag');
    expect(result[1].id).toBe('tag-1');
    expect(result[1]['data-logic-merge-tag']).toBe('{% if show %}');
  });

  it('renders for keyword correctly', () => {
    const context = {
      node: { attrs: { value: '{% for item in list %}', keyword: '' } },
      HTMLAttributes: {},
    };
    const result = renderHTML.call(
      { options: { syntax: SYNTAX_PRESETS.liquid } },
      context,
    );
    expect(result[1]['data-keyword']).toBe('FOR');
    expect(result[2]).toBe('FOR');
  });

  it('renders trimmed syntax correctly', () => {
    const context = {
      node: { attrs: { value: '{%- if active -%}', keyword: '' } },
      HTMLAttributes: {},
    };
    const result = renderHTML.call(
      { options: { syntax: SYNTAX_PRESETS.liquid } },
      context,
    );
    expect(result[1]['data-keyword']).toBe('IF');
    expect(result[2]).toBe('IF');
  });
});

describe('LogicMergeTagNode addKeyboardShortcuts', () => {
  it('registers Backspace and Delete shortcuts', () => {
    const shortcuts = (LogicMergeTagNode.config.addKeyboardShortcuts as Function).call({
      editor: {},
      name: 'logicMergeTagNode',
    });
    expect(shortcuts).toHaveProperty('Backspace');
    expect(shortcuts).toHaveProperty('Delete');
    expect(shortcuts.Backspace).toEqual(expect.any(Function));
    expect(shortcuts.Delete).toEqual(expect.any(Function));
  });
});

describe('LogicMergeTagNode addInputRules', () => {
  it('returns an array with one input rule', () => {
    const rules = (LogicMergeTagNode.config.addInputRules as Function).call({
      options: { syntax: SYNTAX_PRESETS.liquid },
      type: { create: vi.fn() },
    });
    expect(rules).toHaveLength(1);
  });
});

describe('LogicMergeTagNode addPasteRules', () => {
  it('returns an array with one paste rule', () => {
    const rules = (LogicMergeTagNode.config.addPasteRules as Function).call({
      options: { syntax: SYNTAX_PRESETS.liquid },
      type: { create: vi.fn() },
    });
    expect(rules).toHaveLength(1);
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
