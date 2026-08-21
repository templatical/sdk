// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VueDraggable } from 'vue-draggable-plus';
import Sidebar from '../src/components/Sidebar.vue';
import { mountEditor } from './helpers/mount';
import {
  EDITOR_KEY,
  CUSTOM_BLOCK_DEFINITIONS_KEY,
  PALETTE_BLOCKS_KEY,
  CAPABILITIES_KEY,
} from '../src/keys';

// The scroll itself needs real layout, so the composable is stubbed here and
// asserted on; `tests/useScrollToBlock.test.ts` covers what it does, and the
// e2e covers that the canvas actually moves.
const scrollToBlock = vi.hoisted(() => vi.fn());
vi.mock('../src/composables/useScrollToBlock', () => ({
  useScrollToBlock: () => scrollToBlock,
}));

beforeEach(() => {
  scrollToBlock.mockClear();
});

type Location = {
  targetSectionId?: string;
  columnIndex?: number;
  index: number;
};

function makeEditor(
  options: {
    selectedBlockId?: string | null;
    locations?: Record<string, Location>;
    lockedIds?: string[];
  } = {},
) {
  const addBlock = vi.fn();
  const selectBlock = vi.fn();
  const locations = options.locations ?? {};
  const locked = new Set(options.lockedIds ?? []);
  const findBlockLocation = vi.fn(
    (blockId: string) => locations[blockId] ?? null,
  );
  const isBlockLocked = vi.fn((blockId: string) => locked.has(blockId));
  return {
    editor: {
      addBlock,
      selectBlock,
      findBlockLocation,
      isBlockLocked,
      state: { selectedBlockId: options.selectedBlockId ?? null },
    } as any,
    addBlock,
    selectBlock,
    findBlockLocation,
    isBlockLocked,
  };
}

function mountSidebar(overrides: Record<symbol, unknown> = {}) {
  return mountEditor(Sidebar, {
    provides: overrides,
  });
}

