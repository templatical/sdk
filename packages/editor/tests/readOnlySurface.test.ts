// @vitest-environment happy-dom
import './dom-stubs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { useEditor } from '@templatical/core';
import {
  createCustomBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createTableBlock,
  createTitleBlock,
  type Block,
} from '@templatical/types';
import Canvas from '../src/components/Canvas.vue';
import SectionBlock from '../src/components/blocks/SectionBlock.vue';
import CustomBlock from '../src/components/blocks/CustomBlock.vue';
import BlockWrapper from '../src/components/blocks/BlockWrapper.vue';
import ParagraphBlock from '../src/components/blocks/ParagraphBlock.vue';
import TitleBlock from '../src/components/blocks/TitleBlock.vue';
import TableBlock from '../src/components/blocks/TableBlock.vue';
import BlockPreviewCanvas from '../src/components/BlockPreviewCanvas.vue';
import { EDITOR_KEY, READ_ONLY_SURFACE_KEY } from '../src/keys';
import { mountEditor } from './helpers/mount';

vi.mock('../src/components/blocks/ParagraphEditor.vue', () => ({ __esModule: true, name: 'ParagraphEditor', default: { name: 'ParagraphEditor', template: '<div class="paragraph-editor" />' } }));
vi.mock('../src/components/blocks/TitleEditor.vue', () => ({ __esModule: true, name: 'TitleEditor', default: { name: 'TitleEditor', template: '<div class="title-editor" />' } }));

function mountCanvasSurface(previewMode: boolean, blocks: Block[]) {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  const editor = useEditor({ content });
  const wrapper = mountEditor(Canvas, {
    props: {
      viewport: 'desktop',
      content: editor.content.value,
      selectedBlockId: null,
      darkMode: false,
      previewMode,
    },
    provides: { [EDITOR_KEY]: editor },
  } as never);
  return { wrapper, editor };
}

function mountSectionSurface(readOnly: boolean | undefined, children: Block[]) {
  const section = createSectionBlock({ columns: '1', children: [children] });
  const content = createDefaultTemplateContent();
  content.blocks = [section];
  const editor = useEditor({ content });
  const provides: Record<symbol, unknown> = { [EDITOR_KEY]: editor };
  if (readOnly !== undefined) {
    provides[READ_ONLY_SURFACE_KEY] = computed(() => readOnly);
  }
  const wrapper = mountEditor(SectionBlock, {
    props: { block: section, viewport: 'desktop' },
    provides,
  } as never);
  return { wrapper, editor, section };
}

function customChild() {
  return createCustomBlock({
    type: 'hero',
    name: 'Hero',
    template: '<p>{{ title }}</p>',
    fields: [{ key: 'title', label: 'Title', type: 'text' }],
  });
}

