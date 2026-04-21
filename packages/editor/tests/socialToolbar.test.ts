// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createSocialIconsBlock } from '@templatical/types';
import type { SocialIconsBlock } from '@templatical/types';
import SocialToolbar from '../src/components/toolbar/SocialToolbar.vue';
import { mountEditor } from './helpers/mount';

function mountIt(block: SocialIconsBlock) {
  return mountEditor(SocialToolbar, { props: { block } });
}

function withIcons(icons: any[]): SocialIconsBlock {
  return { ...createSocialIconsBlock(), icons } as SocialIconsBlock;
}

describe('SocialToolbar CRUD', () => {
  it('renders one row (select + url input) per icon', () => {
    const block = withIcons([
      { id: 'a', platform: 'facebook', url: 'https://fb.com' },
      { id: 'b', platform: 'twitter', url: 'https://x.com' },
    ]);
    const wrapper = mountIt(block);

    const selects = wrapper.findAll('select');
    expect(selects).toHaveLength(2);
    expect((selects[0].element as HTMLSelectElement).value).toBe('facebook');
    expect((selects[1].element as HTMLSelectElement).value).toBe('twitter');
  });

  it('adding an icon emits update with appended facebook entry', async () => {
    const block = withIcons([]);
    const wrapper = mountIt(block);

    const addButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('social.addIcon'))!;
    expect(addButton).toBeTruthy();

    await addButton.trigger('click');

    const [update] = wrapper.emitted('update')![0] as [Partial<SocialIconsBlock>];
    expect(update.icons).toHaveLength(1);
    expect(update.icons![0].platform).toBe('facebook');
    expect(update.icons![0].url).toBe('');
    expect(update.icons![0].id).toBeTruthy();
  });

  it('changing the platform select emits update with only that icon mutated', async () => {
    const block = withIcons([
      { id: 'a', platform: 'facebook', url: 'fb' },
      { id: 'b', platform: 'twitter', url: 'x' },
    ]);
    const wrapper = mountIt(block);

    const select = wrapper.findAll('select')[1];
    (select.element as HTMLSelectElement).value = 'instagram';
    await select.trigger('change');

    const [update] = wrapper.emitted('update')![0] as [Partial<SocialIconsBlock>];
    expect(update.icons![0]).toEqual(block.icons[0]);
    expect(update.icons![1].platform).toBe('instagram');
    expect(update.icons![1].url).toBe('x');
  });

  it('removing an icon emits update without that icon', async () => {
    const block = withIcons([
      { id: 'a', platform: 'facebook', url: 'fb' },
      { id: 'b', platform: 'twitter', url: 'x' },
    ]);
    const wrapper = mountIt(block);

    // Remove buttons use title=t.social.removeIcon
    const removeButtons = wrapper
      .findAll('button[title="social.removeIcon"]');
    expect(removeButtons).toHaveLength(2);

    await removeButtons[0].trigger('click');

    const [update] = wrapper.emitted('update')![0] as [Partial<SocialIconsBlock>];
    expect(update.icons).toHaveLength(1);
    expect(update.icons![0].id).toBe('b');
  });
});
