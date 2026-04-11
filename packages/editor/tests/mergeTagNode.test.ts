import './dom-stubs';

import { describe, expect, it, vi } from 'vitest';
import { SYNTAX_PRESETS } from '@templatical/types';

// Mock .vue imports to avoid needing @vitejs/plugin-vue in tests
vi.mock('../src/extensions/MergeTagNodeView.vue', () => ({ default: {} }));

import { MergeTagNode } from '../src/extensions/MergeTagNode';

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
    it('liquid value regex source is a valid pattern string', () => {
      // Verify the regex pattern is a non-empty string that compiles
      expect(liquidValue.source).toMatch(/\{/);
      expect(new RegExp(liquidValue.source)).toBeInstanceOf(RegExp);
    });

    it('parseHTML targets span[data-merge-tag]', () => {
      const rules = (MergeTagNode.config.parseHTML as Function).call({});
      expect(rules[0].tag).toBe('span[data-merge-tag]');
    });
  });
});

describe('MergeTagNode extension config', () => {
  it('has name "mergeTagNode"', () => {
    expect(MergeTagNode.config.name).toBe('mergeTagNode');
  });

  it('has group "inline"', () => {
    expect(MergeTagNode.config.group).toBe('inline');
  });

  it('is inline', () => {
    expect(MergeTagNode.config.inline).toBe(true);
  });

  it('is atom', () => {
    expect(MergeTagNode.config.atom).toBe(true);
  });

  it('addAttributes returns label and value with default empty strings and parseHTML extractors', () => {
    const attrs = (MergeTagNode.config.addAttributes as Function).call({});
    expect(attrs.label.default).toBe('');
    expect(attrs.label.parseHTML).toEqual(expect.any(Function));
    expect(attrs.value.default).toBe('');
    expect(attrs.value.parseHTML).toEqual(expect.any(Function));
  });

  it('parseHTML returns array with tag span[data-merge-tag]', () => {
    const rules = (MergeTagNode.config.parseHTML as Function).call({});
    expect(Array.isArray(rules)).toBe(true);
    expect(rules).toHaveLength(1);
    expect(rules[0].tag).toBe('span[data-merge-tag]');
  });

  it('addCommands has insertMergeTag command', () => {
    const commands = (MergeTagNode.config.addCommands as Function).call({ name: 'mergeTagNode' });
    expect(commands).toHaveProperty('insertMergeTag');
    expect(commands.insertMergeTag).toEqual(expect.any(Function));
  });

  it('default options use liquid syntax', () => {
    const options = (MergeTagNode.config.addOptions as Function).call({});
    expect(options.syntax).toEqual(SYNTAX_PRESETS.liquid);
    expect(options.mergeTags).toEqual([]);
  });
});

describe('MergeTagNode source structure', () => {
  const { readFileSync } = require('node:fs');
  const { resolve } = require('node:path');
  const src = readFileSync(
    resolve(__dirname, '../src/extensions/MergeTagNode.ts'),
    'utf-8',
  );

  it('imports isNodeSelected from shared module', () => {
    expect(src).toContain('import { isNodeSelected } from "./isNodeSelected"');
    expect(src).not.toContain('const isMergeTagSelected');
  });

  it('uses renderVueNodeView wrapper instead of direct VueNodeViewRenderer cast', () => {
    expect(src).toContain('import { renderVueNodeView } from "./renderVueNodeView"');
    expect(src).toContain('renderVueNodeView(MergeTagNodeView)');
    expect(src).not.toContain('as any');
  });
});

describe('MergeTagNode addAttributes parseHTML', () => {
  const attrs = (MergeTagNode.config.addAttributes as Function).call({});

  describe('label parseHTML', () => {
    it('extracts data-label attribute from element', () => {
      const element = {
        getAttribute: (name: string) =>
          name === 'data-label' ? 'First Name' : null,
        textContent: 'fallback',
      };
      expect(attrs.label.parseHTML(element)).toBe('First Name');
    });

    it('falls back to textContent when data-label is missing', () => {
      const element = {
        getAttribute: () => null,
        textContent: 'Text Fallback',
      };
      expect(attrs.label.parseHTML(element)).toBe('Text Fallback');
    });

    it('returns empty string when both data-label and textContent are empty', () => {
      const element = {
        getAttribute: () => '',
        textContent: '',
      };
      expect(attrs.label.parseHTML(element)).toBe('');
    });

    it('prefers data-label over textContent', () => {
      const element = {
        getAttribute: (name: string) =>
          name === 'data-label' ? 'Label' : null,
        textContent: 'Content',
      };
      expect(attrs.label.parseHTML(element)).toBe('Label');
    });
  });

  describe('value parseHTML', () => {
    it('extracts data-merge-tag attribute from element', () => {
      const element = {
        getAttribute: (name: string) =>
          name === 'data-merge-tag' ? '{{ first_name }}' : null,
      };
      expect(attrs.value.parseHTML(element)).toBe('{{ first_name }}');
    });

    it('returns empty string when data-merge-tag is missing', () => {
      const element = {
        getAttribute: () => null,
      };
      expect(attrs.value.parseHTML(element)).toBe('');
    });

    it('returns empty string when data-merge-tag is empty', () => {
      const element = {
        getAttribute: () => '',
      };
      expect(attrs.value.parseHTML(element)).toBe('');
    });
  });
});