describe('Canvas read-only guards', () => {
  it('ignores child updates in preview mode', () => {
    const block = createParagraphBlock();
    const { wrapper, editor } = mountCanvasSurface(true, [block]);
    const updateBlock = vi.spyOn(editor, 'updateBlock');

    wrapper.findComponent(ParagraphBlock).vm.$emit('update', { content: '<p>Changed</p>' });

    expect(updateBlock).not.toHaveBeenCalled();
  });

  it('forwards child updates while editing', () => {
    const block = createParagraphBlock();
    const { wrapper, editor } = mountCanvasSurface(false, [block]);
    const updateBlock = vi.spyOn(editor, 'updateBlock');
    const updates = { content: '<p>Changed</p>' };

    wrapper.findComponent(ParagraphBlock).vm.$emit('update', updates);

    expect(updateBlock).toHaveBeenCalledExactlyOnceWith(block.id, updates);
  });

  it('ignores custom fetch-data in preview mode', () => {
    const block = customChild();
    const { wrapper, editor } = mountCanvasSurface(true, [block]);
    const updateBlock = vi.spyOn(editor, 'updateBlock');

    wrapper.findComponent(CustomBlock).vm.$emit('fetch-data', {
      fieldValues: { title: 'Fetched' },
      dataSourceFetched: true,
    });

    expect(updateBlock).not.toHaveBeenCalled();
  });

  it('forwards custom fetch-data while editing', () => {
    const block = customChild();
    const { wrapper, editor } = mountCanvasSurface(false, [block]);
    const updateBlock = vi.spyOn(editor, 'updateBlock');

    wrapper.findComponent(CustomBlock).vm.$emit('fetch-data', {
      fieldValues: { title: 'Fetched' },
      dataSourceFetched: true,
    });

    expect(updateBlock).toHaveBeenCalledExactlyOnceWith(block.id, {
      fieldValues: { title: 'Fetched' },
      dataSourceFetched: true,
    });
  });

  it('ignores draggable update:modelValue in preview mode', () => {
    const added = createParagraphBlock();
    const { wrapper, editor } = mountCanvasSurface(true, []);
    const addBlock = vi.spyOn(editor, 'addBlock');

    wrapper.getComponent(VueDraggable).vm.$emit('update:modelValue', [added]);

    expect(addBlock).not.toHaveBeenCalled();
    expect(editor.content.value.blocks).toEqual([]);
  });

  it('applies draggable update:modelValue while editing', () => {
    const added = createParagraphBlock();
    const { wrapper, editor } = mountCanvasSurface(false, []);
    const addBlock = vi.spyOn(editor, 'addBlock');

    wrapper.getComponent(VueDraggable).vm.$emit('update:modelValue', [added]);

    expect(addBlock).toHaveBeenCalledExactlyOnceWith(added, undefined, 0, 0);
  });

  it('ignores draggable update in preview mode', () => {
    const first = createParagraphBlock();
    const second = createParagraphBlock();
    const { wrapper, editor } = mountCanvasSurface(true, [first, second]);
    const moveBlock = vi.spyOn(editor, 'moveBlock');

    wrapper.getComponent(VueDraggable).vm.$emit('update', { oldIndex: 0, newIndex: 1 });

    expect(moveBlock).not.toHaveBeenCalled();
    expect(editor.content.value.blocks.map((block) => block.id)).toEqual([first.id, second.id]);
  });

  it('applies draggable update while editing', () => {
    const first = createParagraphBlock();
    const second = createParagraphBlock();
    const { wrapper, editor } = mountCanvasSurface(false, [first, second]);
    const moveBlock = vi.spyOn(editor, 'moveBlock');

    wrapper.getComponent(VueDraggable).vm.$emit('update', { oldIndex: 0, newIndex: 1 });

    expect(moveBlock).toHaveBeenCalledExactlyOnceWith(first.id, 1, undefined, 0);
  });
});

