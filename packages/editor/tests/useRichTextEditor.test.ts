// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { EDITOR_KEY, MERGE_TAGS_KEY, ON_REQUEST_MERGE_TAG_KEY } from '../src/keys';
import { useRichTextEditor } from '../src/composables/useRichTextEditor';
import { makeStubTranslations } from './helpers/translations';

// --- Lightweight TipTap stubs ---------------------------------------------------

interface StubEditorOpts {
  extensions: any[];
  content: string;
  editable: boolean;
  onUpdate?: (ctx: { editor: StubEditor }) => void;
}

class StubEditor {
  extensions: any[];
  private html: string;
  onUpdate: StubEditorOpts['onUpdate'];
  destroyed = false;
  focusCalls: string[] = [];
  commands = {
    focus: (pos?: string) => {
      this.focusCalls.push(pos ?? '');
      return this;
    },
    setContent: (html: string, _opts?: { emitUpdate?: boolean }) => {
      this.html = html;
      return this;
    },
  };

  constructor(opts: StubEditorOpts) {
    this.extensions = opts.extensions;
    this.html = opts.content;
    this.onUpdate = opts.onUpdate;
  }

  getHTML(): string {
    return this.html;
  }

  setHTMLExternally(html: string): void {
    this.html = html;
    this.onUpdate?.({ editor: this });
  }

