// @vitest-environment happy-dom
import './dom-stubs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref, nextTick } from 'vue';
import SaveBlockDialog from '../src/components/SaveBlockDialog.vue';
import SavedBlocksBrowserModal from '../src/components/SavedBlocksBrowserModal.vue';
import { mountEditor } from './helpers/mount';
import { EDITOR_KEY, SAVED_BLOCKS_KEY, POPOVER_ROOT_KEY } from '../src/keys';
import { createTitleBlock, createButtonBlock } from '@templatical/types';
import type { Block, SavedBlock } from '@templatical/types';

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

function makeHeadless(saved: SavedBlock[] = []) {
  return {
    savedBlocks: ref(saved),
    isLoading: ref(false),
    load: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({ id: 'new', name: 'New', content: [] }),
    update: vi
      .fn()
      .mockResolvedValue({ id: 'a', name: 'Renamed', content: [] }),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

describe('SaveBlockDialog', () => {
  function mountDialog(
    blocks: Block[],
    preSelectedBlockId: string | null = null,
    headless = makeHeadless(),
  ) {
    const wrapper = mountEditor(SaveBlockDialog, {
      props: { visible: true, preSelectedBlockId },
      attachTo: document.body,
      provides: {
        [EDITOR_KEY]: makeEditor(blocks),
        [SAVED_BLOCKS_KEY]: headless,
        [POPOVER_ROOT_KEY]: ref<HTMLElement | null>(popoverRootEl),
      },
    } as any);
    return { wrapper, headless };
  }

  async function fillAndSave(name: string): Promise<void> {
    await setValue(get<HTMLInputElement>('input[type="text"]'), name);
    await click(buttonByText('savedBlocks.save'));
    await nextTick();
  }

  it('lists one toggle per top-level block', async () => {
    mountDialog([createTitleBlock(), createButtonBlock()]);
    await nextTick();

    expect(qAll('button[role="switch"]')).toHaveLength(2);
  });

  it('saves only the pre-selected block when one is passed', async () => {
    const a = createTitleBlock();
    const b = createButtonBlock();
    const { headless } = mountDialog([a, b], b.id);
    await nextTick();

    // Positive control for the aria-checked selector used by the
    // unselectable-pre-selection test below: a valid id DOES check its row.
    expect(qAll('button[role="switch"][aria-checked="true"]')).toHaveLength(1);

    await fillAndSave('My Footer');

    expect(headless.create).toHaveBeenCalledTimes(1);
    const [name, content] = headless.create.mock.calls[0];
    expect(name).toBe('My Footer');
    expect(content).toHaveLength(1);
    expect(content[0].id).toBe(b.id);
  });

  it('trims the name before saving', async () => {
    const a = createTitleBlock();
    const { headless } = mountDialog([a], a.id);
    await nextTick();

    await fillAndSave('   Padded   ');

    expect(headless.create.mock.calls[0][0]).toBe('Padded');
  });

  it('does not save when the name is blank', async () => {
    const a = createTitleBlock();
    const { headless } = mountDialog([a], a.id);
    await nextTick();

    await fillAndSave('   ');

    expect(headless.create).not.toHaveBeenCalled();
  });

  it('does not save when no block is selected', async () => {
    const a = createTitleBlock();
    const { headless } = mountDialog([a], null);
    await nextTick();

    await fillAndSave('Named');

    expect(headless.create).not.toHaveBeenCalled();
  });

  it('emits saved + close on success', async () => {
    const a = createTitleBlock();
    const { wrapper } = mountDialog([a], a.id);
    await nextTick();

    await fillAndSave('Named');

    expect(wrapper.emitted('saved')).toHaveLength(1);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('shows the provider error and stays open when create rejects', async () => {
    const a = createTitleBlock();
    const headless = makeHeadless();
    headless.create = vi.fn().mockRejectedValue(new Error('Quota exceeded'));
    const { wrapper } = mountDialog([a], a.id, headless);
    await nextTick();

    await fillAndSave('Named');
    await nextTick();

    expect(get('[role="alert"]').textContent?.trim()).toBe('Quota exceeded');
    expect(wrapper.emitted('close')).toBeUndefined();
  });

  // Root cause of the nested-block bug: a pre-selected id that isn't in the
  // list left the checklist empty while Save stayed enabled, and saving then
  // persisted an empty saved block. Both halves are guarded below.
  it('ignores a pre-selected id that is not a top-level block', async () => {
    const a = createTitleBlock();
    const { headless } = mountDialog([a], 'id-of-a-section-child');
    await nextTick();

    // Nothing checked...
    expect(
      qAll('button[role="switch"][aria-checked="true"]'),
    ).toHaveLength(0);

    // ...and Save cannot produce anything, even with a name typed.
    await fillAndSave('Named');
    expect(headless.create).not.toHaveBeenCalled();
  });

  it('never creates a saved block with empty content', async () => {
    const a = createTitleBlock();
    const { headless } = mountDialog([a], 'stale-or-nested-id');
    await nextTick();

    await fillAndSave('Named');

    // The critical assertion: no create call at all, rather than create(name, []).
    expect(headless.create).not.toHaveBeenCalled();
    for (const call of headless.create.mock.calls) {
      expect((call[1] as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it('toggling the pre-selected block off blocks the save', async () => {
    const a = createTitleBlock();
    const { headless } = mountDialog([a], a.id);
    await nextTick();

    await click(get('button[role="switch"]'));
    await fillAndSave('Named');

    expect(headless.create).not.toHaveBeenCalled();
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
          updated_at: iso(5000),
        },
        {
          id: 'newest',
          name: 'Newest second',
          content: [createTitleBlock()],
          updated_at: iso(1),
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
          updated_at: iso(50),
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
          updated_at: iso(5),
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

    it('falls back to created_at for the label when updated_at is absent', async () => {
      mountBrowser([
        {
          id: 'a',
          name: 'Created only',
          content: [createTitleBlock()],
          created_at: iso(30),
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
          updated_at: 'not-a-date',
        },
      ]);
      await nextTick();

      expect(qAll('[data-testid="saved-block-updated"]')).toHaveLength(0);
    });
  });

  it('defaults the insert position to after the selected canvas block', async () => {
    const canvasBlock = createTitleBlock();
    mountBrowser([savedA], [canvasBlock], canvasBlock.id);
    await nextTick();

    expect(get<HTMLSelectElement>('select').value).toBe(canvasBlock.id);
  });
});