describe('SectionBlock read-only guards', () => {
  it('ignores child updates on a read-only surface', () => {
    const child = createParagraphBlock();
    const { wrapper, editor } = mountSectionSurface(true, [child]);
    const updateBlock = vi.spyOn(editor, 'updateBlock');

    wrapper.findComponent(ParagraphBlock).vm.$emit('update', { content: '<p>Changed</p>' });

    expect(updateBlock).not.toHaveBeenCalled();
  });

  it('forwards child updates on an editing surface', () => {
    const child = createParagraphBlock();
    const { wrapper, editor } = mountSectionSurface(false, [child]);
    const updateBlock = vi.spyOn(editor, 'updateBlock');
    const updates = { content: '<p>Changed</p>' };

    wrapper.findComponent(ParagraphBlock).vm.$emit('update', updates);

    expect(updateBlock).toHaveBeenCalledExactlyOnceWith(child.id, updates);
  });

  it('ignores custom fetch-data on a read-only surface', () => {
    const child = customChild();
    const { wrapper, editor } = mountSectionSurface(true, [child]);
    const updateBlock = vi.spyOn(editor, 'updateBlock');

    wrapper.findComponent(CustomBlock).vm.$emit('fetch-data', {
      fieldValues: { title: 'Fetched' },
      dataSourceFetched: true,
    });

    expect(updateBlock).not.toHaveBeenCalled();
  });

  it('forwards custom fetch-data on an editing surface', () => {
    const child = customChild();
    const { wrapper, editor } = mountSectionSurface(false, [child]);
    const updateBlock = vi.spyOn(editor, 'updateBlock');

    wrapper.findComponent(CustomBlock).vm.$emit('fetch-data', {
      fieldValues: { title: 'Fetched' },
      dataSourceFetched: true,
    });

    expect(updateBlock).toHaveBeenCalledExactlyOnceWith(child.id, {
      fieldValues: { title: 'Fetched' },
      dataSourceFetched: true,
    });
  });

  it('disables column dragging on a read-only surface', () => {
    const { wrapper } = mountSectionSurface(true, [createParagraphBlock()]);

    expect(wrapper.getComponent(VueDraggable).props('disabled')).toBe(true);
  });

  it('enables column dragging on an editing surface', () => {
    const { wrapper } = mountSectionSurface(false, [createParagraphBlock()]);

    expect(wrapper.getComponent(VueDraggable).props('disabled')).toBe(false);
  });

  it('enables column dragging when no surface signal is provided', () => {
    const { wrapper } = mountSectionSurface(undefined, [createParagraphBlock()]);

    expect(wrapper.getComponent(VueDraggable).props('disabled')).toBe(false);
  });

  it('ignores column update:modelValue on a read-only surface', () => {
    const child = createParagraphBlock();
    const added = createParagraphBlock();
    const { wrapper, editor, section } = mountSectionSurface(true, [child]);
    const addBlock = vi.spyOn(editor, 'addBlock');

    wrapper.getComponent(VueDraggable).vm.$emit('update:modelValue', [child, added]);

    expect(addBlock).not.toHaveBeenCalled();
    expect(section.children[0]?.map((block) => block.id)).toEqual([child.id]);
  });

  it('applies column update:modelValue on an editing surface', () => {
    const child = createParagraphBlock();
    const added = createParagraphBlock();
    const { wrapper, editor, section } = mountSectionSurface(false, [child]);
    const addBlock = vi.spyOn(editor, 'addBlock');

    wrapper.getComponent(VueDraggable).vm.$emit('update:modelValue', [child, added]);

    expect(addBlock).toHaveBeenCalledExactlyOnceWith(added, section.id, 0, 1);
  });

  it('ignores column update on a read-only surface', () => {
    const first = createParagraphBlock();
    const second = createParagraphBlock();
    const { wrapper, editor, section } = mountSectionSurface(true, [first, second]);
    const moveBlock = vi.spyOn(editor, 'moveBlock');

    wrapper.getComponent(VueDraggable).vm.$emit('update', { oldIndex: 0, newIndex: 1 });

    expect(moveBlock).not.toHaveBeenCalled();
    expect(section.children[0]?.map((block) => block.id)).toEqual([first.id, second.id]);
  });

  it('applies column update on an editing surface', () => {
    const first = createParagraphBlock();
    const second = createParagraphBlock();
    const { wrapper, editor, section } = mountSectionSurface(false, [first, second]);
    const moveBlock = vi.spyOn(editor, 'moveBlock');

    wrapper.getComponent(VueDraggable).vm.$emit('update', { oldIndex: 0, newIndex: 1 });

    expect(moveBlock).toHaveBeenCalledExactlyOnceWith(first.id, 1, section.id, 0);
  });

  it('ignores child selection on a read-only surface', () => {
    const { wrapper, editor } = mountSectionSurface(true, [createParagraphBlock()]);
    const selectBlock = vi.spyOn(editor, 'selectBlock');

    wrapper.getComponent(BlockWrapper).vm.$emit('select');

    expect(selectBlock).not.toHaveBeenCalled();
  });

  it('selects a child on an editing surface', () => {
    const child = createParagraphBlock();
    const { wrapper, editor } = mountSectionSurface(false, [child]);
    const selectBlock = vi.spyOn(editor, 'selectBlock');

    wrapper.getComponent(BlockWrapper).vm.$emit('select');

    expect(selectBlock).toHaveBeenCalledExactlyOnceWith(child.id);
  });
});

