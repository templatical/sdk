// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import Sidebar from '../src/components/Sidebar.vue';
import { mountEditor } from './helpers/mount';
import {
  EDITOR_KEY,
  CUSTOM_BLOCK_DEFINITIONS_KEY,
  PALETTE_BLOCKS_KEY,
  CAPABILITIES_KEY,
  CLOUD_TRANSLATIONS_KEY,
} from '../src/keys';
import cloudEn from '../src/i18n/locales/cloud/en';

function makeEditor() {
  const addBlock = vi.fn();
  const selectBlock = vi.fn();
  return {
    editor: {
      addBlock,
      selectBlock,
      state: {},
    } as any,
    addBlock,
    selectBlock,
  };
}

function mountSidebar(overrides: Record<symbol, unknown> = {}) {
  return mountEditor(Sidebar, {
    provides: overrides,
  });
}

describe('Sidebar', () => {
  it('renders a button for every built-in block type in expected order', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({ [EDITOR_KEY]: editor });
    const buttons = wrapper.findAll('button[data-palette-type]');
    const types = buttons.map((b) => b.attributes('data-palette-type'));

    // Countdown is only present when `caps.plan` is configured (cloud mode).
    expect(types).toEqual([
      'section',
      'image',
      'title',
      'paragraph',
      'button',
      'divider',
      'video',
      'social',
      'menu',
      'table',
      'spacer',
      'html',
    ]);
  });

  it('palette list is a scroll region so tall block lists stay reachable on short viewports (#231)', () => {
    // The rail is `overflow-hidden` and anchored top-14..bottom-0, so it has
    // a bounded height. Without an inner scroll region the block-type list is
    // clipped on short viewports and the bottom items become unreachable
    // (issue #231). The palette must therefore scroll vertically while the
    // rail stays a flex column (so the list fills the space the modules
    // trigger leaves and the trigger stays pinned).
    const { editor } = makeEditor();
    const wrapper = mountSidebar({ [EDITOR_KEY]: editor });

    const rail = wrapper.get('aside.tpl-sidebar-rail');
    expect(rail.classes()).toContain('tpl:flex');
    expect(rail.classes()).toContain('tpl:flex-col');

    // The VueDraggable root wraps the palette buttons (v-for in its slot),
    // so a button's parent is the list container that must scroll.
    const list = wrapper.get('button[data-palette-type]').element
      .parentElement as HTMLElement;
    expect(list.className).toContain('tpl:overflow-y-auto');
    expect(list.className).toContain('tpl:flex-1');
    expect(list.className).toContain('tpl:min-h-0');

    // Each palette button must keep its fixed height: in the flex column a
    // shrinkable button would be compressed to fit the bounded list instead
    // of overflowing it, so `overflow-y-auto` would never engage.
    expect(wrapper.get('button[data-palette-type]').classes()).toContain(
      'tpl:shrink-0',
    );
  });

  it('includes countdown when plan capability is provided (cloud mode)', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CAPABILITIES_KEY]: { plan: { hasFeature: () => true } } as any,
    });
    const types = wrapper
      .findAll('button[data-palette-type]')
      .map((b) => b.attributes('data-palette-type'));
    expect(types).toContain('countdown');
  });

  it('clicking a palette item creates+inserts a block and selects it', async () => {
    const { editor, addBlock, selectBlock } = makeEditor();
    const wrapper = mountSidebar({ [EDITOR_KEY]: editor });
    const titleButton = wrapper.find('button[data-palette-type="title"]');

    await titleButton.trigger('click');

    expect(addBlock).toHaveBeenCalledOnce();
    const inserted = addBlock.mock.calls[0][0];
    expect(inserted.type).toBe('title');
    expect(inserted.id).toBeTruthy();
    expect(selectBlock).toHaveBeenCalledWith(inserted.id);
  });

  it('Enter key on a palette item inserts the block (keyboard accessibility)', async () => {
    const { editor, addBlock } = makeEditor();
    const wrapper = mountSidebar({ [EDITOR_KEY]: editor });
    const imageButton = wrapper.find('button[data-palette-type="image"]');

    await imageButton.trigger('keydown', { key: 'Enter' });

    expect(addBlock).toHaveBeenCalledOnce();
    expect(addBlock.mock.calls[0][0].type).toBe('image');
  });

  it('Space key on a palette item inserts the block', async () => {
    const { editor, addBlock } = makeEditor();
    const wrapper = mountSidebar({ [EDITOR_KEY]: editor });
    const paragraphButton = wrapper.find('button[data-palette-type="paragraph"]');

    await paragraphButton.trigger('keydown', { key: ' ' });

    expect(addBlock).toHaveBeenCalledOnce();
    expect(addBlock.mock.calls[0][0].type).toBe('paragraph');
  });

  it('non-activation keys do not insert blocks', async () => {
    const { editor, addBlock } = makeEditor();
    const wrapper = mountSidebar({ [EDITOR_KEY]: editor });
    const button = wrapper.find('button[data-palette-type="title"]');

    await button.trigger('keydown', { key: 'Tab' });
    await button.trigger('keydown', { key: 'a' });

    expect(addBlock).not.toHaveBeenCalled();
  });

  it('renders custom block buttons when customBlockDefinitions is provided', () => {
    const { editor } = makeEditor();
    const customDef = {
      type: 'callout',
      name: 'Callout',
      icon: 'Bell',
      fields: [],
      template: '',
    } as any;

    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CUSTOM_BLOCK_DEFINITIONS_KEY]: [customDef],
    });

    expect(
      wrapper.find('button[data-palette-type="custom:callout"]').exists(),
    ).toBe(true);
  });

  it('clicking a custom block creates a custom block via createCustomBlock', async () => {
    const { editor, addBlock } = makeEditor();
    const customDef = {
      type: 'callout',
      name: 'Callout',
      icon: 'Bell',
      fields: [{ type: 'text', key: 'message', label: 'Msg', default: 'Hi' }],
      template: '',
    } as any;

    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CUSTOM_BLOCK_DEFINITIONS_KEY]: [customDef],
    });

    await wrapper.find('button[data-palette-type="custom:callout"]').trigger('click');

    expect(addBlock).toHaveBeenCalledOnce();
    const inserted = addBlock.mock.calls[0][0];
    expect(inserted.type).toBe('custom');
    expect(inserted.customType).toBe('callout');
    expect(inserted.fieldValues).toEqual({ message: 'Hi' });
  });

  it('insert is a no-op when no editor provider is present', async () => {
    const wrapper = mountSidebar({ [EDITOR_KEY]: null });
    const btn = wrapper.find('button[data-palette-type="title"]');
    await btn.trigger('click');
    // no throw
    expect(btn.exists()).toBe(true);
  });

  it('shows modules browser button when capabilities provide savedModules with count > 0', () => {
    const { editor } = makeEditor();
    const openBrowser = vi.fn();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CLOUD_TRANSLATIONS_KEY]: cloudEn,
      [CAPABILITIES_KEY]: {
        savedModules: {
          moduleCount: { value: 3 },
          openBrowser,
        },
      } as any,
    });

    const moduleBtn = wrapper.find(
      'button[aria-label="sidebarNav.browseModules"]',
    );
    expect(moduleBtn.exists()).toBe(true);
  });

  it('does NOT show modules browser when moduleCount is 0', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CAPABILITIES_KEY]: {
        savedModules: {
          moduleCount: { value: 0 },
          openBrowser: vi.fn(),
        },
      } as any,
    });

    expect(
      wrapper.find('button[aria-label="sidebarNav.browseModules"]').exists(),
    ).toBe(false);
  });
});