describe('MergeTagNode renderHTML', () => {
  const renderHTML = MergeTagNode.config.renderHTML as Function;

  it('renders span with data-merge-tag and data-label using found merge tag label', () => {
    const mergeTags = [
      { label: 'First Name', value: '{{ first_name }}' },
      { label: 'Email', value: '{{ email }}' },
    ];
    const context = {
      node: { attrs: { value: '{{ first_name }}', label: '' } },
      HTMLAttributes: {},
    };
    const result = renderHTML.call(
      { options: { mergeTags } },
      context,
    );
    expect(result[0]).toBe('span');
    expect(result[1]['data-merge-tag']).toBe('{{ first_name }}');
    expect(result[1]['data-label']).toBe('First Name');
    expect(result[2]).toBe('First Name');
  });

  it('uses value as label when merge tag is not found in mergeTags list', () => {
    const context = {
      node: { attrs: { value: '{{ unknown }}', label: '' } },
      HTMLAttributes: {},
    };
    const result = renderHTML.call(
      { options: { mergeTags: [] } },
      context,
    );
    expect(result[1]['data-merge-tag']).toBe('{{ unknown }}');
    expect(result[1]['data-label']).toBe('{{ unknown }}');
    expect(result[2]).toBe('{{ unknown }}');
  });

  it('merges HTMLAttributes into the output', () => {
    const context = {
      node: { attrs: { value: '{{ name }}', label: '' } },
      HTMLAttributes: { class: 'custom-class', id: 'tag-1' },
    };
    const result = renderHTML.call(
      { options: { mergeTags: [] } },
      context,
    );
    expect(result[1].class).toBe('custom-class');
    expect(result[1].id).toBe('tag-1');
    expect(result[1]['data-merge-tag']).toBe('{{ name }}');
  });
});

describe('MergeTagNode addCommands', () => {
  it('insertMergeTag calls commands.insertContent with correct type and attrs', () => {
    const commands = (MergeTagNode.config.addCommands as Function).call({
      name: 'mergeTagNode',
    });
    const mergeTag = { label: 'First Name', value: '{{ first_name }}' };
    const mockInsertContent = vi.fn().mockReturnValue(true);
    const result = commands.insertMergeTag(mergeTag)({
      commands: { insertContent: mockInsertContent },
    });
    expect(mockInsertContent).toHaveBeenCalledWith({
      type: 'mergeTagNode',
      attrs: mergeTag,
    });
    expect(result).toBe(true);
  });
});

describe('MergeTagNode addKeyboardShortcuts', () => {
  it('registers Backspace and Delete shortcuts', () => {
    const shortcuts = (MergeTagNode.config.addKeyboardShortcuts as Function).call({
      editor: {},
      name: 'mergeTagNode',
    });
    expect(shortcuts).toHaveProperty('Backspace');
    expect(shortcuts).toHaveProperty('Delete');
    expect(shortcuts.Backspace).toEqual(expect.any(Function));
    expect(shortcuts.Delete).toEqual(expect.any(Function));
  });
});

describe('MergeTagNode addInputRules', () => {
  it('returns an array with one input rule', () => {
    const rules = (MergeTagNode.config.addInputRules as Function).call({
      options: { syntax: SYNTAX_PRESETS.liquid, mergeTags: [] },
      type: { create: vi.fn() },
    });
    expect(rules).toHaveLength(1);
  });
});

describe('MergeTagNode addPasteRules', () => {
  it('returns an array with one paste rule', () => {
    const rules = (MergeTagNode.config.addPasteRules as Function).call({
      options: { syntax: SYNTAX_PRESETS.liquid, mergeTags: [] },
      type: { create: vi.fn() },
    });
    expect(rules).toHaveLength(1);
  });
});
