// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import './dom-stubs';

import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type { MergeTag } from '@templatical/types';
import {
  MergeTagSuggestion,
  filterMergeTags,
  handleSuggestionKeyDown,
} from '../src/extensions/MergeTagSuggestion';

const sampleTags: MergeTag[] = [
  { label: 'First Name', value: '{{first_name}}' },
  { label: 'Last Name', value: '{{last_name}}' },
  { label: 'Email', value: '{{email}}' },
  { label: 'Company', value: '{{company}}' },
  { label: 'City', value: '{{city}}' },
];

describe('filterMergeTags', () => {
  it('returns all tags (capped) when query is empty', () => {
    const result = filterMergeTags(sampleTags, '');
    expect(result).toHaveLength(5);
    expect(result[0].value).toBe('{{first_name}}');
  });

  it('caps results at 10', () => {
    const many: MergeTag[] = Array.from({ length: 15 }, (_, i) => ({
      label: `Tag ${i}`,
      value: `{{tag_${i}}}`,
    }));
    const result = filterMergeTags(many, '');
    expect(result).toHaveLength(10);
  });

  it('matches label case-insensitively', () => {
    const result = filterMergeTags(sampleTags, 'FIRST');
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('{{first_name}}');
  });

  it('matches value case-insensitively', () => {
    const result = filterMergeTags(sampleTags, 'first_name');
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('First Name');
  });

  it('returns empty array when no match', () => {
    const result = filterMergeTags(sampleTags, 'zzzz');
    expect(result).toEqual([]);
  });

  it('trims whitespace before matching', () => {
    const result = filterMergeTags(sampleTags, '  email  ');
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('{{email}}');
  });

  it('treats query as plain string (no regex injection)', () => {
    const tags: MergeTag[] = [{ label: 'a.b', value: '{{a.b}}' }];
    const result = filterMergeTags(tags, '.*');
    expect(result).toEqual([]);
  });

  it('does not throw with regex special chars in query', () => {
    const result = filterMergeTags(sampleTags, '(*)');
    expect(result).toEqual([]);
  });

  it('matches when query appears anywhere in label', () => {
    const result = filterMergeTags(sampleTags, 'name');
    expect(result.map((t) => t.value)).toEqual([
      '{{first_name}}',
      '{{last_name}}',
    ]);
  });

  it('returns empty array for empty input list', () => {
    expect(filterMergeTags([], 'anything')).toEqual([]);
    expect(filterMergeTags([], '')).toEqual([]);
  });
});

describe('handleSuggestionKeyDown', () => {
  function makeKey(key: string): KeyboardEvent {
    return { key } as KeyboardEvent;
  }

  it('returns false for non-handled key', () => {
    const selected = ref(0);
    const onSelect = vi.fn();
    const handled = handleSuggestionKeyDown(
      makeKey('a'),
      sampleTags,
      selected,
      onSelect,
    );
    expect(handled).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ArrowDown advances selection', () => {
    const selected = ref(0);
    const handled = handleSuggestionKeyDown(
      makeKey('ArrowDown'),
      sampleTags,
      selected,
      vi.fn(),
    );
    expect(handled).toBe(true);
    expect(selected.value).toBe(1);
  });

  it('ArrowDown wraps from last to first', () => {
    const selected = ref(sampleTags.length - 1);
    handleSuggestionKeyDown(
      makeKey('ArrowDown'),
      sampleTags,
      selected,
      vi.fn(),
    );
    expect(selected.value).toBe(0);
  });

  it('ArrowUp decrements selection', () => {
    const selected = ref(2);
    handleSuggestionKeyDown(
      makeKey('ArrowUp'),
      sampleTags,
      selected,
      vi.fn(),
    );
    expect(selected.value).toBe(1);
  });

  it('ArrowUp wraps from first to last', () => {
    const selected = ref(0);
    handleSuggestionKeyDown(
      makeKey('ArrowUp'),
      sampleTags,
      selected,
      vi.fn(),
    );
    expect(selected.value).toBe(sampleTags.length - 1);
  });

  it('Enter calls onSelect with current item', () => {
    const selected = ref(2);
    const onSelect = vi.fn();
    const handled = handleSuggestionKeyDown(
      makeKey('Enter'),
      sampleTags,
      selected,
      onSelect,
    );
    expect(handled).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(sampleTags[2]);
  });

  it('Tab acts like Enter', () => {
    const selected = ref(0);
    const onSelect = vi.fn();
    handleSuggestionKeyDown(
      makeKey('Tab'),
      sampleTags,
      selected,
      onSelect,
    );
    expect(onSelect).toHaveBeenCalledWith(sampleTags[0]);
  });

  it('Enter on empty list does not call onSelect but is handled', () => {
    const selected = ref(0);
    const onSelect = vi.fn();
    const handled = handleSuggestionKeyDown(
      makeKey('Enter'),
      [],
      selected,
      onSelect,
    );
    expect(handled).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ArrowDown on empty list returns false', () => {
    const selected = ref(0);
    const handled = handleSuggestionKeyDown(
      makeKey('ArrowDown'),
      [],
      selected,
      vi.fn(),
    );
    expect(handled).toBe(false);
  });
});

