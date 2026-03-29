import { describe, expect, it } from 'vitest';
import { useEmoji } from '../src/composables/useEmoji';

describe('useEmoji', () => {
  it('starts closed', () => {
    const { isOpen } = useEmoji();
    expect(isOpen.value).toBe(false);
  });

  it('toggles open', () => {
    const { isOpen, toggle } = useEmoji();

    toggle();
    expect(isOpen.value).toBe(true);

    toggle();
    expect(isOpen.value).toBe(false);
  });

  it('close sets to false', () => {
    const { isOpen, toggle, close } = useEmoji();

    toggle(); // open
    close();
    expect(isOpen.value).toBe(false);
  });

  it('close is idempotent', () => {
    const { isOpen, close } = useEmoji();

    close();
    expect(isOpen.value).toBe(false);
  });

  it('has three emoji categories', () => {
    const { categories } = useEmoji();
    expect(categories).toHaveLength(3);
    expect(categories.map((c) => c.key)).toEqual(['smileys', 'gestures', 'objects']);
  });

  it('each category has emojis', () => {
    const { categories } = useEmoji();
    for (const category of categories) {
      expect(category.emojis.length).toBeGreaterThan(0);
    }
  });

  it('all emojis are strings', () => {
    const { categories } = useEmoji();
    for (const category of categories) {
      for (const emoji of category.emojis) {
        expect(typeof emoji).toBe('string');
        expect(emoji.length).toBeGreaterThan(0);
      }
    }
  });
});
