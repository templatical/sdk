// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createTableBlock } from '@templatical/types';
import type { TableBlock } from '@templatical/types';
import TableToolbar from '../src/components/toolbar/TableToolbar.vue';
import { mountEditor } from './helpers/mount';

function mountIt(block: TableBlock) {
  return mountEditor(TableToolbar, {
    props: {
      block,
      fontFamilies: [{ value: '', label: 'Default' }],
    },
  });
}

function tableOf(rows: number, cols: number): TableBlock {
  const block = createTableBlock() as TableBlock;
  block.rows = Array.from({ length: rows }, (_, r) => ({
    id: `r${r}`,
    cells: Array.from({ length: cols }, (_, c) => ({ id: `c${r}-${c}`, content: '' })),
  }));
  return block;
}

describe('TableToolbar CRUD', () => {
  // The dimensions section is the first block in the template and renders
  // exactly 4 buttons in order: [rowMinus, rowPlus, colMinus, colPlus].
  function dimensionButtons(wrapper: ReturnType<typeof mountIt>) {
    return wrapper.findAll('button').slice(0, 4);
  }

  it('adding a row (rowPlus click) appends a row with the same column count', async () => {
    const block = tableOf(2, 3);
    const wrapper = mountIt(block);

    await dimensionButtons(wrapper)[1].trigger('click'); // rowPlus

    const [update] = wrapper.emitted('update')![0] as [Partial<TableBlock>];
    expect(update.rows).toHaveLength(3);
    expect(update.rows![2].cells).toHaveLength(3);
    for (const cell of update.rows![2].cells) {
      expect(cell.content).toBe('');
      expect(cell.id).toBeTruthy();
    }
  });

  it('adding a column (colPlus click) appends a cell to each existing row', async () => {
    const block = tableOf(2, 3);
    const wrapper = mountIt(block);

    await dimensionButtons(wrapper)[3].trigger('click'); // colPlus

    const [update] = wrapper.emitted('update')![0] as [Partial<TableBlock>];
    expect(update.rows).toHaveLength(2);
    for (const row of update.rows!) {
      expect(row.cells).toHaveLength(4);
    }
  });

  it('removing a row (rowMinus click) removes the last row', async () => {
    const block = tableOf(3, 2);
    const wrapper = mountIt(block);

    await dimensionButtons(wrapper)[0].trigger('click'); // rowMinus

    const [update] = wrapper.emitted('update')![0] as [Partial<TableBlock>];
    expect(update.rows).toHaveLength(2);
    expect(update.rows!.map((r) => r.id)).toEqual(['r0', 'r1']);
  });

  it('row minus button is disabled when only one row remains', () => {
    const block = tableOf(1, 2);
    const wrapper = mountIt(block);

    expect(dimensionButtons(wrapper)[0].attributes('disabled')).toBeDefined();
  });

  it('column minus button is disabled when only one column remains', () => {
    const block = tableOf(2, 1);
    const wrapper = mountIt(block);

    expect(dimensionButtons(wrapper)[2].attributes('disabled')).toBeDefined();
  });
});
