// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, type VueWrapper } from '@vue/test-utils';
import { reactive, shallowRef } from 'vue';
import type { Editor } from '@tiptap/core';
import {
  createParagraphBlock,
  createTitleBlock,
  type MergeTag,
  type ParagraphBlock,
  type SyntaxPreset,
  type TitleBlock,
} from '@templatical/types';
import ParagraphEditor from '../src/components/blocks/ParagraphEditor.vue';
import TitleEditor from '../src/components/blocks/TitleEditor.vue';
import en from '../src/i18n/locales/en';
import {
  EDITOR_KEY,
  MERGE_TAG_SYNTAX_KEY,
  MERGE_TAGS_KEY,
  TRANSLATIONS_KEY,
} from '../src/keys';
import { mountEditor } from './helpers/mount';

/**
 * A tag typed out in full becomes a chip, through the real rich-text editors:
 * real TipTap, the real tag nodes and their Vue node views, and a store whose
 * `updateBlock` feeds the block content back in. Nothing from TipTap is mocked,
 * so a TipTap bump that changes how input rules dispatch — 3.31.4 split them
 * into two, and mounting the chip's node view between them reverted the chip —
 * fails here as well as in apps/playground/e2e/tests/merge-tag-typed.spec.ts.
 *
 * The closing character goes through ProseMirror's `handleTextInput` prop,
 * the entry point a keystroke reaches, with the rest of the token already in
 * the document.
 */

const EDITORS = [
  {
    name: 'ParagraphEditor',
    component: ParagraphEditor,
    block: (content: string): ParagraphBlock => createParagraphBlock({ content }),
  },
  {
    name: 'TitleEditor',
    component: TitleEditor,
    block: (content: string): TitleBlock => createTitleBlock({ content }),
  },
] as const;

const TOKENS = [
  {
    name: 'merge tag',
    typed: '{{first_name}}',
    nodeType: 'mergeTagNode',
    stored: 'span[data-merge-tag]',
    storedAttr: 'data-merge-tag',
  },
  {
    name: 'spaced merge tag',
    typed: '{{ first_name}}',
    nodeType: 'mergeTagNode',
    stored: 'span[data-merge-tag]',
    storedAttr: 'data-merge-tag',
  },
  {
    name: 'logic tag',
    typed: '{% if vip %}',
    nodeType: 'logicMergeTagNode',
    stored: 'span[data-logic-merge-tag]',
    storedAttr: 'data-logic-merge-tag',
  },
] as const;

let wrapper: VueWrapper<any> | null = null;

// Errors Vue catches in watchers and renders. Collected, as an app's own
// handler would, instead of rethrown: a rethrow out of a node view's render
// leaves Vue's renderer mid-flush and every later mount in this file broken.
let vueErrors: unknown[] = [];

afterEach(() => {
  try {
    wrapper?.unmount();
  } finally {
    wrapper = null;
    vueErrors = [];
    document.body.innerHTML = '';
  }
});

async function mountWithStore(
  editorDef: (typeof EDITORS)[number],
  content: string,
  merge: { syntax?: SyntaxPreset; tags?: MergeTag[] } = {},
) {
  const block = reactive(editorDef.block(content));
  const emailEditor = {
    updateBlock: (_id: string, patch: { content: string }) => {
      block.content = patch.content;
    },
  };
  wrapper = mountEditor(editorDef.component, {
    props: { block, toolbarPosition: { top: 0, left: 0 } },
    attachTo: document.body,
    provides: {
      [EDITOR_KEY]: emailEditor,
      [TRANSLATIONS_KEY]: en,
      [MERGE_TAGS_KEY]: shallowRef(
        merge.tags ?? [{ label: 'First Name', value: '{{first_name}}' }],
      ),
      ...(merge.syntax ? { [MERGE_TAG_SYNTAX_KEY]: merge.syntax } : {}),
    },
    global: {
      stubs: { ParagraphToolbar: true, RichTextLinkDialog: true },
      config: {
        errorHandler: (err: unknown) => {
          vueErrors.push(err);
        },
      },
    },
  });

  // Extensions load through a dozen dynamic imports, and TipTap hangs the
  // instance on its root element once constructed. The first mount in a file
  // pays for cold module loads, which took over a second in a full parallel
  // run, so the wait gets most of the 20s test budget.
  const editor = await vi.waitFor(
    () => {
      const dom = wrapper!.find('.ProseMirror');
      const instance = dom.exists()
        ? (dom.element as Element & { editor?: Editor }).editor
        : undefined;
      if (!instance) throw new Error('TipTap editor not constructed yet');
      return instance;
    },
    { timeout: 15_000 },
  );
  return { block, editor };
}

