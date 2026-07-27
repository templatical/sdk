// @vitest-environment happy-dom
import './dom-stubs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref, nextTick } from 'vue';
import SaveBlockDialog from '../src/components/SaveBlockDialog.vue';
import SavedBlocksBrowserModal from '../src/components/SavedBlocksBrowserModal.vue';
import { mountEditor } from './helpers/mount';
import {
  EDITOR_KEY,
  SAVED_BLOCKS_KEY,
  POPOVER_ROOT_KEY,
  CUSTOM_BLOCK_DEFINITIONS_KEY,
  TRANSLATIONS_KEY,
} from '../src/keys';
import en from '../src/i18n/locales/en';
import {
  createTitleBlock,
  createButtonBlock,
  createCustomBlock,
} from '@templatical/types';
import type {
  Block,
  CustomBlockDefinition,
  SavedBlock,
} from '@templatical/types';

/**
 * Both dialogs wrap TplModal, which teleports into the injected popover root —
 * so the rendered subtree lives outside `wrapper.element` and assertions query
 * the popover root directly (same approach as `tplModal.test.ts`).
 */
let popoverRootEl: HTMLElement;

beforeEach(() => {
  popoverRootEl = document.createElement('div');
  popoverRootEl.className = 'tpl-popover-root';
  document.body.appendChild(popoverRootEl);
});

afterEach(() => {
  popoverRootEl.remove();
});

function q<T extends Element = HTMLElement>(sel: string): T | null {
  return popoverRootEl.querySelector<T>(sel);
}

function qAll<T extends Element = HTMLElement>(sel: string): T[] {
  return Array.from(popoverRootEl.querySelectorAll<T>(sel));
}

function get<T extends Element = HTMLElement>(sel: string): T {
  const el = q<T>(sel);
  if (!el) throw new Error(`Not found in popover root: ${sel}`);
  return el;
}

/** Buttons carry stubbed translation keys as text (see helpers/translations). */
function buttonByText(text: string): HTMLButtonElement {
  const match = qAll<HTMLButtonElement>('button').find(
    (b) => b.textContent?.trim() === text,
  );
  if (!match) throw new Error(`No button with text "${text}"`);
  return match;
}

async function click(el: Element): Promise<void> {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await nextTick();
}

async function setValue(
  el: HTMLInputElement | HTMLSelectElement,
  value: string,
): Promise<void> {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  await nextTick();
}

async function keydown(el: Element, key: string): Promise<void> {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  await nextTick();
}

function makeEditor(blocks: Block[], selectedBlockId: string | null = null) {
  return {
    content: ref({ blocks, settings: {} }),
    state: { selectedBlockId },
    addBlock: vi.fn(),
    selectBlock: vi.fn(),
  } as any;
}

/**
 * `permissions` overrides the provider-level capability flags; per-entry
 * `canUpdate` / `canDelete` come from the fixtures themselves.
 */
