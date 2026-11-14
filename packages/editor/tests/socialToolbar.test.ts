// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createSocialIconsBlock } from '@templatical/types';
import type { SocialIconsBlock } from '@templatical/types';
import SocialToolbar from '../src/components/toolbar/SocialToolbar.vue';
import MergeTagInput from '../src/components/MergeTagInput.vue';
import { socialPlatformOptions } from '../src/constants/socialIcons';
import { ON_REQUEST_MEDIA_KEY } from '../src/keys';
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

    const selects = wrapper.findAll('[data-testid="social-platform-select"]');
    expect(selects).toHaveLength(2);
    expect((selects[0].element as HTMLSelectElement).value).toBe('facebook');
    expect((selects[1].element as HTMLSelectElement).value).toBe('twitter');
  });

  it('labels platform options via i18n (t.social.platforms), not a hardcoded glyph name', () => {
    const block = withIcons([{ id: 'a', platform: 'website', url: '' }]);
    const wrapper = mountIt(block);

    // Stub i18n echoes the dot-path, so the label resolving through
    // t.social.platforms[platform] renders as "social.platforms.website".
    // A regression to socialIcons[platform].name would render "Website".
    const websiteOption = wrapper
      .findAll('[data-testid="social-platform-select"] option')
      .find((o) => (o.element as HTMLOptionElement).value === 'website');
    expect(websiteOption).toBeTruthy();
    expect(websiteOption!.text()).toBe('social.platforms.website');
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

    const select = wrapper.findAll('[data-testid="social-platform-select"]')[1];
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

describe('SocialToolbar style and color', () => {
  it('offers the plain style', () => {
    const wrapper = mountIt(withIcons([]));
    const values = wrapper
      .findAll('option')
      .map((o) => (o.element as HTMLOptionElement).value);
    expect(values).toContain('plain');
  });

  it('shows brand for a block with no color and emits the chosen tone', async () => {
    // Content saved before iconTone existed has no such field.
    const { iconTone: _absent, ...legacy } = withIcons([]);
    const wrapper = mountIt(legacy as SocialIconsBlock);
    const select = wrapper.find('[data-testid="social-tone-select"]');
    expect((select.element as HTMLSelectElement).value).toBe('brand');
    expect(
      select.findAll('option').map((o) => (o.element as HTMLOptionElement).value),
    ).toEqual(['brand', 'dark', 'light']);

    await select.setValue('light');
    const [update] = wrapper.emitted('update')!.at(-1) as [
      Partial<SocialIconsBlock>,
    ];
    expect(update).toEqual({ iconTone: 'light' });
  });
});

describe('SocialToolbar custom icons', () => {
  it('lists the built-in platforms, then a custom option', () => {
    const wrapper = mountIt(
      withIcons([{ id: 'a', platform: 'facebook', url: '' }]),
    );
    const options = wrapper.findAll(
      '[data-testid="social-platform-select"] option',
    );

    expect(
      options.map((option) => (option.element as HTMLOptionElement).value),
    ).toEqual([...socialPlatformOptions, 'custom']);
    expect(options.at(-1)!.text()).toBe('social.platforms.custom');
  });

  it('selecting custom emits a custom icon that keeps id and url', async () => {
    const block = withIcons([
      { id: 'a', platform: 'facebook', url: 'https://fb.example' },
      { id: 'b', platform: 'twitter', url: 'https://x.example' },
    ]);
    const wrapper = mountIt(block);
    const select = wrapper.findAll('[data-testid="social-platform-select"]')[0];

    (select.element as HTMLSelectElement).value = 'custom';
    await select.trigger('change');

    const [update] = wrapper.emitted('update')![0] as [
      Partial<SocialIconsBlock>,
    ];
    expect(update.icons).toEqual([
      {
        id: 'a',
        platform: 'custom',
        url: 'https://fb.example',
        imageUrl: '',
      },
      block.icons[1],
    ]);
  });

  it('selecting a built-in platform on a custom icon drops imageUrl and alt', async () => {
    const block = withIcons([
      {
        id: 'a',
        platform: 'custom',
        url: 'https://shop.example',
        imageUrl: 'https://cdn.example/icon.png',
        alt: 'Shop',
      },
      { id: 'b', platform: 'twitter', url: 'https://x.example' },
    ]);
    const wrapper = mountIt(block);
    const select = wrapper.findAll('[data-testid="social-platform-select"]')[0];

    (select.element as HTMLSelectElement).value = 'github';
    await select.trigger('change');

    const [update] = wrapper.emitted('update')![0] as [
      Partial<SocialIconsBlock>,
    ];
    expect(update.icons![0]).toEqual({
      id: 'a',
      platform: 'github',
      url: 'https://shop.example',
    });
    expect(Object.keys(update.icons![0])).toEqual(['id', 'platform', 'url']);
    expect(update.icons![1]).toEqual(block.icons[1]);
  });

  it('switching between built-in platforms keeps id and url only', async () => {
    const block = withIcons([
      { id: 'a', platform: 'facebook', url: 'https://fb.example' },
    ]);
    const wrapper = mountIt(block);
    const select = wrapper.get('[data-testid="social-platform-select"]');

    (select.element as HTMLSelectElement).value = 'instagram';
    await select.trigger('change');

    const [update] = wrapper.emitted('update')![0] as [
      Partial<SocialIconsBlock>,
    ];
    expect(update.icons).toEqual([
      { id: 'a', platform: 'instagram', url: 'https://fb.example' },
    ]);
  });

  it('renders image, alt, then the link on a custom row, and neither image nor alt on a built-in row', () => {
    const wrapper = mountIt(
      withIcons([
        { id: 'built', platform: 'facebook', url: 'https://fb.example' },
        {
          id: 'own',
          platform: 'custom',
          url: 'https://shop.example',
          imageUrl: 'https://cdn.example/icon.png',
          alt: 'Shop',
        },
      ]),
    );

    expect(
      wrapper.find('[data-locale-path="icons.built.imageUrl"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-locale-path="icons.built.alt"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-locale-path="icons.built.url"]').exists()).toBe(
      true,
    );

    const paths = wrapper
      .findAll('[data-locale-path]')
      .map((row) => row.attributes('data-locale-path'));
    expect(paths.filter((path) => path.startsWith('icons.built.'))).toEqual([
      'icons.built.platform',
      'icons.built.url',
    ]);
    expect(paths.filter((path) => path.startsWith('icons.own.'))).toEqual([
      'icons.own.platform',
      'icons.own.imageUrl',
      'icons.own.alt',
      'icons.own.url',
    ]);

    const imageField = wrapper.get('[data-locale-path="icons.own.imageUrl"]');
    expect(imageField.text()).toContain('image.imageUrl');
    expect(imageField.get('input').attributes('placeholder')).toBe(
      'image.imageUrlPlaceholder',
    );
    expect(imageField.get('input').attributes('type')).toBe('url');

    const altField = wrapper.get('[data-locale-path="icons.own.alt"]');
    expect(altField.text()).toContain('image.altText');
    expect(altField.get('input').attributes('placeholder')).toBe(
      'image.altTextPlaceholder',
    );
    expect(altField.get('input').attributes('type')).toBe('text');

    const hint = wrapper
      .findAll('p')
      .find((node) => node.text() === 'social.customIconHint');
    expect(hint).toBeTruthy();
    expect(hint!.classes()).toContain('tpl:text-xs');
    expect(hint!.classes()).toContain('tpl:text-[var(--tpl-text-dim)]');
    const urlField = wrapper.get('[data-locale-path="icons.own.url"]').element;
    expect(
      urlField.compareDocumentPosition(hint!.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const builtIn = mountIt(
      withIcons([{ id: 'built', platform: 'facebook', url: 'https://fb.example' }]),
    );
    expect(builtIn.text()).not.toContain('image.imageUrl');
    expect(builtIn.text()).not.toContain('image.altText');
    expect(builtIn.text()).not.toContain('social.customIconHint');
    expect(builtIn.findAll('input[type="text"]')).toHaveLength(0);
  });

  it('omits locale paths when the icon id contains a dot', () => {
    const wrapper = mountIt(
      withIcons([
        {
          id: 'a.b',
          platform: 'custom',
          url: 'https://shop.example',
          imageUrl: '',
        },
      ]),
    );

    expect(wrapper.find('[data-locale-path="icons.a.b.imageUrl"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-locale-path="icons.a.b.alt"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-locale-path="icons.a.b.url"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain('image.imageUrl');
    expect(wrapper.text()).toContain('image.altText');
  });

  it('browse asks the host for an image and stores its url and alt', async () => {
    const onRequestMedia = vi.fn(async () => ({
      url: 'https://cdn.example/icon.png',
      alt: 'Shop mark',
    }));
    const wrapper = mountEditor(SocialToolbar, {
      props: {
        block: withIcons([
          {
            id: 'a',
            platform: 'custom',
            url: 'https://shop.example',
            imageUrl: '',
          },
        ]),
      },
      provides: { [ON_REQUEST_MEDIA_KEY]: onRequestMedia },
    });

    const browse = wrapper
      .findAll('button')
      .find((button) => button.text().includes('image.browseMedia'));
    expect(browse).toBeTruthy();
    await browse!.trigger('click');
    await flushPromises();

    expect(onRequestMedia).toHaveBeenCalledWith({ accept: ['images'] });
    const [update] = wrapper.emitted('update')!.at(-1) as [
      Partial<SocialIconsBlock>,
    ];
    expect(update.icons).toEqual([
      {
        id: 'a',
        platform: 'custom',
        url: 'https://shop.example',
        imageUrl: 'https://cdn.example/icon.png',
        alt: 'Shop mark',
      },
    ]);
  });

  it('keeps the current alt when the picked image has none', async () => {
    const onRequestMedia = vi.fn(async () => ({
      url: 'https://cdn.example/icon.png',
    }));
    const wrapper = mountEditor(SocialToolbar, {
      props: {
        block: withIcons([
          {
            id: 'a',
            platform: 'custom',
            url: 'https://shop.example',
            imageUrl: 'https://cdn.example/old.png',
            alt: 'Old mark',
          },
        ]),
      },
      provides: { [ON_REQUEST_MEDIA_KEY]: onRequestMedia },
    });

    const browse = wrapper
      .findAll('button')
      .find((button) => button.text().includes('image.browseMedia'))!;
    await browse.trigger('click');
    await flushPromises();

    const [update] = wrapper.emitted('update')!.at(-1) as [
      Partial<SocialIconsBlock>,
    ];
    expect(update.icons).toEqual([
      {
        id: 'a',
        platform: 'custom',
        url: 'https://shop.example',
        imageUrl: 'https://cdn.example/icon.png',
        alt: 'Old mark',
      },
    ]);
  });

  it('uploads a drop onto the first custom icon only', async () => {
    const file = new File(['data'], 'mark.png', { type: 'image/png' });
    const onRequestMedia = vi.fn(async () => ({
      url: 'https://cdn.example/dropped.png',
    }));
    const wrapper = mountEditor(SocialToolbar, {
      props: {
        block: withIcons([
          {
            id: 'first',
            platform: 'custom',
            url: 'https://one.example',
            imageUrl: 'https://cdn.example/old-1.png',
            alt: 'One',
          },
          {
            id: 'second',
            platform: 'custom',
            url: 'https://two.example',
            imageUrl: 'https://cdn.example/old-2.png',
            alt: 'Two',
          },
        ]),
      },
      provides: { [ON_REQUEST_MEDIA_KEY]: onRequestMedia },
    });
    await flushPromises();

    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: [file], items: [{ type: file.type }] },
    });
    wrapper
      .get('[data-locale-path="icons.first.imageUrl"] input')
      .element.dispatchEvent(event);
    await flushPromises();

    expect(onRequestMedia).toHaveBeenCalledTimes(1);
    expect(onRequestMedia).toHaveBeenCalledWith({
      accept: ['images'],
      files: [file],
    });
    const [update] = wrapper.emitted('update')!.at(-1) as [
      Partial<SocialIconsBlock>,
    ];
    expect(update.icons).toEqual([
      {
        id: 'first',
        platform: 'custom',
        url: 'https://one.example',
        imageUrl: 'https://cdn.example/dropped.png',
        alt: 'One',
      },
      {
        id: 'second',
        platform: 'custom',
        url: 'https://two.example',
        imageUrl: 'https://cdn.example/old-2.png',
        alt: 'Two',
      },
    ]);
  });

  it('does not upload a drop onto a merge-tag image', async () => {
    const file = new File(['data'], 'mark.png', { type: 'image/png' });
    const onRequestMedia = vi.fn(async () => ({
      url: 'https://cdn.example/dropped.png',
    }));
    const wrapper = mountEditor(SocialToolbar, {
      props: {
        block: withIcons([
          {
            id: 'first',
            platform: 'custom',
            url: 'https://one.example',
            imageUrl: '{{ icon }}',
          },
        ]),
      },
      provides: { [ON_REQUEST_MEDIA_KEY]: onRequestMedia },
    });
    await flushPromises();

    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: [file], items: [{ type: file.type }] },
    });
    wrapper
      .get('[data-locale-path="icons.first.imageUrl"]')
      .element.dispatchEvent(event);
    await flushPromises();

    expect(onRequestMedia).not.toHaveBeenCalled();
    expect(wrapper.emitted('update')).toBeUndefined();
  });

  it('typing into the image, alt and link fields emits only that icon, as a whole custom icon', async () => {
    const builtIn = { id: 'built', platform: 'facebook', url: 'fb' };
    const own = {
      id: 'own',
      platform: 'custom',
      url: 'https://shop.example',
      imageUrl: 'https://cdn.example/icon.png',
      alt: 'Shop',
    };
    const wrapper = mountIt(withIcons([builtIn, own]));
    // Field order on the custom row: image, alt, then the link. The built-in
    // row's link comes first.
    const inputs = wrapper.findAllComponents(MergeTagInput);
    expect(inputs).toHaveLength(4);

    inputs[1].vm.$emit('update:modelValue', 'https://cdn.example/new.png');
    inputs[2].vm.$emit('update:modelValue', 'Shop logo');
    inputs[3].vm.$emit('update:modelValue', 'https://shop.example/de');
    await flushPromises();

    const updates = wrapper.emitted('update')!.map(
      ([u]) => (u as Partial<SocialIconsBlock>).icons!,
    );
    expect(updates).toEqual([
      [builtIn, { ...own, imageUrl: 'https://cdn.example/new.png' }],
      [builtIn, { ...own, alt: 'Shop logo' }],
      [builtIn, { ...own, url: 'https://shop.example/de' }],
    ]);
  });

  it('emits nothing when the image URL is set to its current value', async () => {
    const wrapper = mountIt(
      withIcons([
        {
          id: 'own',
          platform: 'custom',
          url: '',
          imageUrl: 'https://cdn.example/icon.png',
        },
      ]),
    );

    wrapper
      .findAllComponents(MergeTagInput)[0]
      .vm.$emit('update:modelValue', 'https://cdn.example/icon.png');
    await flushPromises();

    expect(wrapper.emitted('update')).toBeUndefined();
  });

  it('emits nothing when the select reports the platform the icon already has', async () => {
    const wrapper = mountIt(
      withIcons([{ id: 'a', platform: 'facebook', url: 'fb' }]),
    );

    const select = wrapper.find('[data-testid="social-platform-select"]');
    (select.element as HTMLSelectElement).value = 'facebook';
    await select.trigger('change');

    expect(wrapper.emitted('update')).toBeUndefined();
  });

  it('hides browse when the host handles no media requests', () => {
    const wrapper = mountIt(
      withIcons([
        {
          id: 'a',
          platform: 'custom',
          url: 'https://shop.example',
          imageUrl: '',
        },
      ]),
    );

    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text().includes('image.browseMedia')),
    ).toBeUndefined();
  });
});