describe('Sidebar — blocks (palette allowlist + order)', () => {
  function paletteTypes(wrapper: ReturnType<typeof mountSidebar>): (string | undefined)[] {
    return wrapper
      .findAll('button[data-palette-type]')
      .map((b) => b.attributes('data-palette-type'));
  }

  it('restricts the palette to the listed types, in the given order', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [PALETTE_BLOCKS_KEY]: ['button', 'section', 'image'],
    });
    expect(paletteTypes(wrapper)).toEqual(['button', 'section', 'image']);
  });

  it('treats an empty blocks array as the full default palette', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [PALETTE_BLOCKS_KEY]: [],
    });
    expect(paletteTypes(wrapper)).toEqual([
      'section',
      'image',
      'title',
      'paragraph',
      'button',
      'divider',
      'video',
      'social',
      'menu',
      'table',
      'spacer',
      'html',
    ]);
  });

  it('interleaves a custom block among built-ins via the custom: prefix', () => {
    const { editor } = makeEditor();
    const customDef = {
      type: 'qrcode',
      name: 'QR Code',
      icon: 'QrCode',
      fields: [],
      template: '',
    } as any;
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CUSTOM_BLOCK_DEFINITIONS_KEY]: [customDef],
      [PALETTE_BLOCKS_KEY]: ['section', 'custom:qrcode', 'button'],
    });
    expect(paletteTypes(wrapper)).toEqual(['section', 'custom:qrcode', 'button']);
  });

  it('warns once and skips an unknown blocks entry', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [PALETTE_BLOCKS_KEY]: ['section', 'nope', 'image'],
    });

    expect(paletteTypes(wrapper)).toEqual(['section', 'image']);

    const nopeWarns = warnSpy.mock.calls.filter((c) =>
      String(c[1]).includes('"nope"'),
    );
    expect(nopeWarns).toHaveLength(1);
    expect(nopeWarns[0][0]).toBe('[Templatical]');
    warnSpy.mockRestore();
  });

  it('skips and warns countdown when listed without a plan capability', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [PALETTE_BLOCKS_KEY]: ['section', 'countdown'],
    });

    expect(paletteTypes(wrapper)).toEqual(['section']);
    expect(
      warnSpy.mock.calls.some((c) => String(c[1]).includes('"countdown"')),
    ).toBe(true);
    warnSpy.mockRestore();
  });

  it('includes countdown when listed and the plan capability is present', () => {
    const { editor } = makeEditor();
    const wrapper = mountSidebar({
      [EDITOR_KEY]: editor,
      [CAPABILITIES_KEY]: { plan: { hasFeature: () => true } } as any,
      [PALETTE_BLOCKS_KEY]: ['section', 'countdown'],
    });
    expect(paletteTypes(wrapper)).toEqual(['section', 'countdown']);
  });
});
