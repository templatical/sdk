// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { nextTick, h } from 'vue';
import TplModal from '../src/cloud/components/TplModal.vue';
import { mountEditor } from './helpers/mount';

function mountModal(visible: boolean) {
  return mountEditor(TplModal, {
    props: { visible },
    slots: { default: () => h('p', { 'data-testid': 'content' }, 'Modal body') },
    attachTo: document.body,
    global: {
      stubs: {
        Teleport: true,
      },
    },
  });
}

describe('TplModal', () => {
  it('renders nothing when visible=false', () => {
    const wrapper = mountModal(false);
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(false);
  });

  it('renders the slotted content when visible=true', () => {
    const wrapper = mountModal(true);
    const content = wrapper.find('[data-testid="content"]');
    expect(content.exists()).toBe(true);
    expect(content.text()).toBe('Modal body');
  });

  it('wraps content in a backdrop div with overlay styles', () => {
    const wrapper = mountModal(true);
    const backdrop = wrapper.find('.tpl\\:fixed.tpl\\:inset-0');
    expect(backdrop.exists()).toBe(true);
    expect(backdrop.attributes('style')).toContain('var(--tpl-overlay)');
  });

  it('emits close on backdrop (self) click', async () => {
    const wrapper = mountModal(true);
    await wrapper.find('.tpl\\:fixed.tpl\\:inset-0').trigger('click');

    expect(wrapper.emitted('close')).toBeTruthy();
    expect(wrapper.emitted('close')!.length).toBe(1);
  });

  it('does NOT emit close when click originates inside the dialog (not self)', async () => {
    const wrapper = mountModal(true);
    await wrapper.find('[data-testid="content"]').trigger('click');

    expect(wrapper.emitted('close')).toBeFalsy();
  });

  it('emits close when Escape is pressed', async () => {
    const wrapper = mountModal(true);
    await wrapper
      .find('.tpl\\:fixed.tpl\\:inset-0')
      .trigger('keydown', { key: 'Escape' });

    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('forwards non-Escape keydowns via the keydown event', async () => {
    const wrapper = mountModal(true);
    await wrapper
      .find('.tpl\\:fixed.tpl\\:inset-0')
      .trigger('keydown', { key: 'a' });

    expect(wrapper.emitted('keydown')).toBeTruthy();
    const [event] = wrapper.emitted('keydown')![0] as [KeyboardEvent];
    expect(event.key).toBe('a');
    expect(wrapper.emitted('close')).toBeFalsy();
  });
});
