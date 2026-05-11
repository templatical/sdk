// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick, h, ref } from 'vue';
import TplModal from '../src/cloud/components/TplModal.vue';
import { POPOVER_ROOT_KEY } from '../src/keys';
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

function mountModal(visible: boolean) {
  return mountEditor(TplModal, {
    props: { visible },
    slots: { default: () => h('p', { 'data-testid': 'content' }, 'Modal body') },
    attachTo: document.body,
    provides: {
      [POPOVER_ROOT_KEY]: ref<HTMLElement | null>(popoverRootEl),
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
