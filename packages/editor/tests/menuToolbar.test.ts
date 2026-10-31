// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createMenuBlock } from '@templatical/types';
import type { MenuBlock } from '@templatical/types';
import MenuToolbar from '../src/components/toolbar/MenuToolbar.vue';
import MergeTagInput from '../src/components/MergeTagInput.vue';
import ToggleSwitch from '../src/components/ToggleSwitch.vue';
import ColorPicker from '../src/components/ColorPicker.vue';
import { mountEditor } from './helpers/mount';

function mountIt(block: MenuBlock) {
  return mountEditor(MenuToolbar, {
    props: {
      block,
      fontFamilies: [{ value: '', label: 'Default' }],
    },
  });
}

function blockWithItems(items: any[]): MenuBlock {
  return { ...createMenuBlock(), items } as MenuBlock;
}

describe('MenuToolbar CRUD', () => {
  it('edits an item URL, flags and colour without changing its sibling or source', async () => {
    const block = blockWithItems([
      { id: 'a', text: 'Home', url: '/', bold: false, underline: false, openInNewTab: false },
      { id: 'b', text: 'About', url: '/about', bold: false, underline: false, openInNewTab: false },
    ]);
    const wrapper = mountIt(block);
    wrapper.findAllComponents(MergeTagInput)[0].vm.$emit('update:modelValue', '/de');
    wrapper.findAllComponents(ToggleSwitch)[0].vm.$emit('update:modelValue', true);
    wrapper.findAllComponents(ColorPicker)[0].vm.$emit('update:modelValue', '#123456');
    const updates = wrapper.emitted('update')!.map(([update]) => update as Partial<MenuBlock>);
    expect(updates.map((update) => update.items![0])).toEqual([
      { ...block.items[0], url: '/de' },
      { ...block.items[0], openInNewTab: true },
      { ...block.items[0], color: '#123456' },
    ]);
    for (const update of updates) expect(update.items![1]).toEqual(block.items[1]);
    expect(block.items[0]).toEqual({ id: 'a', text: 'Home', url: '/', bold: false, underline: false, openInNewTab: false });
    wrapper.unmount();
  });

  it('renders a text input for every existing menu item', () => {
    const block = blockWithItems([
      { id: 'a', text: 'Home', url: '/', openInNewTab: false, bold: false, underline: false },
      { id: 'b', text: 'About', url: '/about', openInNewTab: true, bold: true, underline: false },
    ]);
    const wrapper = mountIt(block);

    // Menu item text inputs use placeholder=t.menu.text (stub resolves to "menu.text")
    const itemTextInputs = wrapper
      .findAll('input[type="text"]')
      .filter((i) => i.attributes('placeholder') === 'menu.text');
    expect(itemTextInputs).toHaveLength(2);
    expect((itemTextInputs[0].element as HTMLInputElement).value).toBe('Home');
    expect((itemTextInputs[1].element as HTMLInputElement).value).toBe('About');
  });

  it('adding an item emits update with appended item (blank text/url, default flags)', async () => {
    const block = blockWithItems([]);
    const wrapper = mountIt(block);
    const addButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('menu.addItem'))!;
    expect(addButton).toBeTruthy();

    await addButton.trigger('click');

    const emitted = wrapper.emitted('update');
    expect(emitted).toHaveLength(1);
    const [update] = emitted![0] as [Partial<MenuBlock>];
    expect(update.items).toHaveLength(1);
    const item = update.items![0];
    expect(item.text).toBe('');
    expect(item.url).toBe('');
    expect(item.openInNewTab).toBe(false);
    expect(item.bold).toBe(false);
    expect(item.underline).toBe(false);
    expect(item.id).toBeTruthy();
  });

  it('editing an item text emits update with only that item mutated (others untouched)', async () => {
    const block = blockWithItems([
      { id: 'a', text: 'Home', url: '/', openInNewTab: false, bold: false, underline: false },
      { id: 'b', text: 'About', url: '/about', openInNewTab: false, bold: false, underline: false },
    ]);
    const wrapper = mountIt(block);

    const inputs = wrapper
      .findAll('input[type="text"]')
      .filter((i) => i.attributes('placeholder') === 'menu.text');
    (inputs[1].element as HTMLInputElement).value = 'About Us';
    await inputs[1].trigger('input');

    const [update] = wrapper.emitted('update')![0] as [Partial<MenuBlock>];
    expect(update.items![0]).toEqual(block.items[0]);
    expect(update.items![1].text).toBe('About Us');
    expect(update.items![1].url).toBe('/about');
  });

  it('removing an item emits update without that item', async () => {
    const block = blockWithItems([
      { id: 'a', text: 'Home', url: '/', openInNewTab: false, bold: false, underline: false },
      { id: 'b', text: 'About', url: '/about', openInNewTab: false, bold: false, underline: false },
    ]);
    const wrapper = mountIt(block);

    const removeButtons = wrapper.findAll('button[title="menu.removeItem"]');
    expect(removeButtons).toHaveLength(2);

    await removeButtons[0].trigger('click');

    const [update] = wrapper.emitted('update')![0] as [Partial<MenuBlock>];
    expect(update.items).toHaveLength(1);
    expect(update.items![0].id).toBe('b');
  });
});