/** Types `text` at the caret the way a keystroke does, input rules included. */
function typeText(editor: Editor, text: string): void {
  const { view } = editor;
  const { from, to } = view.state.selection;
  const handled = view.someProp('handleTextInput', (f) =>
    f(view, from, to, text, () => view.state.tr.insertText(text, from, to)),
  );
  if (!handled) view.dispatch(view.state.tr.insertText(text, from, to));
}

function nodeTypesIn(editor: Editor): string[] {
  const types: string[] = [];
  editor.state.doc.descendants((node) => {
    types.push(node.type.name);
  });
  return types;
}

function storedTags(content: string, selector: string): Element[] {
  const host = document.createElement('div');
  host.innerHTML = content;
  return Array.from(host.querySelectorAll(selector));
}

describe('a tag typed out in full becomes a chip', () => {
  for (const editorDef of EDITORS) {
    for (const token of TOKENS) {
      it(`${editorDef.name}: ${token.name} ${token.typed}`, async () => {
        const head = token.typed.slice(0, -1);
        const { block, editor } = await mountWithStore(
          editorDef,
          `<p>Hello. ${head}</p>`,
        );
        editor.commands.focus('end');

        typeText(editor, token.typed.slice(-1));
        await flushPromises();

        const types = nodeTypesIn(editor);
        expect(types.filter((t) => t === token.nodeType)).toHaveLength(1);
        expect(editor.state.doc.textContent).toBe('Hello. ');

        const stored = storedTags(block.content, token.stored);
        expect(stored).toHaveLength(1);
        expect(stored[0].getAttribute(token.storedAttr)).toBe(token.typed);
        expect(block.content).not.toContain(`Hello. ${token.typed}`);
        expect(vueErrors).toEqual([]);
      });
    }
  }
});

/**
 * A custom syntax whose opener is also its closer. The rich-text popup opens on
 * the declared opener, and the closing `%` turns the token into a chip, which
 * takes the popup down with it: the closer is never read as a new opener here.
 */
describe('an opener that is also the closer', () => {
  const PERCENT: SyntaxPreset = {
    value: /%[A-Z_]+%/g,
    logic: /(?!)/g,
    opener: '%',
    closer: '%',
  };
  const popups = () =>
    document.querySelectorAll('[data-testid="merge-tag-suggestion-popup"]')
      .length;

  for (const editorDef of EDITORS) {
    it(`${editorDef.name}: % opens the popup and the closing % makes a chip`, async () => {
      const { block, editor } = await mountWithStore(
        editorDef,
        '<p>Hello.</p>',
        {
          syntax: PERCENT,
          tags: [{ label: 'First Name', value: '%FIRSTNAME%' }],
        },
      );
      editor.commands.focus('end');

      typeText(editor, ' %');
      await flushPromises();
      expect(popups()).toBe(1);

      for (const char of 'FIRSTNAME') typeText(editor, char);
      await flushPromises();
      expect(popups()).toBe(1);

      typeText(editor, '%');
      await flushPromises();
      expect(popups()).toBe(0);

      const types = nodeTypesIn(editor);
      expect(types.filter((t) => t === 'mergeTagNode')).toHaveLength(1);
      const stored = storedTags(block.content, 'span[data-merge-tag]');
      expect(stored).toHaveLength(1);
      expect(stored[0].getAttribute('data-merge-tag')).toBe('%FIRSTNAME%');
      expect(vueErrors).toEqual([]);
    });
  }
});
