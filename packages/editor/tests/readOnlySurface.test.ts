// @vitest-environment happy-dom
import './dom-stubs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createTableBlock,
  createTitleBlock,
} from '@templatical/types';
import ParagraphBlock from '../src/components/blocks/ParagraphBlock.vue';
import TitleBlock from '../src/components/blocks/TitleBlock.vue';
import TableBlock from '../src/components/blocks/TableBlock.vue';
import BlockPreviewCanvas from '../src/components/BlockPreviewCanvas.vue';
import { EDITOR_KEY, READ_ONLY_SURFACE_KEY } from '../src/keys';
import { mountEditor } from './helpers/mount';

vi.mock('../src/components/blocks/ParagraphEditor.vue', () => ({ __esModule: true, name: 'ParagraphEditor', default: { name: 'ParagraphEditor', template: '<div class="paragraph-editor" />' } }));
vi.mock('../src/components/blocks/TitleEditor.vue', () => ({ __esModule: true, name: 'TitleEditor', default: { name: 'TitleEditor', template: '<div class="title-editor" />' } }));

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
