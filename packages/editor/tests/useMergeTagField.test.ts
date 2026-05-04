// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import './dom-stubs';

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createApp, defineComponent, h, ref, nextTick, type InjectionKey } from 'vue';
import type { MergeTag, SyntaxPreset } from '@templatical/types';
import { SYNTAX_PRESETS } from '@templatical/types';
import { useMergeTagField } from '../src/composables/useMergeTagField';
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  ON_REQUEST_MERGE_TAG_KEY,
} from '../src/keys';

function withProvide<T>(
  setup: () => T,
  provides: Record<string | symbol, unknown> = {},
): T {
  let result: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h('div');
      },
    }),
  );
  for (const [key, value] of Object.entries(provides)) {
    app.provide(key, value);
  }
  for (const sym of Object.getOwnPropertySymbols(provides)) {
    app.provide(sym as InjectionKey<unknown>, provides[sym]);
  }
  app.mount(document.createElement('div'));
  app.unmount();
  return result!;
}

const sampleTags: MergeTag[] = [
  { label: 'Name', value: '{{name}}' },
  { label: 'Email', value: '{{email}}' },
];

function defaultProvides(
  overrides: Record<string | symbol, unknown> = {},
): Record<string | symbol, unknown> {
  return {
    [MERGE_TAGS_KEY as symbol]: sampleTags,
    [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
    ...overrides,
  };
}

function createElementRef() {
  return ref({
    focus: vi.fn(),
    setSelectionRange: vi.fn(),
    selectionStart: 0,
  } as any);
}

describe('useMergeTagField', () => {
  describe('segments', () => {
    it('returns empty array for empty value', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { segments } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      expect(segments.value).toEqual([]);
    });

    it('returns single text segment for plain text', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { segments } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => 'hello',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      expect(segments.value).toEqual([{ type: 'text', value: 'hello' }]);
    });

    it('returns mergeTag segment for a single merge tag', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { segments } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '{{name}}',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      expect(segments.value).toEqual([
        { type: 'mergeTag', value: '{{name}}', label: 'Name' },
      ]);
    });

    it('parses mixed text and merge tags', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { segments } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => 'Hello {{name}}!',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      expect(segments.value).toEqual([
        { type: 'text', value: 'Hello ' },
        { type: 'mergeTag', value: '{{name}}', label: 'Name' },
        { type: 'text', value: '!' },
      ]);
    });

    it('parses multiple merge tags with text between', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { segments } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '{{name}} {{email}}',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      expect(segments.value).toEqual([
        { type: 'mergeTag', value: '{{name}}', label: 'Name' },
        { type: 'text', value: ' ' },
        { type: 'mergeTag', value: '{{email}}', label: 'Email' },
      ]);
    });

    it('falls back to value as label when merge tag not in list', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { segments } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '{{unknown}}',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      expect(segments.value).toEqual([
        { type: 'mergeTag', value: '{{unknown}}', label: '{{unknown}}' },
      ]);
    });

    it('parses logic merge tags with keyword', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { segments } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '{% if condition %}',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      expect(segments.value).toEqual([
        { type: 'logicMergeTag', value: '{% if condition %}', keyword: 'IF' },
      ]);
    });
  });

  describe('hasMergeTags', () => {
    it('is true when segments contain a merge tag', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { hasMergeTags } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '{{name}}',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      expect(hasMergeTags.value).toBe(true);
    });

    it('is true when segments contain a logic merge tag', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { hasMergeTags } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '{% if x %}',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      expect(hasMergeTags.value).toBe(true);
    });

    it('is false for plain text only', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { hasMergeTags } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => 'hello',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      expect(hasMergeTags.value).toBe(false);
    });

    it('is false for empty value', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { hasMergeTags } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      expect(hasMergeTags.value).toBe(false);
    });
  });

  describe('isEditing', () => {
    it('starts as false', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { isEditing } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      expect(isEditing.value).toBe(false);
    });
  });

  describe('startEditing', () => {
    it('sets isEditing to true', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { isEditing, startEditing } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => 'hello',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      expect(isEditing.value).toBe(false);
      startEditing();
      expect(isEditing.value).toBe(true);
    });
  });

  describe('stopEditing', () => {
    it('sets isEditing to false', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { isEditing, startEditing, stopEditing } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      startEditing();
      expect(isEditing.value).toBe(true);
      stopEditing();
      expect(isEditing.value).toBe(false);
    });

    it('is a no-op while merge tag insertion is in progress', async () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      let resolveRequest: (value: MergeTag | null) => void;
      const requestCallback = vi.fn(
        () =>
          new Promise<MergeTag | null>((resolve) => {
            resolveRequest = resolve;
          }),
      );

      const { isEditing, startEditing, stopEditing, insertMergeTag } =
        withProvide(
          () =>
            useMergeTagField({
              modelValue: () => '',
              emit: emitFn,
              elementRef,
            }),
          defaultProvides({
            [ON_REQUEST_MERGE_TAG_KEY as symbol]: requestCallback,
          }),
        );

      // Start inserting a merge tag (this sets insertingMergeTag = true internally)
      const insertPromise = insertMergeTag();

      // While insertion is pending, stopEditing should be a no-op
      stopEditing();
      // isEditing is false because we haven't called startEditing,
      // but the key point is stopEditing didn't throw and is guarded
      expect(isEditing.value).toBe(false);

      // Now start editing, then try to stop while still inserting
      startEditing();
      expect(isEditing.value).toBe(true);
      stopEditing();
      // Should remain true because insertingMergeTag guard prevents stop
      expect(isEditing.value).toBe(true);

      // Complete the insertion (return null = cancelled)
      resolveRequest!(null);
      await insertPromise;

      // Now stopEditing should work
      stopEditing();
      expect(isEditing.value).toBe(false);
    });
  });

  describe('handleInput', () => {
    it('emits the input target value', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { handleInput } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      const mockEvent = {
        target: { value: 'new value' },
      } as unknown as Event;

      handleInput(mockEvent);
      expect(emitFn).toHaveBeenCalledWith('new value');
    });
  });

  describe('clearValue', () => {
    it('emits empty string', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { clearValue } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => 'some existing value',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      clearValue();
      expect(emitFn).toHaveBeenCalledWith('');
    });
  });

  describe('insertMergeTag', () => {
    it('inserts tag at end when not editing', async () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();
      const requestCallback = vi
        .fn()
        .mockResolvedValue({ label: 'Name', value: '{{name}}' });

      const { insertMergeTag } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => 'Hello ',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides({
          [ON_REQUEST_MERGE_TAG_KEY as symbol]: requestCallback,
        }),
      );

      await insertMergeTag();

      expect(requestCallback).toHaveBeenCalled();
      expect(emitFn).toHaveBeenCalledWith('Hello {{name}}');
    });

    it('does not emit when request returns null', async () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();
      const requestCallback = vi.fn().mockResolvedValue(null);

      const { insertMergeTag } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => 'Hello ',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides({
          [ON_REQUEST_MERGE_TAG_KEY as symbol]: requestCallback,
        }),
      );

      await insertMergeTag();

      expect(requestCallback).toHaveBeenCalled();
      expect(emitFn).not.toHaveBeenCalled();
    });

    it('inserts at cursor position when editing', async () => {
      const elementRef = createElementRef();
      elementRef.value!.selectionStart = 5;
      const emitFn = vi.fn();
      const requestCallback = vi
        .fn()
        .mockResolvedValue({ label: 'Email', value: '{{email}}' });

      const { insertMergeTag, startEditing, isEditing } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => 'Hello World',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides({
          [ON_REQUEST_MERGE_TAG_KEY as symbol]: requestCallback,
        }),
      );

      startEditing();
      expect(isEditing.value).toBe(true);

      await insertMergeTag();

      expect(emitFn).toHaveBeenCalledWith('Hello{{email}} World');
    });

    it('clears insertingMergeTag flag when request rejects so stopEditing is not stuck', async () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();
      const requestCallback = vi.fn().mockRejectedValue(new Error('boom'));

      const { isEditing, startEditing, stopEditing, insertMergeTag } =
        withProvide(
          () =>
            useMergeTagField({
              modelValue: () => '',
              emit: emitFn,
              elementRef,
            }),
          defaultProvides({
            [ON_REQUEST_MERGE_TAG_KEY as symbol]: requestCallback,
          }),
        );

      startEditing();
      expect(isEditing.value).toBe(true);

      await expect(insertMergeTag()).rejects.toThrow('boom');

      stopEditing();
      expect(isEditing.value).toBe(false);
    });

    it('sets isEditing to true after successful insertion', async () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();
      const requestCallback = vi
        .fn()
        .mockResolvedValue({ label: 'Name', value: '{{name}}' });

      const { insertMergeTag, isEditing } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides({
          [ON_REQUEST_MERGE_TAG_KEY as symbol]: requestCallback,
        }),
      );

      expect(isEditing.value).toBe(false);
      await insertMergeTag();
      expect(isEditing.value).toBe(true);
    });
  });

  describe('canRequestMergeTag', () => {
    it('is false when only static merge tags are provided (no onRequest callback)', () => {
      // Static tags surface via the autocomplete typing trigger, not the
      // insert button — the button no-ops without onRequestMergeTag, so it
      // must stay hidden.
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { canRequestMergeTag } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides(),
      );

      expect(canRequestMergeTag).toBe(false);
    });

    it('is true when onRequestMergeTag callback is provided', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { canRequestMergeTag } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '',
            emit: emitFn,
            elementRef,
          }),
        defaultProvides({
          [ON_REQUEST_MERGE_TAG_KEY as symbol]: vi.fn(),
        }),
      );

      expect(canRequestMergeTag).toBe(true);
    });

    it('is false when no merge tags and no callback', () => {
      const elementRef = createElementRef();
      const emitFn = vi.fn();

      const { canRequestMergeTag } = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => '',
            emit: emitFn,
            elementRef,
          }),
        {
          [MERGE_TAGS_KEY as symbol]: [],
          [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
        },
      );

      expect(canRequestMergeTag).toBe(false);
    });
  });
});