describe('read-only block surfaces', () => {
  for (const [name, component, block] of [
    ['paragraph', ParagraphBlock, createParagraphBlock({ content: '<p>Original</p>' })],
    ['title', TitleBlock, createTitleBlock({ content: '<p>Original</p>' })],
  ] as const) {
    it(`${name} ignores double clicks on a read-only surface`, async () => {
      const updateBlock = vi.fn();
      const wrapper = mountEditor(component, {
        props: { block, viewport: 'desktop' },
        provides: {
          [READ_ONLY_SURFACE_KEY]: computed(() => true),
          [EDITOR_KEY]: { updateBlock },
        },
      } as never);

      await wrapper.trigger('dblclick');
      expect(wrapper.findComponent({ name: `${name === 'title' ? 'Title' : 'Paragraph'}Editor` }).exists()).toBe(false);
      expect(wrapper.find('.tpl-text-content').exists()).toBe(true);
      expect(updateBlock).not.toHaveBeenCalled();
    });

    it(`${name} enters edit mode on an editing surface`, async () => {
      const wrapper = mountEditor(component, {
        props: { block, viewport: 'desktop' },
        provides: { [READ_ONLY_SURFACE_KEY]: computed(() => false) },
      } as never);

      await wrapper.trigger('dblclick');
      expect(wrapper.find('.tpl-text-content').exists()).toBe(false);
    });
  }

  it.each([
    ['body', false, 'td'],
    ['header', true, 'th'],
  ] as const)('blocks %s cell editing and blur writes inside BlockPreviewCanvas', async (_name, hasHeaderRow, selector) => {
    const table = createTableBlock();
    table.rows = [{ id: 'r1', cells: [{ id: 'c1', content: 'Original' }] }];
    table.hasHeaderRow = hasHeaderRow;
    const content = createDefaultTemplateContent();
    content.blocks = [table];
    const updateBlock = vi.fn();
    const wrapper = mountEditor(BlockPreviewCanvas, {
      props: { blocks: [table] },
      provides: {
        [EDITOR_KEY]: { content: ref(content), state: {}, updateBlock, selectBlock: vi.fn() },
      },
    } as never);

    const cell = wrapper.get(selector);
    expect(cell.attributes('contenteditable')).toBe('false');
    (cell.element as HTMLElement).innerText = 'Changed';
    await cell.trigger('blur');
    expect(updateBlock).not.toHaveBeenCalled();
    expect(table.rows[0]?.cells[0]?.content).toBe('Original');
  });

  it('keeps table cells editable on an editing surface', async () => {
    const table = createTableBlock();
    table.rows = [{ id: 'r1', cells: [{ id: 'c1', content: 'Original' }] }];
    table.hasHeaderRow = false;
    const updateBlock = vi.fn();
    const wrapper = mountEditor(TableBlock, {
      props: { block: table, viewport: 'desktop' },
      provides: { [EDITOR_KEY]: { updateBlock, selectBlock: vi.fn() } },
    } as never);

    const cell = wrapper.get('td');
    expect(cell.attributes('contenteditable')).toBe('true');
    (cell.element as HTMLElement).innerText = 'Changed';
    await cell.trigger('blur');
    expect(updateBlock).toHaveBeenCalledWith(table.id, {
      rows: [{ id: 'r1', cells: [{ id: 'c1', content: 'Changed' }] }],
    });
  });

  it('both canvas components provide the read-only surface key', () => {
    for (const file of ['Canvas.vue', 'BlockPreviewCanvas.vue']) {
      const source = readFileSync(resolve('src/components', file), 'utf8');
      expect(source).toMatch(/provide\(\s*READ_ONLY_SURFACE_KEY,/);
    }
  });
});