  chain() {
    const self = this;
    const chainObj: any = {
      focus: () => chainObj,
      insertMergeTag: (tag: { label: string; value: string }) => {
        self.html += `<merge-tag data-label="${tag.label}" data-value="${tag.value}"/>`;
        return chainObj;
      },
      run: () => true,
    };
    return chainObj;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

const StubEditorContent = defineComponent({
  name: 'EditorContent',
  render: () => h('div', { class: 'stub-editor-content' }),
});

function makeLoadExtensions(overrides: Partial<{
  extensions: any[];
  throwError: unknown;
}> = {}) {
  const { extensions = [{ name: 'bold' }, { name: 'italic' }], throwError = null } = overrides;
  return vi.fn(async () => {
    if (throwError !== null) throw throwError;
    return {
      TiptapEditor: StubEditor as any,
      EC: StubEditorContent as any,
      extensions,
    };
  });
}

function mountRichText(
  options: Partial<Parameters<typeof useRichTextEditor>[0]> & {
    blockId?: string;
    blockContent?: string;
  } = {},
  provides: Record<symbol, unknown> = {},
) {
  const blockContent = ref(options.blockContent ?? '<p>Hello</p>');
  const updateBlock = vi.fn();
  const emailEditor = {
    updateBlock,
  } as any;
  const onDone = options.onDone ?? vi.fn();
  const onClickOutsideSideEffect = options.onClickOutsideSideEffect;
  const loadExtensions = options.loadExtensions ?? makeLoadExtensions();

  let captured!: ReturnType<typeof useRichTextEditor>;
  const wrapper = mount(
    defineComponent({
      setup() {
        captured = useRichTextEditor({
          blockId: () => options.blockId ?? 'block-1',
          blockContent: () => blockContent.value,
          loadExtensions,
          onDone,
          onClickOutsideSideEffect,
          editorName: 'TestEditor',
        });
        return () => h('div', { class: 'tpl-text-editor-wrapper' });
      },
    }),
    {
      attachTo: document.body,
      global: {
        provide: {
          [EDITOR_KEY]: emailEditor,
          [MERGE_TAGS_KEY]: [] as any[],
          [ON_REQUEST_MERGE_TAG_KEY]: null,
          translations: makeStubTranslations(),
          ...provides,
        },
      },
    },
  );

  return {
    wrapper,
    api: () => captured,
    blockContent,
    updateBlock,
    loadExtensions,
    onDone,
    emailEditor,
    destroy: () => wrapper.unmount(),
  };
}

async function flushAsync() {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe('useRichTextEditor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('initialization', () => {
    it('starts with isLoading=true and no editor instance', () => {
      const ctx = mountRichText();
      expect(ctx.api().isLoading.value).toBe(true);
      expect(ctx.api().editor.value).toBeNull();
      expect(ctx.api().initError.value).toBeNull();
    });

    it('after load, creates a TipTap editor with the current blockContent', async () => {
      const ctx = mountRichText({ blockContent: '<p>Hello world</p>' });
      await flushAsync();

      expect(ctx.api().isLoading.value).toBe(false);
      expect(ctx.api().editor.value).not.toBeNull();
      expect(ctx.api().editor.value!.getHTML()).toBe('<p>Hello world</p>');
    });

    it('deduplicates extensions by name (keeps the last occurrence)', async () => {
      const extA = { name: 'bold', marker: 'A' };
      const extB = { name: 'bold', marker: 'B' };
      const loadExtensions = makeLoadExtensions({
        extensions: [extA, extB, { name: 'italic', marker: 'C' }],
      });
      const ctx = mountRichText({ loadExtensions });
      await flushAsync();

      const ext = ctx.api().editor.value!.extensions;
      const boldExtensions = ext.filter((e: any) => e.name === 'bold');
      expect(boldExtensions).toHaveLength(1);
      expect(boldExtensions[0].marker).toBe('B');
      expect(ext.map((e: any) => e.name).sort()).toEqual(['bold', 'italic']);
    });

    it('exposes EditorContent component after load', async () => {
      const ctx = mountRichText();
      await flushAsync();
      expect(ctx.api().EditorContent.value).toBe(StubEditorContent);
    });
  });

  describe('init error handling', () => {
    it('sets initError to the Error message and isLoading=false on load failure', async () => {
      const loadExtensions = makeLoadExtensions({ throwError: new Error('cdn down') });
      const ctx = mountRichText({ loadExtensions });
      await flushAsync();

      expect(ctx.api().initError.value).toBe('cdn down');
      expect(ctx.api().isLoading.value).toBe(false);
      expect(ctx.api().editor.value).toBeNull();
    });

    it('sets a generic message when loadExtensions throws a non-Error', async () => {
      const loadExtensions = makeLoadExtensions({ throwError: 'weird-string' });
      const ctx = mountRichText({ loadExtensions });
      await flushAsync();

      expect(ctx.api().initError.value).toBe('Failed to load editor');
    });

    it('retry() clears initError, destroys prior editor, and re-runs init', async () => {
      const err = new Error('transient');
      const loadExtensions = vi
        .fn()
        .mockImplementationOnce(async () => {
          throw err;
        })
        .mockImplementationOnce(async () => ({
          TiptapEditor: StubEditor as any,
          EC: StubEditorContent as any,
          extensions: [{ name: 'bold' }],
        }));
      const ctx = mountRichText({ loadExtensions });
      await flushAsync();
      expect(ctx.api().initError.value).toBe('transient');

      ctx.api().retry();
      await flushAsync();

      expect(ctx.api().initError.value).toBeNull();
      expect(ctx.api().editor.value).not.toBeNull();
      expect(loadExtensions).toHaveBeenCalledTimes(2);
    });
  });

  describe('content sync', () => {
    it('forwards onUpdate to emailEditor.updateBlock with new HTML', async () => {
      const ctx = mountRichText({ blockId: 'abc' });
      await flushAsync();

      const tipTap = ctx.api().editor.value as unknown as StubEditor;
      tipTap.setHTMLExternally('<p>Edited</p>');

      expect(ctx.updateBlock).toHaveBeenCalledWith('abc', { content: '<p>Edited</p>' });
    });

    it('pushes external blockContent changes into the editor when they differ', async () => {
      const ctx = mountRichText({ blockContent: '<p>Initial</p>' });
      await flushAsync();

      const setContentSpy = vi.spyOn(ctx.api().editor.value!.commands, 'setContent');
      ctx.blockContent.value = '<p>Changed</p>';
      await flushAsync();

      expect(setContentSpy).toHaveBeenCalledWith('<p>Changed</p>', {
        emitUpdate: false,
      });
    });

    it('does NOT call setContent when external change equals current HTML (prevents feedback loop)', async () => {
      const ctx = mountRichText({ blockContent: '<p>Same</p>' });
      await flushAsync();

      const setContentSpy = vi.spyOn(ctx.api().editor.value!.commands, 'setContent');
      ctx.blockContent.value = '<p>Same</p>';
      await flushAsync();

      expect(setContentSpy).not.toHaveBeenCalled();
    });
  });

  describe('click-outside handling', () => {
    it('calls onDone on mousedown outside the editor wrapper', async () => {
      const ctx = mountRichText();
      await flushAsync();

      const outside = document.createElement('div');
      document.body.appendChild(outside);
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(ctx.onDone).toHaveBeenCalledOnce();
    });

    it('does NOT call onDone when mousedown originates inside the editor wrapper', async () => {
      const ctx = mountRichText();
      await flushAsync();

      const inside = ctx.wrapper.find('.tpl-text-editor-wrapper').element as HTMLElement;
      inside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(ctx.onDone).not.toHaveBeenCalled();
    });

    it('invokes onClickOutsideSideEffect for every outside mousedown', async () => {
      const onClickOutsideSideEffect = vi.fn();
      const ctx = mountRichText({ onClickOutsideSideEffect });
      await flushAsync();

      const outside = document.createElement('div');
      document.body.appendChild(outside);
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(onClickOutsideSideEffect).toHaveBeenCalledOnce();
    });

    it('suppresses onDone while a merge-tag request is pending', async () => {
      const onRequestMergeTag = vi.fn(() => new Promise<null>(() => {})); // never resolves
      const ctx = mountRichText(
        {},
        {
          [MERGE_TAGS_KEY]: [] as any[],
          [ON_REQUEST_MERGE_TAG_KEY]: onRequestMergeTag,
        },
      );
      await flushAsync();

      ctx.api().handleAddMergeTag();
      await flushAsync();

      const outside = document.createElement('div');
      document.body.appendChild(outside);
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(ctx.onDone).not.toHaveBeenCalled();
    });
  });

  describe('handleAddMergeTag', () => {
    it('inserts a merge tag when onRequestMergeTag resolves with one', async () => {
      const tag = { label: 'First Name', value: '{{first_name}}' };
      const onRequestMergeTag = vi.fn().mockResolvedValue(tag);
      const ctx = mountRichText(
        {},
        { [ON_REQUEST_MERGE_TAG_KEY]: onRequestMergeTag },
      );
      await flushAsync();

      await ctx.api().handleAddMergeTag();

      expect(onRequestMergeTag).toHaveBeenCalledOnce();
      expect(ctx.api().editor.value!.getHTML()).toContain('data-label="First Name"');
      expect(ctx.api().editor.value!.getHTML()).toContain('data-value="{{first_name}}"');
    });

    it('focuses the editor (without insert) when request returns null', async () => {
      const onRequestMergeTag = vi.fn().mockResolvedValue(null);
      const ctx = mountRichText(
        {},
        { [ON_REQUEST_MERGE_TAG_KEY]: onRequestMergeTag },
      );
      await flushAsync();

      await ctx.api().handleAddMergeTag();

      expect((ctx.api().editor.value as unknown as StubEditor).focusCalls).toContain('');
    });
  });

  describe('destroy / cleanup', () => {
    it('destroys the TipTap editor when the host component unmounts', async () => {
      const ctx = mountRichText();
      await flushAsync();
      const editor = ctx.api().editor.value as unknown as StubEditor;

      ctx.destroy();

      expect(editor.destroyed).toBe(true);
    });

    it('stops the blockContent watcher (no setContent after unmount)', async () => {
      const ctx = mountRichText({ blockContent: '<p>A</p>' });
      await flushAsync();

      const editor = ctx.api().editor.value as unknown as StubEditor;
      const setContentSpy = vi.spyOn(editor.commands, 'setContent');

      ctx.destroy();
      ctx.blockContent.value = '<p>B</p>';
      await flushAsync();

      expect(setContentSpy).not.toHaveBeenCalled();
    });

    it('does not leak a TipTap editor when unmounted during async init', async () => {
      // Hold loadExtensions until we explicitly resolve so we can simulate
      // the host component unmounting mid-init.
      let resolveLoad!: (v: any) => void;
      const loadExtensions = vi.fn(
        () =>
          new Promise<{
            TiptapEditor: typeof StubEditor;
            EC: typeof StubEditorContent;
            extensions: any[];
          }>((r) => {
            resolveLoad = r;
          }),
      );

      const createdEditors: StubEditor[] = [];
      class TrackingStubEditor extends StubEditor {
        constructor(opts: StubEditorOpts) {
          super(opts);
          createdEditors.push(this);
        }
      }

      const ctx = mountRichText({ loadExtensions: loadExtensions as any });

      // Unmount BEFORE loadExtensions resolves — initEditor is still awaiting.
      ctx.destroy();

      // Now let initEditor's await complete.
      resolveLoad({
        TiptapEditor: TrackingStubEditor as any,
        EC: StubEditorContent as any,
        extensions: [{ name: 'bold' }],
      });
      await flushAsync();

      // Either no editor was constructed, or the one that was got destroyed.
      // The bug: editor created post-unmount and never destroyed.
      if (createdEditors.length > 0) {
        expect(createdEditors[0].destroyed).toBe(true);
      }
      expect(createdEditors.length).toBeLessThanOrEqual(1);
    });
  });
});