describe('Sidebar', () => {
  it('renders a button for every built-in block type in expected order', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({ [EDITOR_KEY]: editor });
    const buttons = wrapper.findAll('button[data-palette-type]');
    const types = buttons.map((b) => b.attributes('data-palette-type'));

    // Countdown is only present when `caps.plan` is configured (cloud mode).
    expect(types).toEqual([
      'section',
      'image',
      'title',
      'paragraph',
      'button',
      'divider',
      'video',
      'social',
      'menu',
      'table',
      'spacer',
      'html',
    ]);
  });

  it('collapses the rail on drag-end, even after mouseleave was suppressed mid-drag', async () => {
    // Repro: hover expands the rail; a drag starts (choose); the cursor leaves
    // the rail mid-drag but the collapse is suppressed while dragging; on drop
    // (end) no fresh mouseleave fires because the cursor is out in the canvas.
    // handleDragEnd must collapse the rail itself, or it stays stuck open.
    const { editor } = makeEditor();
    const wrapper = mountSidebar({ [EDITOR_KEY]: editor });
    const rail = wrapper.get('aside.tpl-sidebar-rail');
    const draggable = wrapper.findComponent(VueDraggable);

    await rail.trigger('mouseenter');
    expect(rail.attributes('style')).toContain('width: 200px');

    // Drag begins; leaving the rail mid-drag must NOT collapse it (the
    // getBoundingClientRect-during-collapse ghost bug this guards against).
    draggable.vm.$emit('choose');
    await rail.trigger('mouseleave');
    expect(rail.attributes('style')).toContain('width: 200px');

    // Drop: the rail collapses.
    draggable.vm.$emit('end');
    await wrapper.vm.$nextTick();
    expect(rail.attributes('style')).toContain('width: 48px');
  });

  it('palette list is a scroll region so tall block lists stay reachable on short viewports (#231)', () => {
    // The rail is `overflow-hidden` and anchored top-14..bottom-0, so it has
    // a bounded height. Without an inner scroll region the block-type list is
    // clipped on short viewports and the bottom items become unreachable
    // (issue #231). The palette must therefore scroll vertically while the
    // rail stays a flex column (so the list fills the space the modules
    // trigger leaves and the trigger stays pinned).
    const { editor } = makeEditor();
    const wrapper = mountSidebar({ [EDITOR_KEY]: editor });

    const rail = wrapper.get('aside.tpl-sidebar-rail');
    expect(rail.classes()).toContain('tpl:flex');
    expect(rail.classes()).toContain('tpl:flex-col');

    // The VueDraggable root wraps the palette buttons (v-for in its slot),
    // so a button's parent is the list container that must scroll.
    const list = wrapper.get('button[data-palette-type]').element
      .parentElement as HTMLElement;
    expect(list.className).toContain('tpl:overflow-y-auto');
    expect(list.className).toContain('tpl:flex-1');
    expect(list.className).toContain('tpl:min-h-0');

    // Each palette button must keep its fixed height: in the flex column a
    // shrinkable button would be compressed to fit the bounded list instead
    // of overflowing it, so `overflow-y-auto` would never engage.
    expect(wrapper.get('button[data-palette-type]').classes()).toContain(
      'tpl:shrink-0',
    );
  });

  it('includes countdown when plan capability is provided (cloud mode)', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CAPABILITIES_KEY]: { plan: { hasFeature: () => true } } as any,
    });
    const types = wrapper
      .findAll('button[data-palette-type]')
      .map((b) => b.attributes('data-palette-type'));
    expect(types).toContain('countdown');
  });

  it('clicking a palette item creates+inserts a block and selects it', async () => {
    const { editor, addBlock, selectBlock } = makeEditor();
    const wrapper = mountSidebar({ [EDITOR_KEY]: editor });
    const titleButton = wrapper.find('button[data-palette-type="title"]');

    await titleButton.trigger('click');

    expect(addBlock).toHaveBeenCalledOnce();
    const inserted = addBlock.mock.calls[0][0];
    expect(inserted.type).toBe('title');
    expect(inserted.id).toBeTruthy();
    expect(selectBlock).toHaveBeenCalledWith(inserted.id);
  });

  describe('insert position', () => {
    // Issue #568: a palette click always appended, so on a long template the
    // new block landed far below the fold and the canvas never moved — the
    // click read as a no-op. Insertion now follows the selection, the same
    // rule `duplicateBlock` already uses.

    it('appends when nothing is selected', async () => {
      const { editor, addBlock } = makeEditor({ selectedBlockId: null });
      const wrapper = mountSidebar({ [EDITOR_KEY]: editor });

      await wrapper.find('button[data-palette-type="title"]').trigger('click');

      expect(addBlock).toHaveBeenCalledOnce();
      const [, targetSectionId, columnIndex, index] = addBlock.mock.calls[0];
      expect(targetSectionId).toBeUndefined();
      expect(columnIndex).toBeUndefined();
      expect(index).toBeUndefined();
    });

    it('inserts directly below a selected top-level block', async () => {
      const { editor, addBlock } = makeEditor({
        selectedBlockId: 'block-a',
        locations: { 'block-a': { index: 4 } },
      });
      const wrapper = mountSidebar({ [EDITOR_KEY]: editor });

      await wrapper
        .find('button[data-palette-type="divider"]')
        .trigger('click');

      expect(addBlock).toHaveBeenCalledOnce();
      const [, targetSectionId, columnIndex, index] = addBlock.mock.calls[0];
      expect(targetSectionId).toBeUndefined();
      expect(columnIndex).toBeUndefined();
      expect(index).toBe(5);
    });

    it('inserts into the same section column below a nested selection', async () => {
      const { editor, addBlock } = makeEditor({
        selectedBlockId: 'child',
        locations: {
          child: { targetSectionId: 'sec-1', columnIndex: 1, index: 2 },
        },
      });
      const wrapper = mountSidebar({ [EDITOR_KEY]: editor });

      await wrapper
        .find('button[data-palette-type="paragraph"]')
        .trigger('click');

      expect(addBlock).toHaveBeenCalledOnce();
      const [, targetSectionId, columnIndex, index] = addBlock.mock.calls[0];
      expect(targetSectionId).toBe('sec-1');
      expect(columnIndex).toBe(1);
      expect(index).toBe(3);
    });

    it('places a section beside the parent section when the selection is nested', async () => {
      // `addBlock` refuses a section inside a column, so targeting the column
      // would make this click do nothing at all.
      const { editor, addBlock } = makeEditor({
        selectedBlockId: 'child',
        locations: {
          child: { targetSectionId: 'sec-1', columnIndex: 0, index: 2 },
          'sec-1': { index: 6 },
        },
      });
      const wrapper = mountSidebar({ [EDITOR_KEY]: editor });

      await wrapper
        .find('button[data-palette-type="section"]')
        .trigger('click');

      expect(addBlock).toHaveBeenCalledOnce();
      const [, targetSectionId, columnIndex, index] = addBlock.mock.calls[0];
      expect(targetSectionId).toBeUndefined();
      expect(columnIndex).toBeUndefined();
      expect(index).toBe(7);
    });

    it('appends when the parent section is locked by a collaborator', async () => {
      const { editor, addBlock } = makeEditor({
        selectedBlockId: 'child',
        locations: {
          child: { targetSectionId: 'sec-1', columnIndex: 0, index: 2 },
        },
        lockedIds: ['sec-1'],
      });
      const wrapper = mountSidebar({ [EDITOR_KEY]: editor });

      await wrapper.find('button[data-palette-type="image"]').trigger('click');

      expect(addBlock).toHaveBeenCalledOnce();
      const [, targetSectionId, columnIndex, index] = addBlock.mock.calls[0];
      expect(targetSectionId).toBeUndefined();
      expect(columnIndex).toBeUndefined();
      expect(index).toBeUndefined();
    });

    it('applies the resolved position to a keyboard-activated insert too', async () => {
      // The keyboard path is the only way to insert without a pointer, so it
      // must not quietly keep the old append-at-end behaviour.
      const { editor, addBlock } = makeEditor({
        selectedBlockId: 'block-a',
        locations: { 'block-a': { index: 0 } },
      });
      const wrapper = mountSidebar({ [EDITOR_KEY]: editor });

      await wrapper
        .find('button[data-palette-type="title"]')
        .trigger('keydown', { key: 'Enter' });

      expect(addBlock).toHaveBeenCalledOnce();
      expect(addBlock.mock.calls[0][3]).toBe(1);
    });

    it('scrolls the inserted block into view', async () => {
      // Selecting the block is not enough to be visible: it can land far below
      // the fold with the canvas unmoved, which is the reported symptom.
      const { editor, addBlock } = makeEditor({ selectedBlockId: null });
      const wrapper = mountSidebar({ [EDITOR_KEY]: editor });

      await wrapper.find('button[data-palette-type="title"]').trigger('click');

      expect(scrollToBlock).toHaveBeenCalledOnce();
      expect(scrollToBlock).toHaveBeenCalledWith(addBlock.mock.calls[0][0].id);
    });

    it('does not scroll when there is no editor to insert into', async () => {
      const wrapper = mountSidebar({ [EDITOR_KEY]: null });

      await wrapper.find('button[data-palette-type="title"]').trigger('click');

      expect(scrollToBlock).not.toHaveBeenCalled();
    });
  });

  it('Enter key on a palette item inserts the block (keyboard accessibility)', async () => {
    const { editor, addBlock } = makeEditor();
    const wrapper = mountSidebar({ [EDITOR_KEY]: editor });
    const imageButton = wrapper.find('button[data-palette-type="image"]');

    await imageButton.trigger('keydown', { key: 'Enter' });

    expect(addBlock).toHaveBeenCalledOnce();
    expect(addBlock.mock.calls[0][0].type).toBe('image');
  });

  it('Space key on a palette item inserts the block', async () => {
    const { editor, addBlock } = makeEditor();
    const wrapper = mountSidebar({ [EDITOR_KEY]: editor });
    const paragraphButton = wrapper.find('button[data-palette-type="paragraph"]');

    await paragraphButton.trigger('keydown', { key: ' ' });

    expect(addBlock).toHaveBeenCalledOnce();
    expect(addBlock.mock.calls[0][0].type).toBe('paragraph');
  });

  it('non-activation keys do not insert blocks', async () => {
    const { editor, addBlock } = makeEditor();
    const wrapper = mountSidebar({ [EDITOR_KEY]: editor });
    const button = wrapper.find('button[data-palette-type="title"]');

    await button.trigger('keydown', { key: 'Tab' });
    await button.trigger('keydown', { key: 'a' });

    expect(addBlock).not.toHaveBeenCalled();
  });

  it('renders custom block buttons when customBlockDefinitions is provided', () => {
    const { editor } = makeEditor();
    const customDef = {
      type: 'callout',
      name: 'Callout',
      icon: 'Bell',
      fields: [],
      template: '',
    } as any;

    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CUSTOM_BLOCK_DEFINITIONS_KEY]: [customDef],
    });

    expect(
      wrapper.find('button[data-palette-type="custom:callout"]').exists(),
    ).toBe(true);
  });

  it('clicking a custom block creates a custom block via createCustomBlock', async () => {
    const { editor, addBlock } = makeEditor();
    const customDef = {
      type: 'callout',
      name: 'Callout',
      icon: 'Bell',
      fields: [{ type: 'text', key: 'message', label: 'Msg', default: 'Hi' }],
      template: '',
    } as any;

    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CUSTOM_BLOCK_DEFINITIONS_KEY]: [customDef],
    });

    await wrapper.find('button[data-palette-type="custom:callout"]').trigger('click');

    expect(addBlock).toHaveBeenCalledOnce();
    const inserted = addBlock.mock.calls[0][0];
    expect(inserted.type).toBe('custom');
    expect(inserted.customType).toBe('callout');
    expect(inserted.fieldValues).toEqual({ message: 'Hi' });
  });

  it('insert is a no-op when no editor provider is present', async () => {
    const wrapper = mountSidebar({ [EDITOR_KEY]: null });
    const btn = wrapper.find('button[data-palette-type="title"]');
    await btn.trigger('click');
    // no throw
    expect(btn.exists()).toBe(true);
  });

  // No CLOUD_TRANSLATIONS_KEY provide needed: the saved-blocks strings moved
  // into the OSS chunk, so the rail no longer depends on cloud translations.
  it('shows the saved blocks browser button when the capability is available with count > 0', async () => {
    const { editor } = makeEditor();
    const openBrowser = vi.fn();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CAPABILITIES_KEY]: {
        savedBlocks: {
          count: { value: 3 },
          isAvailable: { value: true },
          openBrowser,
          openSaveDialog: vi.fn(),
        },
      } as any,
    });

    const btn = wrapper.find(
      'button[aria-label="sidebarNav.browseSavedBlocks"]',
    );
    expect(btn.exists()).toBe(true);

    await btn.trigger('click');
    expect(openBrowser).toHaveBeenCalledTimes(1);
  });

  /* Inverted deliberately: this used to require `count > 0`. Gating on the
     loaded count meant the entry only appeared once the consumer's `list()`
     resolved — a slow endpoint shifted the rail mid-session, and an empty
     library hid the feature so a user could never discover it or learn the
     save flow. The list is now fetched when the browser opens, so availability
     is the whole gate and an empty library opens to the empty state. */
  it('shows the saved blocks browser even when nothing is loaded yet', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CAPABILITIES_KEY]: {
        savedBlocks: {
          count: { value: 0 },
          isAvailable: { value: true },
          openBrowser: vi.fn(),
          openSaveDialog: vi.fn(),
        },
      } as any,
    });

    expect(
      wrapper
        .find('button[aria-label="sidebarNav.browseSavedBlocks"]')
        .exists(),
    ).toBe(true);
  });

  it('renders no count badge — it would pop in when the list lands', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CAPABILITIES_KEY]: {
        savedBlocks: {
          count: { value: 7 },
          isAvailable: { value: true },
          openBrowser: vi.fn(),
          openSaveDialog: vi.fn(),
        },
      } as any,
    });

    const btn = wrapper.find(
      'button[aria-label="sidebarNav.browseSavedBlocks"]',
    );
    expect(btn.exists()).toBe(true);
    // The count is still on the capability, just not rendered here.
    expect(btn.text()).not.toContain('7');
  });

  // Guards the dead-button class of bug: Cloud provides the capability before
  // its plan config resolves, so an unavailable feature must render nothing
  // even when the list happens to be non-empty.
  it('does NOT show the saved blocks browser when the feature is unavailable', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CAPABILITIES_KEY]: {
        savedBlocks: {
          count: { value: 3 },
          isAvailable: { value: false },
          openBrowser: vi.fn(),
          openSaveDialog: vi.fn(),
        },
      } as any,
    });

    expect(
      wrapper
        .find('button[aria-label="sidebarNav.browseSavedBlocks"]')
        .exists(),
    ).toBe(false);
  });

  it('does NOT show the saved blocks browser when no capability is provided', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CAPABILITIES_KEY]: {} as any,
    });

    expect(
      wrapper
        .find('button[aria-label="sidebarNav.browseSavedBlocks"]')
        .exists(),
    ).toBe(false);
  });
});

