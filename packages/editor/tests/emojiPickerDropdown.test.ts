// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import EmojiPickerDropdown from '../src/components/blocks/EmojiPickerDropdown.vue';
import { mountEditor } from './helpers/mount';
import en from '../src/i18n/locales/en';
import de from '../src/i18n/locales/de';

function mountDropdown() {
  return mountEditor(EmojiPickerDropdown, {
    attachTo: document.body,
  });
}

describe('EmojiPickerDropdown', () => {
  it('starts closed (no picker panel in DOM)', () => {
    const wrapper = mountDropdown();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.find('button[aria-haspopup="dialog"]').attributes('aria-expanded')).toBe('false');
  });

  it('opens the picker on trigger click', async () => {
    const wrapper = mountDropdown();
    await wrapper.find('button[aria-haspopup="dialog"]').trigger('click');

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.find('button[aria-haspopup="dialog"]').attributes('aria-expanded')).toBe('true');
  });

  it('toggles closed on second click', async () => {
    const wrapper = mountDropdown();
    const trigger = wrapper.find('button[aria-haspopup="dialog"]');
    await trigger.trigger('click');
    await trigger.trigger('click');

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('closes on Escape keydown inside the picker', async () => {
    const wrapper = mountDropdown();
    await wrapper.find('button[aria-haspopup="dialog"]').trigger('click');
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('clicking an emoji emits insert and closes the picker', async () => {
    const wrapper = mountDropdown();
    await wrapper.find('button[aria-haspopup="dialog"]').trigger('click');

    // Emoji data loads lazily via dynamic import; poll until the grid populates.
    await vi.waitUntil(
      () => wrapper.findAll('[role="dialog"] button').length > 0,
      { timeout: 2000 },
    );

    const emojiButtons = wrapper.findAll('[role="dialog"] button');
    const first = emojiButtons[0];
    const emojiChar = first.text();
    await first.trigger('click');

    const emitted = wrapper.emitted('insert');
    expect(emitted).toHaveLength(1);
    expect(emitted![0]).toEqual([emojiChar]);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });
});

describe('emoji picker i18n', () => {
  it('en and de expose emojiItemLabel with {emoji} placeholder', () => {
    expect(en.paragraphEditor.emojiItemLabel).toContain('{emoji}');
    expect(de.paragraphEditor.emojiItemLabel).toContain('{emoji}');
  });

  it('en and de expose non-empty insertEmoji label', () => {
    expect(en.paragraphEditor.insertEmoji.length).toBeGreaterThan(0);
    expect(de.paragraphEditor.insertEmoji.length).toBeGreaterThan(0);
  });
});
