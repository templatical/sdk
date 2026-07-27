// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, reactive, ref } from 'vue';
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
 * Mount a throwaway component and hand the return value back out. `editor.state`
 * is reactive so the preview-mode watcher can be exercised.
 */
function withFeature(options: {
  provider?: SavedBlocksProvider;
  isAvailable?: () => boolean;
  addBlock?: ReturnType<typeof vi.fn>;
  previewMode?: boolean;
}) {
  const addBlock = options.addBlock ?? vi.fn();
  const provider = options.provider ?? createMockProvider();
  const state = reactive({ previewMode: options.previewMode ?? false });
  let feature!: UseSavedBlocksFeatureReturn;

  const wrapper = mount(
    defineComponent({
      setup() {
        feature = useSavedBlocksFeature({
          provider,
          editor: { addBlock, state },
          isAvailable: options.isAvailable,
        });
        return () => h('div');
      },
    }),
  );

  return { feature, addBlock, provider, state, wrapper };
}

describe('useSavedBlocksFeature', () => {
  describe('pick session', () => {
    it('starts idle with nothing picked and no dialogs open', () => {
      const { feature } = withFeature({});

      expect(feature.isPicking.value).toBe(false);
      expect(feature.pickedCount.value).toBe(0);
      expect(feature.isSaveDialogOpen.value).toBe(false);
      expect(feature.isBrowserOpen.value).toBe(false);
    });

    it('startPicking enters the session seeded with that block', () => {
      const { feature } = withFeature({});

      feature.startPicking('block-1');

      expect(feature.isPicking.value).toBe(true);
      expect(feature.isPicked('block-1')).toBe(true);
      expect(feature.pickedCount.value).toBe(1);
      // Picking must not open the dialog — that's what confirm is for.
      expect(feature.isSaveDialogOpen.value).toBe(false);
    });

    it('togglePick adds and removes blocks', () => {
      const { feature } = withFeature({});
      feature.startPicking('a');

      feature.togglePick('b');
      expect(feature.pickedCount.value).toBe(2);
      expect(feature.isPicked('b')).toBe(true);

      feature.togglePick('b');
      expect(feature.pickedCount.value).toBe(1);
      expect(feature.isPicked('b')).toBe(false);
    });

    it('lets the seeding block be un-picked, down to an empty session', () => {
      const { feature } = withFeature({});
      feature.startPicking('a');

      feature.togglePick('a');

      expect(feature.pickedCount.value).toBe(0);
      // The session stays open — only Cancel/Save leave it.
      expect(feature.isPicking.value).toBe(true);
    });

    it('togglePick is inert outside a session', () => {
      const { feature } = withFeature({});

      feature.togglePick('a');

      expect(feature.pickedCount.value).toBe(0);
      expect(feature.isPicking.value).toBe(false);
    });

    it('confirmPicking leaves the session, opens the dialog, and keeps the picks', () => {
      const { feature } = withFeature({});
      feature.startPicking('a');
      feature.togglePick('b');

      feature.confirmPicking();

      expect(feature.isPicking.value).toBe(false);
      expect(feature.isSaveDialogOpen.value).toBe(true);
      // The dialog reads the set to know what it's saving.
      expect([...feature.pickedIds.value].sort()).toEqual(['a', 'b']);
    });

    it('confirmPicking is a no-op with nothing picked', () => {
      const { feature } = withFeature({});
      feature.startPicking('a');
      feature.togglePick('a');
      expect(feature.pickedCount.value).toBe(0);

      feature.confirmPicking();

      expect(feature.isSaveDialogOpen.value).toBe(false);
      expect(feature.isPicking.value).toBe(true);
    });

    it('cancelPicking exits and clears the picks', () => {
      const { feature } = withFeature({});
      feature.startPicking('a');
      feature.togglePick('b');

      feature.cancelPicking();

      expect(feature.isPicking.value).toBe(false);
      expect(feature.pickedCount.value).toBe(0);
      expect(feature.isSaveDialogOpen.value).toBe(false);
    });

    it('closing the save dialog clears the picks', () => {
      const { feature } = withFeature({});
      feature.startPicking('a');
      feature.confirmPicking();
      expect(feature.pickedCount.value).toBe(1);

      feature.closeSaveDialog();

      expect(feature.isSaveDialogOpen.value).toBe(false);
      expect(feature.pickedCount.value).toBe(0);
    });

    it('refuses to start in preview mode', () => {
      const { feature } = withFeature({ previewMode: true });

      feature.startPicking('a');

      expect(feature.isPicking.value).toBe(false);
      expect(feature.pickedCount.value).toBe(0);
    });

    it('cancels an active session when preview mode turns on', async () => {
      const { feature, state } = withFeature({});
      feature.startPicking('a');
      expect(feature.isPicking.value).toBe(true);

      state.previewMode = true;
      await nextTick();

      expect(feature.isPicking.value).toBe(false);
      expect(feature.pickedCount.value).toBe(0);
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
    it('defaults to available', async () => {
      const provider = createMockProvider();
      const { feature } = withFeature({ provider });
      await nextTick();

      expect(feature.isAvailable.value).toBe(true);
    });

    /* Inverted deliberately: the feature used to load on mount (and again when
       availability flipped), which meant every editor boot fired a request for
       a feature most sessions never touch — and the rail, then gated on the
       loaded count, appeared only once that request answered. Nothing is
       fetched until the user opens a surface that shows the list. */
    it('fetches nothing at mount', async () => {
      const provider = createMockProvider();
      withFeature({ provider });
      await nextTick();
      await nextTick();

      expect(provider.list).not.toHaveBeenCalled();
    });

    it('fetches nothing when availability flips true', async () => {
      const provider = createMockProvider();
      // Cloud's `hasFeature()` reads plan config that resolves asynchronously;
      // that flip must no longer trigger a load of its own.
      const allowed = ref(false);
      const { feature } = withFeature({
        provider,
        isAvailable: () => allowed.value,
      });

      allowed.value = true;
      await nextTick();

      expect(feature.isAvailable.value).toBe(true);
      expect(provider.list).not.toHaveBeenCalled();
    });

    it('loads when the browser opens', async () => {
      const provider = createMockProvider();
      const { feature } = withFeature({ provider });
      await nextTick();

      feature.openBrowser();
      await nextTick();

      expect(provider.list).toHaveBeenCalledTimes(1);
    });

    it('reloads on each browser open, to pick up other people’s changes', async () => {
      const provider = createMockProvider();
      const { feature } = withFeature({ provider });

      feature.openBrowser();
      feature.closeBrowser();
      feature.openBrowser();
      await nextTick();

      expect(provider.list).toHaveBeenCalledTimes(2);
    });

    /* The save dialog's category field suggests the categories already in use,
       and those derive from the loaded list. Without a load here they'd be empty
       for anyone who saves without ever opening the browser, and the derived
       categories would drift into near-duplicates. */
    it('loads when the save dialog opens, for the category suggestions', async () => {
      const provider = createMockProvider();
      const { feature } = withFeature({ provider });
      await nextTick();

      feature.startPicking('block-1');
      feature.confirmPicking();
      await nextTick();

      expect(feature.isSaveDialogOpen.value).toBe(true);
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
              editor: { addBlock: vi.fn(), state: reactive({ previewMode: false }) },
              onError,
            });
            return () => h('div');
          },
        }),
      );
      feature.openBrowser();
      await nextTick();
      await nextTick();

      expect(onError).toHaveBeenCalledWith(error);
      expect(feature.count.value).toBe(0);
      // The browser stays open on a failed load — it shows the empty state
      // rather than vanishing under the user.
      expect(feature.isBrowserOpen.value).toBe(true);
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
      // Zero until something actually loads — nothing is fetched at mount.
      expect(feature.count.value).toBe(0);

      feature.openBrowser();
      await nextTick();
      await nextTick();

      expect(feature.capability.count.value).toBe(2);
      expect(feature.count.value).toBe(2);
    });

    it('routes the capability through to the pick session', () => {
      const { feature } = withFeature({});

      feature.capability.startPicking('block-9');
      expect(feature.isPicking.value).toBe(true);
      expect(feature.capability.isPicked('block-9')).toBe(true);
      expect(feature.capability.isPicking.value).toBe(true);

      feature.capability.togglePick('block-10');
      expect(feature.pickedCount.value).toBe(2);

      feature.capability.confirmPicking();
      expect(feature.isSaveDialogOpen.value).toBe(true);
    });

    it('capability.cancelPicking exits the session', () => {
      const { feature } = withFeature({});
      feature.capability.startPicking('a');

      feature.capability.cancelPicking();

      expect(feature.isPicking.value).toBe(false);
      expect(feature.pickedCount.value).toBe(0);
    });

    it('mirrors availability onto the capability', () => {
      const { feature } = withFeature({ isAvailable: () => false });

      expect(feature.capability.isAvailable.value).toBe(false);
    });
  });

  describe('provider withheld create', () => {
    /* A read-only library: the bookmark is hidden, but the session entry point
       is guarded too so a programmatic caller can't strand the user in a mode
       whose dialog could never persist. */
    it('refuses to start a pick session', () => {
      const { feature } = withFeature({
        provider: createMockProvider({ create: false }),
      });

      feature.startPicking('block-1');

      expect(feature.isPicking.value).toBe(false);
      expect(feature.pickedCount.value).toBe(0);
    });

    it('reports the capability as unavailable to shared UI', () => {
      const { feature } = withFeature({
        provider: createMockProvider({ create: false }),
      });

      expect(feature.capability.canCreate.value).toBe(false);
      // The feature itself is still available — browsing and inserting work.
      expect(feature.capability.isAvailable.value).toBe(true);
    });

    it('still allows browsing and inserting', () => {
      const addBlock = vi.fn();
      const { feature } = withFeature({
        addBlock,
        provider: createMockProvider({ create: false }),
      });

      feature.openBrowser();
      expect(feature.isBrowserOpen.value).toBe(true);

      feature.insert(
        { id: 's1', name: 'Saved', content: [createTitleBlock()] },
        undefined,
      );

      // Insertion never touches the provider, so withholding create can't stop it.
      expect(addBlock).toHaveBeenCalledTimes(1);
    });
  });

  describe('capability exposes the provider permissions', () => {
    it('passes all three through when the provider implements them', () => {
      const { feature } = withFeature({});

      expect(feature.capability.canCreate.value).toBe(true);
      expect(feature.capability.canUpdate.value).toBe(true);
      expect(feature.capability.canDelete.value).toBe(true);
    });

    it('reflects update and delete being withheld independently', () => {
      const { feature } = withFeature({
        provider: createMockProvider({ update: false }),
      });

      expect(feature.capability.canUpdate.value).toBe(false);
      expect(feature.capability.canCreate.value).toBe(true);
      expect(feature.capability.canDelete.value).toBe(true);
    });
  });
});
