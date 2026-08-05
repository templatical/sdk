// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computed, nextTick, h, ref } from 'vue';
import TplModal from '../src/components/TplModal.vue';
import { POPOVER_ROOT_KEY, THEME_STYLES_KEY } from '../src/keys';
import { mountEditor } from './helpers/mount';

let popoverRootEl: HTMLElement;

beforeEach(() => {
  popoverRootEl = document.createElement('div');
  popoverRootEl.className = 'tpl-popover-root';
  document.body.appendChild(popoverRootEl);
});

afterEach(() => {
  popoverRootEl.remove();
});

function mountModal(
  visible: boolean,
  themeStyles?: Record<string, string>,
) {
  return mountEditor(TplModal, {
    props: { visible },
    slots: { default: () => h('p', { 'data-testid': 'content' }, 'Modal body') },
    attachTo: document.body,
    provides: {
      [POPOVER_ROOT_KEY]: ref<HTMLElement | null>(popoverRootEl),
      ...(themeStyles
        ? { [THEME_STYLES_KEY]: computed(() => themeStyles) }
        : {}),
    },
  });
}

/**
 * Helpers — TplModal now teleports its content into the injected popover
 * root rather than `document.body`, so assertions query the popover root
 * directly (the teleported subtree lives outside `wrapper.element`).
 */
function findContent(): HTMLElement | null {
  return popoverRootEl.querySelector<HTMLElement>('[data-testid="content"]');
}

function findBackdrop(): HTMLElement {
  const el = popoverRootEl.querySelector<HTMLElement>(
    '.tpl\\:fixed.tpl\\:inset-0',
  );
  if (!el) throw new Error('Backdrop not found in popover root');
  return el;
}

describe('TplModal', () => {
  it('renders nothing when visible=false', () => {
    mountModal(false);
    expect(findContent()).toBe(null);
  });

  it('renders the slotted content when visible=true', async () => {
    mountModal(true);
    await nextTick();
    const content = findContent();
    expect(content).not.toBe(null);
    expect(content!.textContent).toBe('Modal body');
  });

  it('wraps content in a backdrop div with overlay styles', async () => {
    mountModal(true);
    await nextTick();
    const backdrop = findBackdrop();
    expect(backdrop.getAttribute('style')).toContain('var(--tpl-overlay)');
  });

  it('emits close on backdrop (self) click', async () => {
    const wrapper = mountModal(true);
    await nextTick();
    const backdrop = findBackdrop();
    backdrop.dispatchEvent(new Event('click', { bubbles: true }));
    expect(wrapper.emitted('close')).toBeTruthy();
    expect(wrapper.emitted('close')!.length).toBe(1);
  });

  it('does NOT emit close when click originates inside the dialog (not self)', async () => {
    const wrapper = mountModal(true);
    await nextTick();
    const content = findContent();
    expect(content).not.toBe(null);
    content!.dispatchEvent(new Event('click', { bubbles: true }));
    expect(wrapper.emitted('close')).toBeFalsy();
  });

  it('emits close when Escape is pressed', async () => {
    const wrapper = mountModal(true);
    await nextTick();
    const backdrop = findBackdrop();
    backdrop.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  /**
   * Issue #487. The backdrop carries the bare `tpl` class, which re-declares
   * the whole `--tpl-*` token set and therefore shadows the consumer's `theme`
   * (inline styles on the editor root) for everything teleported inside it.
   * Re-applying `themeStyles` here is what every dialog rendered through this
   * wrapper depends on; the structural rule is in `theme-token-scope.test.ts`.
   */
  describe('consumer theme overrides', () => {
    it('applies the injected themeStyles to the backdrop', async () => {
      mountModal(true, {
        '--tpl-bg-elevated': 'rgb(1, 2, 3)',
        '--tpl-primary': 'rgb(4, 5, 6)',
      });
      await nextTick();
      const backdrop = findBackdrop();
      expect(backdrop.style.getPropertyValue('--tpl-bg-elevated')).toBe(
        'rgb(1, 2, 3)',
      );
      expect(backdrop.style.getPropertyValue('--tpl-primary')).toBe(
        'rgb(4, 5, 6)',
      );
    });

    it('keeps its own overlay styles alongside the theme binding', async () => {
      // The overlay's background/blur are a static `style` attribute and the
      // theme arrives via `:style`. Vue merges the two — if it ever stopped,
      // the modal would lose its scrim rather than its theme, so both halves
      // are asserted together.
      mountModal(true, { '--tpl-bg-elevated': 'rgb(1, 2, 3)' });
      await nextTick();
      const backdrop = findBackdrop();
      expect(backdrop.style.backgroundColor).toBe('var(--tpl-overlay)');
      expect(backdrop.style.getPropertyValue('--tpl-bg-elevated')).toBe(
        'rgb(1, 2, 3)',
      );
    });

    it('sets no token overrides when the consumer configured no theme', async () => {
      // Positive control for the two above: an empty override map must leave
      // the tokens to the stylesheet rather than pinning them to anything.
      mountModal(true, {});
      await nextTick();
      const backdrop = findBackdrop();
      expect(backdrop.style.getPropertyValue('--tpl-bg-elevated')).toBe('');
      expect(backdrop.style.backgroundColor).toBe('var(--tpl-overlay)');
    });
  });

  it('forwards non-Escape keydowns via the keydown event', async () => {
    const wrapper = mountModal(true);
    await nextTick();
    const backdrop = findBackdrop();
    backdrop.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
    );
    expect(wrapper.emitted('keydown')).toBeTruthy();
    const [event] = wrapper.emitted('keydown')![0] as [KeyboardEvent];
    expect(event.key).toBe('a');
    expect(wrapper.emitted('close')).toBeFalsy();
  });
});