function makeHeadless(
  saved: SavedBlock[] = [],
  permissions: { create?: boolean; update?: boolean; delete?: boolean } = {},
) {
  const savedBlocks = ref(saved);
  const canCreate = computed(() => permissions.create !== false);
  const canUpdate = computed(() => permissions.update !== false);
  const canDelete = computed(() => permissions.delete !== false);
  return {
    savedBlocks,
    isLoading: ref(false),
    canCreate,
    canUpdate,
    canDelete,
    // Mirrors core: capability AND the entry not opting out, absent = allowed.
    canUpdateBlock: (b: SavedBlock) =>
      canUpdate.value && b.canUpdate !== false,
    canDeleteBlock: (b: SavedBlock) =>
      canDelete.value && b.canDelete !== false,
    // Mirrors the real derivation so the dialogs' category UI sees what the
    // composable would actually give them.
    categories: computed(() =>
      [
        ...new Set(
          savedBlocks.value.map((b) => b.category?.trim()).filter(Boolean),
        ),
      ].sort() as string[],
    ),
    load: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({ id: 'new', name: 'New', content: [] }),
    update: vi
      .fn()
      .mockResolvedValue({ id: 'a', name: 'Renamed', content: [] }),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

describe('SaveBlockDialog', () => {
  /**
   * The dialog names the picked blocks and previews them in a reorderable
   * list — which blocks are in it was settled by the canvas pick session.
   *
   * `SavedBlockPreviewCanvas` is stubbed: the rows' own structure (handle,
   * order, count) is what's under test, not the block components it renders.
   */
  function mountDialog(
    blocks: Block[],
    pickedIds: string[],
    headless = makeHeadless(),
  ) {
    const wrapper = mountEditor(SaveBlockDialog, {
      props: { visible: true, pickedIds },
      attachTo: document.body,
      provides: {
        [EDITOR_KEY]: makeEditor(blocks),
        [SAVED_BLOCKS_KEY]: headless,
        [POPOVER_ROOT_KEY]: ref<HTMLElement | null>(popoverRootEl),
      },
      global: { stubs: { SavedBlockPreviewCanvas: true } },
    } as never);
    return { wrapper, headless };
  }

  /** Preview rows in render order, identified by the block each one shows. */
  function rowBlockIds(): string[] {
    return qAll('[data-testid="saved-blocks-reorder-row"]').map(
      (row) => row.getAttribute('data-block-id') ?? '',
    );
  }

  function handles(): HTMLButtonElement[] {
    return qAll<HTMLButtonElement>(
      '[data-testid="saved-blocks-reorder-handle"]',
    );
  }

  async function fillAndSave(name: string): Promise<void> {
    await setValue(get<HTMLInputElement>('input[type="text"]'), name);
    await click(buttonByText('savedBlocks.save'));
    await nextTick();
  }

  it('has no block checklist — picking happened on the canvas', async () => {
    const a = createTitleBlock();
    mountDialog([a, createButtonBlock()], [a.id]);
    await nextTick();

    expect(qAll('button[role="switch"]')).toHaveLength(0);
  });

  it('saves exactly the picked blocks', async () => {
    const a = createTitleBlock();
    const b = createButtonBlock();
    const { headless } = mountDialog([a, b], [b.id]);
    await nextTick();

    await fillAndSave('My Footer');

    expect(headless.create).toHaveBeenCalledTimes(1);
    const [name, content] = headless.create.mock.calls[0];
    expect(name).toBe('My Footer');
    expect(content).toHaveLength(1);
    expect(content[0].id).toBe(b.id);
  });

  /**
   * Selection order, NOT document order. The order the user picks in is the
   * order they mean, and the dialog's list makes it visible and editable —
   * silently re-deriving it from the canvas would discard that intent.
   * `pickedIds` carries it: the session's `Set` iterates in insertion order.
   */
  it('saves in pick order, not document order', async () => {
    const a = createTitleBlock();
    const b = createButtonBlock();
    const c = createTitleBlock();
    // Picked last-to-first; the pick order is what must win.
    const { headless } = mountDialog([a, b, c], [c.id, a.id]);
    await nextTick();

    await fillAndSave('Pair');

    const content = headless.create.mock.calls[0][1];
    expect(content.map((x: { id: string }) => x.id)).toEqual([c.id, a.id]);
  });

  it('renders one preview row per picked block, in pick order', async () => {
    const a = createTitleBlock();
    const b = createButtonBlock();
    const c = createTitleBlock();
    mountDialog([a, b, c], [c.id, a.id, b.id]);
    await nextTick();

    expect(rowBlockIds()).toEqual([c.id, a.id, b.id]);
  });

  it('renders no row for an id that no longer resolves', async () => {
    const a = createTitleBlock();
    const b = createButtonBlock();
    mountDialog([a, b], [a.id, 'deleted-mid-session', b.id]);
    await nextTick();

    expect(rowBlockIds()).toEqual([a.id, b.id]);
  });

  /**
   * Sortable is pointer-event driven (force-fallback) and can't be driven in
   * jsdom/happy-dom, so the keyboard path — which exists for accessibility
   * parity with the canvas — is also how reordering is covered here.
   */
  it('arrow-down on a handle moves that block later in the saved order', async () => {
    const a = createTitleBlock();
    const b = createButtonBlock();
    const c = createTitleBlock();
    const { headless } = mountDialog([a, b, c], [a.id, b.id, c.id]);
    await nextTick();

    await keydown(handles()[0], 'ArrowDown');

    expect(rowBlockIds()).toEqual([b.id, a.id, c.id]);

    await fillAndSave('Reordered');

    const content = headless.create.mock.calls[0][1];
    expect(content.map((x: { id: string }) => x.id)).toEqual([b.id, a.id, c.id]);
  });

  it('arrow-up on a handle moves that block earlier in the saved order', async () => {
    const a = createTitleBlock();
    const b = createButtonBlock();
    const { headless } = mountDialog([a, b], [a.id, b.id]);
    await nextTick();

    await keydown(handles()[1], 'ArrowUp');

    expect(rowBlockIds()).toEqual([b.id, a.id]);

    await fillAndSave('Swapped');

    expect(
      headless.create.mock.calls[0][1].map((x: { id: string }) => x.id),
    ).toEqual([b.id, a.id]);
  });

  it('refuses to move the first row up or the last row down', async () => {
    const a = createTitleBlock();
    const b = createButtonBlock();
    mountDialog([a, b], [a.id, b.id]);
    await nextTick();

    await keydown(handles()[0], 'ArrowUp');
    expect(rowBlockIds()).toEqual([a.id, b.id]);

    await keydown(handles()[1], 'ArrowDown');
    expect(rowBlockIds()).toEqual([a.id, b.id]);

    // Positive control: the same handles DO move when the move is in range.
    await keydown(handles()[0], 'ArrowDown');
    expect(rowBlockIds()).toEqual([b.id, a.id]);
  });

  it('announces a keyboard move in the live region', async () => {
    const a = createTitleBlock();
    const b = createButtonBlock();
    mountDialog([a, b], [a.id, b.id]);
    await nextTick();

    const live = get('[role="status"]');
    expect(live.textContent?.trim()).toBe('');

    await keydown(handles()[0], 'ArrowDown');

    // Stub translations echo key paths, so the wording is never hard-coded
    // here — only that the announcement resolves through the i18n key.
    expect(live.textContent).toContain('savedBlocks.reorderAnnouncement');
  });

  it('announces nothing for a refused move', async () => {
    const a = createTitleBlock();
    const b = createButtonBlock();
    mountDialog([a, b], [a.id, b.id]);
    await nextTick();

    await keydown(handles()[0], 'ArrowUp');

    expect(get('[role="status"]').textContent?.trim()).toBe('');
  });

  it('reordering never leaks a Sortable back-ref into the saved payload', async () => {
    const a = createTitleBlock();
    const b = createButtonBlock();
    const { wrapper, headless } = mountDialog([a, b], [a.id, b.id]);
    await nextTick();

    // What vue-draggable-plus emits: the reordered entries, each potentially
    // carrying a Sortable `el` expando. The dialog reads ids off them and
    // re-resolves from editor state, so the expando can't reach the provider.
    const emitted = [
      { ...b, el: document.createElement('div') },
      { ...a, el: document.createElement('div') },
    ];
    (wrapper.vm as any).orderedBlocks = emitted;
    await nextTick();

    await fillAndSave('Clean');

    const content = headless.create.mock.calls[0][1];
    expect(content.map((x: { id: string }) => x.id)).toEqual([b.id, a.id]);
    expect(content[0]).not.toHaveProperty('el');
    expect(content[1]).not.toHaveProperty('el');
  });

  /* `translations.blocks` has no `custom` key, so a type-only lookup rendered
     every custom block as the literal word "custom" — identical rows for two
     different blocks, in the one dialog whose job is telling them apart. */
  describe('custom block labels', () => {
    const featuredArticle = {
      type: 'featured-article',
      name: 'Featured Article',
      fields: [],
      template: '',
    } as CustomBlockDefinition;

    /**
     * Uses the REAL `en` translations, not the key-path stubs: the labels here
     * are interpolated through `format()`, and the stub proxy swallows the
     * substituted values (it returns a dot-path for `.replace`), so the block
     * name would never reach the rendered string.
     */
    function mountWithDefinitions(
      blocks: Block[],
      pickedIds: string[],
      definitions: CustomBlockDefinition[],
    ) {
      return mountEditor(SaveBlockDialog, {
        props: { visible: true, pickedIds },
        attachTo: document.body,
        provides: {
          [EDITOR_KEY]: makeEditor(blocks),
          [SAVED_BLOCKS_KEY]: makeHeadless(),
          [POPOVER_ROOT_KEY]: ref<HTMLElement | null>(popoverRootEl),
          [CUSTOM_BLOCK_DEFINITIONS_KEY]: definitions,
          [TRANSLATIONS_KEY]: en,
        },
        global: { stubs: { SavedBlockPreviewCanvas: true } },
      } as never);
    }

    it("names a custom block by the consumer's definition, not its type", async () => {
      const custom = createCustomBlock(featuredArticle);
      mountWithDefinitions([custom], [custom.id], [featuredArticle]);
      await nextTick();

      const summary = get('[data-testid="saved-blocks-save-summary"]');
      expect(summary.textContent).toContain('Featured Article');
      expect(summary.textContent).not.toContain('custom');
    });

    it("labels the drag handle with the custom block's name", async () => {
      const custom = createCustomBlock(featuredArticle);
      mountWithDefinitions([custom], [custom.id], [featuredArticle]);
      await nextTick();

      const handle = get('[data-testid="saved-blocks-reorder-handle"]');
      expect(handle.getAttribute('aria-label')).toContain('Featured Article');
    });

    it('falls back to the customType slug when no definition is provided', async () => {
      const custom = createCustomBlock(featuredArticle);
      mountWithDefinitions([custom], [custom.id], []);
      await nextTick();

      const summary = get('[data-testid="saved-blocks-save-summary"]');
      // Still specific to the block, and never the bare word "custom".
      expect(summary.textContent).toContain('featured-article');
    });

    it('keeps built-in labels working alongside a custom block', async () => {
      const custom = createCustomBlock(featuredArticle);
      const title = createTitleBlock();
      mountWithDefinitions(
        [custom, title],
        [custom.id, title.id],
        [featuredArticle],
      );
      await nextTick();

      const summary = get('[data-testid="saved-blocks-save-summary"]');
      expect(summary.textContent).toContain('Featured Article');
      expect(summary.textContent).toContain('Title');
    });
  });


  describe('category', () => {
    it('sends the typed category to create', async () => {
      const a = createTitleBlock();
      const { headless } = mountDialog([a], [a.id]);
      await nextTick();

      await setValue(
        get<HTMLInputElement>('[data-testid="saved-blocks-category-input"]'),
        'Promos',
      );
      await fillAndSave('Hero');

      expect(headless.create).toHaveBeenCalledWith('Hero', [a], 'Promos');
    });

    it('sends undefined when the category is left blank', async () => {
      const a = createTitleBlock();
      const { headless } = mountDialog([a], [a.id]);
      await nextTick();

      await fillAndSave('Hero');

      // An entry is either categorised or it is not — "" would surface as a
      // nameless option in the browser's filter.
      expect(headless.create).toHaveBeenCalledWith('Hero', [a], undefined);
    });

    it('sends undefined for a whitespace-only category', async () => {
      const a = createTitleBlock();
      const { headless } = mountDialog([a], [a.id]);
      await nextTick();

      await setValue(
        get<HTMLInputElement>('[data-testid="saved-blocks-category-input"]'),
        '   ',
      );
      await fillAndSave('Hero');

      expect(headless.create.mock.calls[0][2]).toBe(undefined);
    });

    it('trims the category before saving', async () => {
      const a = createTitleBlock();
      const { headless } = mountDialog([a], [a.id]);
      await nextTick();

      await setValue(
        get<HTMLInputElement>('[data-testid="saved-blocks-category-input"]'),
        '  Promos  ',
      );
      await fillAndSave('Hero');

      expect(headless.create.mock.calls[0][2]).toBe('Promos');
    });

    it('offers the already-used categories as datalist suggestions', async () => {
      const a = createTitleBlock();
      const headless = makeHeadless([
        { id: 'x', name: 'X', content: [], category: 'Promos' },
        { id: 'y', name: 'Y', content: [], category: 'Headers' },
      ]);
      mountDialog([a], [a.id], headless);
      await nextTick();

      const options = qAll<HTMLOptionElement>(
        '#tpl-saved-block-categories option',
      );
      expect(options.map((o) => o.value)).toEqual(['Headers', 'Promos']);
    });

    it('resets the category when the dialog reopens', async () => {
      const a = createTitleBlock();
      const { wrapper } = mountDialog([a], [a.id]);
      await nextTick();

      const input = get<HTMLInputElement>(
        '[data-testid="saved-blocks-category-input"]',
      );
      await setValue(input, 'Promos');

      await wrapper.setProps({ visible: false });
      await wrapper.setProps({ visible: true });
      await nextTick();

      expect(
        get<HTMLInputElement>('[data-testid="saved-blocks-category-input"]')
          .value,
      ).toBe('');
    });
  });

  it('shows a read-only summary of what is being saved', async () => {
    const a = createTitleBlock();
    const b = createButtonBlock();
    mountDialog([a, b], [a.id, b.id]);
    await nextTick();

    const summary = get('[data-testid="saved-blocks-save-summary"]');
    // Stub translations echo key paths; the count is interpolated by format().
    expect(summary.textContent).toContain('savedBlocks.savingCount');
    expect(summary.textContent).toContain('blocks.title');
    expect(summary.textContent).toContain('blocks.button');
  });

  it('trims the name before saving', async () => {
    const a = createTitleBlock();
    const { headless } = mountDialog([a], [a.id]);
    await nextTick();

    await fillAndSave('   Padded   ');

    expect(headless.create.mock.calls[0][0]).toBe('Padded');
  });

  it('does not save when the name is blank', async () => {
    const a = createTitleBlock();
    const { headless } = mountDialog([a], [a.id]);
    await nextTick();

    await fillAndSave('   ');

    expect(headless.create).not.toHaveBeenCalled();
  });

  it('emits saved + close on success', async () => {
    const a = createTitleBlock();
    const { wrapper } = mountDialog([a], [a.id]);
    await nextTick();

    await fillAndSave('Named');

    expect(wrapper.emitted('saved')).toHaveLength(1);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('shows the provider error and stays open when create rejects', async () => {
    const a = createTitleBlock();
    const headless = makeHeadless();
    headless.create = vi.fn().mockRejectedValue(new Error('Quota exceeded'));
    const { wrapper } = mountDialog([a], [a.id], headless);
    await nextTick();

    await fillAndSave('Named');
    await nextTick();

    expect(get('[role="alert"]').textContent?.trim()).toBe('Quota exceeded');
    expect(wrapper.emitted('close')).toBeUndefined();
  });

  // Defence in depth: ids that no longer resolve must never produce an empty
  // saved block (it would list as "0 block(s)" and insert nothing).
  it('never creates a saved block from ids that no longer resolve', async () => {
    const a = createTitleBlock();
    const { headless } = mountDialog([a], ['deleted-mid-session']);
    await nextTick();

    await fillAndSave('Named');

    expect(headless.create).not.toHaveBeenCalled();
  });

  it('drops unresolvable ids but still saves the ones that resolve', async () => {
    const a = createTitleBlock();
    const { headless } = mountDialog([a], [a.id, 'deleted-mid-session']);
    await nextTick();

    await fillAndSave('Named');

    const content = headless.create.mock.calls[0][1];
    expect(content).toHaveLength(1);
    expect(content[0].id).toBe(a.id);
  });
});

describe('SavedBlocksBrowserModal', () => {
  const savedA: SavedBlock = {
    id: 'a',
    name: 'Header',
    content: [createTitleBlock()],
  };
  const savedB: SavedBlock = {
    id: 'b',
    name: 'Footer',
    content: [createButtonBlock(), createTitleBlock()],
  };

  function mountBrowser(
    saved: SavedBlock[] = [savedA, savedB],
    blocks: Block[] = [createTitleBlock()],
    selectedBlockId: string | null = null,
  ) {
    const headless = makeHeadless(saved);
    const wrapper = mountEditor(SavedBlocksBrowserModal, {
      props: { visible: true },
      attachTo: document.body,
      provides: {
        [EDITOR_KEY]: makeEditor(blocks, selectedBlockId),
        [SAVED_BLOCKS_KEY]: headless,
        [POPOVER_ROOT_KEY]: ref<HTMLElement | null>(popoverRootEl),
      },
      global: { stubs: { SavedBlockPreviewCanvas: true } },
    } as any);
    return { wrapper, headless };
  }

  function cards(): HTMLButtonElement[] {
    return qAll<HTMLButtonElement>('button[aria-pressed]');
  }

  it('renders one card per saved block', async () => {
    mountBrowser();
    await nextTick();

    expect(cards()).toHaveLength(2);
  });

  it('filters by name, case-insensitively', async () => {
    mountBrowser();
    await nextTick();

    await setValue(get<HTMLInputElement>('input[type="text"]'), 'foot');

    const remaining = cards();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].textContent).toContain('Footer');
  });

  it('shows the no-results message when a search matches nothing', async () => {
    mountBrowser();
    await nextTick();

    await setValue(get<HTMLInputElement>('input[type="text"]'), 'zzz');

    expect(popoverRootEl.textContent).toContain('savedBlocks.noResults');
    expect(popoverRootEl.textContent).not.toContain('savedBlocks.emptyHint');
  });

  it('shows the empty state and hint when nothing is saved', async () => {
    mountBrowser([]);
    await nextTick();

    expect(popoverRootEl.textContent).toContain('savedBlocks.empty');
    expect(popoverRootEl.textContent).toContain('savedBlocks.emptyHint');
  });

  it('emits insert with undefined index when position is "end"', async () => {
    const { wrapper } = mountBrowser();
    await nextTick();

    await click(cards()[0]);
    await click(buttonByText('savedBlocks.insert'));

    const inserted = wrapper.emitted('insert');
    expect(inserted).toHaveLength(1);
    expect((inserted![0][0] as SavedBlock).id).toBe('a');
    expect(inserted![0][1]).toBe(undefined);
  });

  it('emits insert with index 0 for "beginning"', async () => {
    const { wrapper } = mountBrowser();
    await nextTick();

    await click(cards()[0]);
    await setValue(get<HTMLSelectElement>('select'), 'beginning');
    await click(buttonByText('savedBlocks.insert'));

    expect(wrapper.emitted('insert')![0][1]).toBe(0);
  });

  it('emits insert after the chosen block', async () => {
    const canvasBlock = createTitleBlock();
    const { wrapper } = mountBrowser([savedA], [canvasBlock]);
    await nextTick();

    await click(cards()[0]);
    await setValue(get<HTMLSelectElement>('select'), canvasBlock.id);
    await click(buttonByText('savedBlocks.insert'));

    // Inserting after canvas index 0 resolves to index 1.
    expect(wrapper.emitted('insert')![0][1]).toBe(1);
  });

  it('does not emit insert when nothing is selected', async () => {
    const { wrapper } = mountBrowser();
    await nextTick();

    await click(buttonByText('savedBlocks.insert'));

    expect(wrapper.emitted('insert')).toBeUndefined();
  });

  it('requires confirmation before deleting', async () => {
    const { headless } = mountBrowser();
    await nextTick();

    await click(get('button[aria-label="savedBlocks.delete"]'));
    expect(headless.remove).not.toHaveBeenCalled();

    await click(get('button[aria-label="savedBlocks.deleteConfirm"]'));
    expect(headless.remove).toHaveBeenCalledWith('a');
  });

  it('renames through update() with a name-only patch', async () => {
    const { headless } = mountBrowser();
    await nextTick();

    await click(get('button[aria-label="savedBlocks.rename"]'));
    const input = get<HTMLInputElement>('input[aria-label="savedBlocks.rename"]');
    await setValue(input, 'Renamed Header');
    await keydown(input, 'Enter');

    expect(headless.update).toHaveBeenCalledWith('a', {
      name: 'Renamed Header',
    });
  });

  it('skips the update when the name is unchanged', async () => {
    const { headless } = mountBrowser();
    await nextTick();

    await click(get('button[aria-label="savedBlocks.rename"]'));
    await keydown(
      get('input[aria-label="savedBlocks.rename"]'),
      'Enter',
    );

    expect(headless.update).not.toHaveBeenCalled();
  });

  it('skips the update when the name is blanked', async () => {
    const { headless } = mountBrowser();
    await nextTick();

    await click(get('button[aria-label="savedBlocks.rename"]'));
    const input = get<HTMLInputElement>('input[aria-label="savedBlocks.rename"]');
    await setValue(input, '   ');
    await keydown(input, 'Enter');

    expect(headless.update).not.toHaveBeenCalled();
  });

  it('escape cancels a rename without updating', async () => {
    const { headless } = mountBrowser();
    await nextTick();

    await click(get('button[aria-label="savedBlocks.rename"]'));
    const input = get<HTMLInputElement>('input[aria-label="savedBlocks.rename"]');
    await setValue(input, 'Discarded');
    await keydown(input, 'Escape');

    expect(headless.update).not.toHaveBeenCalled();
    // The row reverts to its card form.
    expect(cards()).toHaveLength(2);
  });

  describe('provider order + timestamp label', () => {
    const iso = (min: number) =>
      new Date(Date.UTC(2026, 0, 1, 12, 0, 0) - min * 60_000).toISOString();

    /** The name lives in the card's first <span>; later spans hold the badge. */
    function cardNames(): string[] {
      return cards().map(
        (c) => c.querySelector('span')?.textContent?.trim() ?? '',
      );
    }

    // Ordering belongs to the provider: the modal must render `list()`'s order
    // verbatim, never re-sort — not by recency, not by name.
    it('renders entries in provider order, not sorted by timestamp', async () => {
      mountBrowser([
        {
          id: 'oldest',
          name: 'Oldest first',
          content: [createTitleBlock()],
          updatedAt: iso(5000),
        },
        {
          id: 'newest',
          name: 'Newest second',
          content: [createTitleBlock()],
          updatedAt: iso(1),
        },
      ]);
      await nextTick();

      // Provider put the older entry first — it stays first.
      expect(cardNames()).toEqual(['Oldest first', 'Newest second']);
    });

    it('preserves provider order when some entries have no timestamp', async () => {
      mountBrowser([
        { id: 'u1', name: 'Undated one', content: [createTitleBlock()] },
        {
          id: 'd1',
          name: 'Dated',
          content: [createTitleBlock()],
          updatedAt: iso(50),
        },
        { id: 'u2', name: 'Undated two', content: [createTitleBlock()] },
      ]);
      await nextTick();

      expect(cardNames()).toEqual([
        'Undated one',
        'Dated',
        'Undated two',
      ]);
    });

    it('preserves provider order while filtering by search', async () => {
      mountBrowser([
        { id: 'b', name: 'Beta match', content: [createTitleBlock()] },
        { id: 'a', name: 'Alpha match', content: [createTitleBlock()] },
        { id: 'c', name: 'Gamma other', content: [createTitleBlock()] },
      ]);
      await nextTick();

      await setValue(get<HTMLInputElement>('input[type="text"]'), 'match');

      // Filtered down, still in the provider's order (not alphabetized).
      expect(cardNames()).toEqual(['Beta match', 'Alpha match']);
    });

    it('renders a relative timestamp label with an absolute tooltip', async () => {
      mountBrowser([
        {
          id: 'a',
          name: 'Recent',
          content: [createTitleBlock()],
          updatedAt: iso(5),
        },
      ]);
      await nextTick();

      const label = q('[data-testid="saved-block-updated"]');
      expect(label).not.toBe(null);
      // Resolves through the savedBlocks.time.* labels (stub translations
      // return key paths), so wording is never hard-coded in the component.
      expect(label!.textContent?.trim()).toContain('savedBlocks.time.');
      expect(label!.getAttribute('title')).not.toBe('');
    });

    it('falls back to createdAt for the label when updatedAt is absent', async () => {
      mountBrowser([
        {
          id: 'a',
          name: 'Created only',
          content: [createTitleBlock()],
          createdAt: iso(30),
        },
      ]);
      await nextTick();

      expect(q('[data-testid="saved-block-updated"]')).not.toBe(null);
    });

    it('omits the timestamp label when no timestamp is available', async () => {
      mountBrowser([
        { id: 'a', name: 'No stamp', content: [createTitleBlock()] },
      ]);
      await nextTick();

      expect(qAll('[data-testid="saved-block-updated"]')).toHaveLength(0);
    });

    it('omits the timestamp label when the timestamp is unparseable', async () => {
      mountBrowser([
        {
          id: 'a',
          name: 'Bad stamp',
          content: [createTitleBlock()],
          updatedAt: 'not-a-date',
        },
      ]);
      await nextTick();

      expect(qAll('[data-testid="saved-block-updated"]')).toHaveLength(0);
    });
  });


  describe('category filtering', () => {
    const promoA: SavedBlock = {
      id: 'p1',
      name: 'Spring sale',
      content: [createTitleBlock()],
      category: 'Promos',
    };
    const promoB: SavedBlock = {
      id: 'p2',
      name: 'Winter sale',
      content: [createTitleBlock()],
      category: 'Promos',
    };
    const header: SavedBlock = {
      id: 'h1',
      name: 'Spring header',
      content: [createTitleBlock()],
      category: 'Headers',
    };
    const loose: SavedBlock = {
      id: 'u1',
      name: 'Uncategorised',
      content: [createTitleBlock()],
    };

    function categorySelect(): HTMLSelectElement {
      return get<HTMLSelectElement>(
        '[data-testid="saved-blocks-category-filter"]',
      );
    }

    function cardNames(): string[] {
      return cards().map(
        (c) => c.querySelector('span')?.textContent?.trim() ?? '',
      );
    }

    /* Filtering runs in memory over the loaded entries. That is what keeps a
       BYO provider at four dumb methods, and it is the only reason the option
       list below can be derived at all — a provider-filtered response could
       not say which other categories exist. */
    it('narrows the list to the chosen category', async () => {
      mountBrowser([promoA, header, loose]);
      await nextTick();

      await setValue(categorySelect(), 'Promos');

      expect(cardNames()).toEqual(['Spring sale']);
    });

    it('shows everything again when the filter is cleared', async () => {
      mountBrowser([promoA, header, loose]);
      await nextTick();

      await setValue(categorySelect(), 'Promos');
      await setValue(categorySelect(), '');

      expect(cardNames()).toEqual([
        'Spring sale',
        'Spring header',
        'Uncategorised',
      ]);
    });

    it('composes with the search box', async () => {
      mountBrowser([promoA, promoB, header]);
      await nextTick();

      await setValue(categorySelect(), 'Promos');
      await setValue(get<HTMLInputElement>('input[type="text"]'), 'spring');

      // "Spring header" matches the search but not the category; "Winter sale"
      // matches the category but not the search.
      expect(cardNames()).toEqual(['Spring sale']);
    });

    it('excludes uncategorised entries from a category filter', async () => {
      mountBrowser([promoA, loose]);
      await nextTick();

      await setValue(categorySelect(), 'Promos');

      expect(cardNames()).toEqual(['Spring sale']);
    });

    it('preserves provider order while filtering', async () => {
      mountBrowser([promoB, header, promoA]);
      await nextTick();

      await setValue(categorySelect(), 'Promos');

      // Provider put Winter before Spring — filtering must not re-sort.
      expect(cardNames()).toEqual(['Winter sale', 'Spring sale']);
    });

    it('shows the no-results state when a filter matches nothing', async () => {
      mountBrowser([promoA]);
      await nextTick();

      await setValue(get<HTMLInputElement>('input[type="text"]'), 'zzz');

      expect(popoverRootEl.textContent).toContain('savedBlocks.noResults');
      expect(popoverRootEl.textContent).not.toContain('savedBlocks.emptyHint');
    });

    it('lists each category once, sorted, as filter options', async () => {
      mountBrowser([promoA, header, promoB, loose]);
      await nextTick();

      const values = Array.from(categorySelect().options).map((o) => o.value);
      expect(values).toEqual(['', 'Headers', 'Promos']);
    });

    it('hides the filter entirely when nothing is categorised', async () => {
      mountBrowser([loose]);
      await nextTick();

      expect(qAll('[data-testid="saved-blocks-category-filter"]')).toHaveLength(
        0,
      );
    });

    it('shows the category on the card, and omits it when absent', async () => {
      mountBrowser([promoA, loose]);
      await nextTick();

      const badges = qAll('[data-testid="saved-block-category"]');
      expect(badges).toHaveLength(1);
      expect(badges[0].textContent?.trim()).toBe('Promos');
    });

    it('resets the filter when the modal reopens', async () => {
      const { wrapper } = mountBrowser([promoA, header]);
      await nextTick();

      await setValue(categorySelect(), 'Promos');
      await wrapper.setProps({ visible: false });
      await wrapper.setProps({ visible: true });
      await nextTick();

      expect(categorySelect().value).toBe('');
      expect(cardNames()).toHaveLength(2);
    });
  });

  describe('inline category editing', () => {
    const entry: SavedBlock = {
      id: 'a',
      name: 'Header',
      content: [createTitleBlock()],
      category: 'Promos',
    };

    function editCategoryInput(): HTMLInputElement {
      return get<HTMLInputElement>('[data-testid="saved-blocks-edit-category"]');
    }

    it('seeds the editor with the current category', async () => {
      mountBrowser([entry]);
      await nextTick();

      await click(get('button[aria-label="savedBlocks.rename"]'));

      expect(editCategoryInput().value).toBe('Promos');
    });

    it('patches only the category when only it changed', async () => {
      const { headless } = mountBrowser([entry]);
      await nextTick();

      await click(get('button[aria-label="savedBlocks.rename"]'));
      const input = editCategoryInput();
      await setValue(input, 'Footers');
      await keydown(input, 'Enter');

      expect(headless.update).toHaveBeenCalledWith('a', {
        category: 'Footers',
      });
    });

    it('clears the category with an empty value', async () => {
      const { headless } = mountBrowser([entry]);
      await nextTick();

      await click(get('button[aria-label="savedBlocks.rename"]'));
      const input = editCategoryInput();
      await setValue(input, '');
      await keydown(input, 'Enter');

      // "" is a real instruction here — it uncategorises the entry — unlike an
      // empty name, which falls back to the stored one.
      expect(headless.update).toHaveBeenCalledWith('a', { category: '' });
    });

    it('patches name and category together', async () => {
      const { headless } = mountBrowser([entry]);
      await nextTick();

      await click(get('button[aria-label="savedBlocks.rename"]'));
      await setValue(
        get<HTMLInputElement>('input[aria-label="savedBlocks.rename"]'),
        'Renamed',
      );
      const category = editCategoryInput();
      await setValue(category, 'Footers');
      await keydown(category, 'Enter');

      expect(headless.update).toHaveBeenCalledWith('a', {
        name: 'Renamed',
        category: 'Footers',
      });
    });

    it('skips the round-trip when neither field changed', async () => {
      const { headless } = mountBrowser([entry]);
      await nextTick();

      await click(get('button[aria-label="savedBlocks.rename"]'));
      await keydown(editCategoryInput(), 'Enter');

      expect(headless.update).not.toHaveBeenCalled();
    });

    it('keeps the stored name when the name field is blanked', async () => {
      const { headless } = mountBrowser([entry]);
      await nextTick();

      await click(get('button[aria-label="savedBlocks.rename"]'));
      await setValue(
        get<HTMLInputElement>('input[aria-label="savedBlocks.rename"]'),
        '   ',
      );
      const category = editCategoryInput();
      await setValue(category, 'Footers');
      await keydown(category, 'Enter');

      // Blanking the name must not wipe it — only the category is patched.
      expect(headless.update).toHaveBeenCalledWith('a', {
        category: 'Footers',
      });
    });

    it('escape discards both drafts', async () => {
      const { headless } = mountBrowser([entry]);
      await nextTick();

      await click(get('button[aria-label="savedBlocks.rename"]'));
      const input = editCategoryInput();
      await setValue(input, 'Discarded');
      await keydown(input, 'Escape');

      expect(headless.update).not.toHaveBeenCalled();
      expect(cards()).toHaveLength(1);
    });

    /* Two inputs in one row: a plain per-input blur handler would commit and
       unmount the row the moment focus moved from the name to the category. */
    it('does not commit when focus moves between the two inputs', async () => {
      const { headless } = mountBrowser([entry]);
      await nextTick();

      await click(get('button[aria-label="savedBlocks.rename"]'));
      const name = get<HTMLInputElement>(
        'input[aria-label="savedBlocks.rename"]',
      );
      const category = editCategoryInput();
      await setValue(name, 'Renamed');

      name.dispatchEvent(
        new FocusEvent('focusout', { bubbles: true, relatedTarget: category }),
      );
      await nextTick();

      expect(headless.update).not.toHaveBeenCalled();
      // Still editing — the row did not collapse back to a card.
      expect(qAll('[data-testid="saved-blocks-edit-category"]')).toHaveLength(1);
    });

    it('commits when focus leaves the row entirely', async () => {
      const { headless } = mountBrowser([entry]);
      await nextTick();

      await click(get('button[aria-label="savedBlocks.rename"]'));
      const category = editCategoryInput();
      await setValue(category, 'Footers');

      category.dispatchEvent(
        new FocusEvent('focusout', { bubbles: true, relatedTarget: null }),
      );
      await nextTick();

      expect(headless.update).toHaveBeenCalledWith('a', {
        category: 'Footers',
      });
    });
  });


  describe('permission gating', () => {
    const plain: SavedBlock = {
      id: 'a',
      name: 'Header',
      content: [createTitleBlock()],
    };

    function mountWithPermissions(
      saved: SavedBlock[],
      permissions: { update?: boolean; delete?: boolean } = {},
    ) {
      const headless = makeHeadless(saved, permissions);
      const wrapper = mountEditor(SavedBlocksBrowserModal, {
        props: { visible: true },
        attachTo: document.body,
        provides: {
          [EDITOR_KEY]: makeEditor([createTitleBlock()]),
          [SAVED_BLOCKS_KEY]: headless,
          [POPOVER_ROOT_KEY]: ref<HTMLElement | null>(popoverRootEl),
        },
        global: { stubs: { SavedBlockPreviewCanvas: true } },
      } as never);
      return { wrapper, headless };
    }

    function pencils(): HTMLElement[] {
      return qAll('button[aria-label="savedBlocks.rename"]');
    }

    function trashes(): HTMLElement[] {
      return qAll('button[aria-label="savedBlocks.delete"]');
    }

    it('shows both row actions when everything is permitted', async () => {
      mountWithPermissions([plain]);
      await nextTick();

      expect(pencils()).toHaveLength(1);
      expect(trashes()).toHaveLength(1);
    });

    /* Hidden rather than disabled: an action the user cannot perform is better
       absent than greyed out. */
    it('hides every pencil when the provider withheld update', async () => {
      mountWithPermissions([plain, { ...plain, id: 'b' }], { update: false });
      await nextTick();

      expect(pencils()).toHaveLength(0);
      // Delete is unaffected — the two capabilities are independent.
      expect(trashes()).toHaveLength(2);
    });

    it('hides every trash when the provider withheld delete', async () => {
      mountWithPermissions([plain, { ...plain, id: 'b' }], { delete: false });
      await nextTick();

      expect(trashes()).toHaveLength(0);
      expect(pencils()).toHaveLength(2);
    });

    it('leaves a read-only library browsable with no row actions', async () => {
      mountWithPermissions([plain], { update: false, delete: false });
      await nextTick();

      expect(pencils()).toHaveLength(0);
      expect(trashes()).toHaveLength(0);
      // The entry itself still renders and can be selected for insertion.
      expect(cards()).toHaveLength(1);
    });

    it('hides the pencil only on the entry that opted out', async () => {
      mountWithPermissions([
        { ...plain, id: 'locked', canUpdate: false },
        { ...plain, id: 'free' },
      ]);
      await nextTick();

      // One of two rows keeps its pencil; both keep their trash.
      expect(pencils()).toHaveLength(1);
      expect(trashes()).toHaveLength(2);
    });

    it('hides the trash only on the entry that opted out', async () => {
      mountWithPermissions([
        { ...plain, id: 'locked', canDelete: false },
        { ...plain, id: 'free' },
      ]);
      await nextTick();

      expect(trashes()).toHaveLength(1);
      expect(pencils()).toHaveLength(2);
    });

    it('treats an explicit true per entry as allowed', async () => {
      mountWithPermissions([{ ...plain, canUpdate: true, canDelete: true }]);
      await nextTick();

      expect(pencils()).toHaveLength(1);
      expect(trashes()).toHaveLength(1);
    });

    it('does not open the editor for a row that cannot be updated', async () => {
      // Guards the programmatic path — the pencil is already gone.
      const { wrapper } = mountWithPermissions([
        { ...plain, canUpdate: false },
      ]);
      await nextTick();

      (wrapper.vm as any).startRename({ ...plain, canUpdate: false });
      await nextTick();

      expect(qAll('input[aria-label="savedBlocks.rename"]')).toHaveLength(0);
    });
  });

  it('defaults the insert position to after the selected canvas block', async () => {
    const canvasBlock = createTitleBlock();
    mountBrowser([savedA], [canvasBlock], canvasBlock.id);
    await nextTick();

    expect(get<HTMLSelectElement>('select').value).toBe(canvasBlock.id);
  });
});