describe('Sidebar — blocks (palette allowlist + order)', () => {
  function paletteTypes(wrapper: ReturnType<typeof mountSidebar>): (string | undefined)[] {
    return wrapper
      .findAll('button[data-palette-type]')
      .map((b) => b.attributes('data-palette-type'));
  }

  it('restricts the palette to the listed types, in the given order', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [PALETTE_BLOCKS_KEY]: ['button', 'section', 'image'],
    });
    expect(paletteTypes(wrapper)).toEqual(['button', 'section', 'image']);
  });

  it('treats an empty blocks array as the full default palette', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [PALETTE_BLOCKS_KEY]: [],
    });
    expect(paletteTypes(wrapper)).toEqual([
      'section',
      'image',
      'title',
      'paragraph',
      'button',
      'divider',
      'video',
      'social',
      'menu',
      'table',
      'spacer',
      'html',
    ]);
  });

  it('interleaves a custom block among built-ins via the custom: prefix', () => {
    const { editor } = makeEditor();
    const customDef = {
      type: 'qrcode',
      name: 'QR Code',
      icon: 'QrCode',
      fields: [],
      template: '',
    } as any;
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CUSTOM_BLOCK_DEFINITIONS_KEY]: [customDef],
      [PALETTE_BLOCKS_KEY]: ['section', 'custom:qrcode', 'button'],
    });
    expect(paletteTypes(wrapper)).toEqual(['section', 'custom:qrcode', 'button']);
  });

  it('warns once and skips an unknown blocks entry', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [PALETTE_BLOCKS_KEY]: ['section', 'nope', 'image'],
    });

    expect(paletteTypes(wrapper)).toEqual(['section', 'image']);

    const nopeWarns = warnSpy.mock.calls.filter((c) =>
      String(c[1]).includes('"nope"'),
    );
    expect(nopeWarns).toHaveLength(1);
    expect(nopeWarns[0][0]).toBe('[Templatical]');
    warnSpy.mockRestore();
  });

  it('skips and warns countdown when listed without a plan capability', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [PALETTE_BLOCKS_KEY]: ['section', 'countdown'],
    });

    expect(paletteTypes(wrapper)).toEqual(['section']);
    expect(
      warnSpy.mock.calls.some((c) => String(c[1]).includes('"countdown"')),
    ).toBe(true);
    warnSpy.mockRestore();
  });

  it('includes countdown when listed and the plan capability is present', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CAPABILITIES_KEY]: { plan: { hasFeature: () => true } } as any,
      [PALETTE_BLOCKS_KEY]: ['section', 'countdown'],
    });
    expect(paletteTypes(wrapper)).toEqual(['section', 'countdown']);
  });
});