describe('MergeTagSuggestion mount target', () => {
  // Regression: popup must mount OUTSIDE the Canvas (which applies
  // `filter` in dark mode — that creates a containing block for
  // position: fixed descendants and offsets the popup). Mounting at
  // the theme root keeps CSS vars cascading without sitting inside the
  // filter scope. Click-outside teardown is handled separately by
  // mousedown.prevent.stop on the options.
  it('source prefers [data-tpl-theme] over .tpl-text-editor-wrapper', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      'src/extensions/MergeTagSuggestion.ts',
      'utf8',
    );
    const wrapperIdx = src.indexOf('.tpl-text-editor-wrapper');
    const themeIdx = src.indexOf('[data-tpl-theme]');
    expect(wrapperIdx).toBeGreaterThan(-1);
    expect(themeIdx).toBeGreaterThan(-1);
    expect(themeIdx).toBeLessThan(wrapperIdx);
  });

  // Regression: useRichTextEditor doesn't pass `element` to the TipTap
  // editor constructor, so editor.options.element is a detached node.
  // closest('.tpl-text-editor-wrapper') on a detached node returns null
  // and the popup falls back to document.body, breaking the click-outside
  // guard. Must use editor.view.dom (the actual mounted ProseMirror node).
  it('source uses editor.view.dom (not options.element) to find mount target', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      'src/extensions/MergeTagSuggestion.ts',
      'utf8',
    );
    expect(src).toContain('editor.view');
    expect(src).toContain('.dom');
    expect(src).not.toContain('editor.options.element');
  });
});

describe('MergeTagSuggestion extension ordering in editors', () => {
  // The suggestion plugin's command calls editor.commands.insertMergeTag,
  // which is registered by MergeTagNode. If MergeTagSuggestion appears
  // before MergeTagNode in the extensions array, TipTap may not have
  // registered the command yet on first run. Guard the order in source.
  function assertOrder(source: string, file: string): void {
    const nodeIdx = source.indexOf('MergeTagNode.configure');
    const suggIdx = source.indexOf('MergeTagSuggestion.configure');
    expect(nodeIdx, `${file}: MergeTagNode.configure missing`).toBeGreaterThan(
      -1,
    );
    expect(
      suggIdx,
      `${file}: MergeTagSuggestion.configure missing`,
    ).toBeGreaterThan(-1);
    expect(
      nodeIdx,
      `${file}: MergeTagNode must be configured before MergeTagSuggestion`,
    ).toBeLessThan(suggIdx);
  }

  it('ParagraphEditor configures MergeTagNode before MergeTagSuggestion', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      'src/components/blocks/ParagraphEditor.vue',
      'utf8',
    );
    assertOrder(src, 'ParagraphEditor.vue');
  });

  it('TitleEditor configures MergeTagNode before MergeTagSuggestion', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      'src/components/blocks/TitleEditor.vue',
      'utf8',
    );
    assertOrder(src, 'TitleEditor.vue');
  });
});

describe('MergeTagSuggestion prefix-prefix behavior', () => {
  // Regression: the @tiptap/suggestion default `allowedPrefixes: [" "]`
  // requires whitespace or line-start before the trigger. Typing `.{{` (no
  // space between the period and the trigger) does NOT fire the suggestion.
  // Our config must set `allowedPrefixes: null` so any preceding char works.
  it('source sets allowedPrefixes to null', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      'src/extensions/MergeTagSuggestion.ts',
      'utf8',
    );
    expect(src).toContain('allowedPrefixes: null');
  });
});

describe('MergeTagSuggestion extension', () => {
  it('has correct name', () => {
    expect(MergeTagSuggestion.name).toBe('mergeTagSuggestion');
  });

  it('exposes default options', () => {
    const ext = MergeTagSuggestion.configure({});
    expect(ext.options.mergeTags).toEqual([]);
    expect(ext.options.char).toBe('{{');
    expect(ext.options.emptyText).toBe('No matching merge tags');
  });

  it('accepts configuration', () => {
    const ext = MergeTagSuggestion.configure({
      mergeTags: sampleTags,
      char: '*|',
      emptyText: 'Nothing',
    });
    expect(ext.options.mergeTags).toEqual(sampleTags);
    expect(ext.options.char).toBe('*|');
    expect(ext.options.emptyText).toBe('Nothing');
  });

  it('configures different trigger chars per syntax', () => {
    const liquid = MergeTagSuggestion.configure({ char: '{{' });
    const mailchimp = MergeTagSuggestion.configure({ char: '*|' });
    const ampscript = MergeTagSuggestion.configure({ char: '%%=' });

    expect(liquid.options.char).toBe('{{');
    expect(mailchimp.options.char).toBe('*|');
    expect(ampscript.options.char).toBe('%%=');
  });
});
