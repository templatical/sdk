// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { createSectionBlock, createTitleBlock } from '@templatical/types';
import type { SavedBlock, SavedBlocksProvider } from '@templatical/types';
import {
  useSavedBlocksFeature,
  type UseSavedBlocksFeatureReturn,
} from '../src/composables/useSavedBlocksFeature';

function createMockProvider(
  overrides: Partial<SavedBlocksProvider> = {},
): SavedBlocksProvider {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * `useSavedBlocksFeature` calls provide(), so it must run inside setup().
 * Mount a throwaway component and hand the return value back out.
 */
function withFeature(options: {
  provider?: SavedBlocksProvider;
  isAvailable?: () => boolean;
  addBlock?: ReturnType<typeof vi.fn>;
}) {
  const addBlock = options.addBlock ?? vi.fn();
  const provider = options.provider ?? createMockProvider();
  let feature!: UseSavedBlocksFeatureReturn;

  const wrapper = mount(
    defineComponent({
      setup() {
        feature = useSavedBlocksFeature({
          provider,
          editor: { addBlock },
          isAvailable: options.isAvailable,
        });
        return () => h('div');
      },
    }),
  );

  return { feature, addBlock, provider, wrapper };
}

describe('useSavedBlocksFeature', () => {
  describe('dialog state', () => {
    it('starts with both dialogs closed', () => {
      const { feature } = withFeature({});

      expect(feature.isSaveDialogOpen.value).toBe(false);
      expect(feature.isBrowserOpen.value).toBe(false);
      expect(feature.preSelectedBlockId.value).toBe(null);
    });

    it('openSaveDialog records the pre-selected block id', () => {
      const { feature } = withFeature({});

      feature.openSaveDialog('block-1');

      expect(feature.isSaveDialogOpen.value).toBe(true);
      expect(feature.preSelectedBlockId.value).toBe('block-1');
    });

    it('openSaveDialog with no id clears any previous pre-selection', () => {
      const { feature } = withFeature({});

      feature.openSaveDialog('block-1');
      feature.closeSaveDialog();
      feature.openSaveDialog();

      expect(feature.preSelectedBlockId.value).toBe(null);
    });

    it('openBrowser / closeBrowser toggle the browser', () => {
      const { feature } = withFeature({});

      feature.openBrowser();
      expect(feature.isBrowserOpen.value).toBe(true);

      feature.closeBrowser();
      expect(feature.isBrowserOpen.value).toBe(false);
    });
  });

  describe('insert', () => {
    it('adds every block and regenerates their ids', () => {
      const { feature, addBlock } = withFeature({});
      const a = createTitleBlock();
      const b = createTitleBlock();
      const saved: SavedBlock = { id: 's1', name: 'Pair', content: [a, b] };

      feature.insert(saved, undefined);

      expect(addBlock).toHaveBeenCalledTimes(2);
      const firstInserted = addBlock.mock.calls[0][0];
      const secondInserted = addBlock.mock.calls[1][0];
      // Fresh ids: never reuse the stored copy's, so repeated inserts of the
      // same saved block can't collide on the canvas.
      expect(firstInserted.id).not.toBe(a.id);
      expect(secondInserted.id).not.toBe(b.id);
      expect(firstInserted.id).not.toBe(secondInserted.id);
      // Everything else survives the clone.
      expect(firstInserted.type).toBe('title');
    });

    it('regenerates ids recursively for section children', () => {
      const { feature, addBlock } = withFeature({});
      const child = createTitleBlock();
      const section = createSectionBlock();
      section.children = [[child]];
      const saved: SavedBlock = {
        id: 's1',
        name: 'Section',
        content: [section],
      };

      feature.insert(saved, undefined);

      const inserted = addBlock.mock.calls[0][0];
      expect(inserted.id).not.toBe(section.id);
      expect(inserted.children[0][0].id).not.toBe(child.id);
      expect(inserted.children[0][0].type).toBe('title');
    });

    it('appends when no index is given', () => {
      const { feature, addBlock } = withFeature({});
      const saved: SavedBlock = {
        id: 's1',
        name: 'One',
        content: [createTitleBlock()],
      };

      feature.insert(saved, undefined);

      expect(addBlock).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        undefined,
        undefined,
      );
    });

    it('offsets each subsequent block so order is preserved at an index', () => {
      const { feature, addBlock } = withFeature({});
      const saved: SavedBlock = {
        id: 's1',
        name: 'Three',
        content: [createTitleBlock(), createTitleBlock(), createTitleBlock()],
      };

      feature.insert(saved, 2);

      expect(addBlock.mock.calls.map((c) => c[3])).toEqual([2, 3, 4]);
    });

    it('closes the browser after inserting', () => {
      const { feature } = withFeature({});
      feature.openBrowser();

      feature.insert(
        { id: 's1', name: 'One', content: [createTitleBlock()] },
        undefined,
      );

      expect(feature.isBrowserOpen.value).toBe(false);
    });

    it('inserting an empty saved block adds nothing but still closes', () => {
      const { feature, addBlock } = withFeature({});
      feature.openBrowser();

      feature.insert({ id: 's1', name: 'Empty', content: [] }, undefined);

      expect(addBlock).not.toHaveBeenCalled();
      expect(feature.isBrowserOpen.value).toBe(false);
    });
  });

  describe('availability', () => {
    it('defaults to available and loads immediately', async () => {
      const provider = createMockProvider();
      const { feature } = withFeature({ provider });
      await nextTick();

      expect(feature.isAvailable.value).toBe(true);
      expect(provider.list).toHaveBeenCalledTimes(1);
    });

    it('does not load while unavailable', async () => {
      const provider = createMockProvider();
      withFeature({ provider, isAvailable: () => false });
      await nextTick();

      expect(provider.list).not.toHaveBeenCalled();
    });

    it('loads once availability flips true (the Cloud plan-fetch case)', async () => {
      const provider = createMockProvider();
      // A ref, because Cloud's `hasFeature()` reads reactive plan config that
      // only resolves after an async fetch — that flip is what this covers.
      const allowed = ref(false);
      const { feature } = withFeature({
        provider,
        isAvailable: () => allowed.value,
      });
      await nextTick();
      expect(provider.list).not.toHaveBeenCalled();

      allowed.value = true;
      await nextTick();

      expect(feature.isAvailable.value).toBe(true);
      expect(provider.list).toHaveBeenCalledTimes(1);
    });

    it('surfaces a load failure through onError without rejecting the caller', async () => {
      const onError = vi.fn();
      const error = new Error('boom');
      const provider = createMockProvider({
        list: vi.fn().mockRejectedValue(error),
      });
      let feature!: UseSavedBlocksFeatureReturn;
      mount(
        defineComponent({
          setup() {
            feature = useSavedBlocksFeature({
              provider,
              editor: { addBlock: vi.fn() },
              onError,
            });
            return () => h('div');
          },
        }),
      );
      await nextTick();
      await nextTick();

      expect(onError).toHaveBeenCalledWith(error);
      expect(feature.count.value).toBe(0);
    });
  });

  describe('capability', () => {
    it('exposes a reactive count of saved blocks', async () => {
      const stored: SavedBlock[] = [
        { id: 'a', name: 'A', content: [] },
        { id: 'b', name: 'B', content: [] },
      ];
      const provider = createMockProvider({
        list: vi.fn().mockResolvedValue(stored),
      });
      const { feature } = withFeature({ provider });
      await nextTick();
      await nextTick();

      expect(feature.capability.count.value).toBe(2);
      expect(feature.count.value).toBe(2);
    });

    it('routes capability.openSaveDialog through to dialog state', () => {
      const { feature } = withFeature({});

      feature.capability.openSaveDialog('block-9');

      expect(feature.isSaveDialogOpen.value).toBe(true);
      expect(feature.preSelectedBlockId.value).toBe('block-9');
    });

    it('mirrors availability onto the capability', () => {
      const { feature } = withFeature({ isAvailable: () => false });

      expect(feature.capability.isAvailable.value).toBe(false);
    });
  });
});
