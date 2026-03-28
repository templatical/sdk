import { describe, expect, it } from 'vitest';
import { createTableBlock } from '@templatical/types';
import type { TableRowData } from '@templatical/types';
import { renderBlock, RenderContext } from '../src';

const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);

function makeRows(data: string[][]): TableRowData[] {
  return data.map((cells, ri) => ({
    id: `row-${ri}`,
    cells: cells.map((content, ci) => ({
      id: `cell-${ri}-${ci}`,
      content,
    })),
  }));
}

describe('renderTable', () => {
  it('renders a table with rows and cells', () => {
    const block = createTableBlock({
      rows: makeRows([
        ['Name', 'Age'],
        ['Alice', '30'],
      ]),
      hasHeaderRow: false,
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<table');
    expect(result).toContain('<tr>');
    expect(result).toContain('Alice');
    expect(result).toContain('30');
  });

  it('returns empty for empty rows', () => {
    const block = createTableBlock({ rows: [] });
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  it('renders header row with th tags', () => {
    const block = createTableBlock({
      rows: makeRows([
        ['Header1', 'Header2'],
        ['Data1', 'Data2'],
      ]),
      hasHeaderRow: true,
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<th');
    expect(result).toContain('Header1');
    expect(result).toContain('Header2');
  });

  it('applies header background color', () => {
    const block = createTableBlock({
      rows: makeRows([
        ['H1', 'H2'],
        ['D1', 'D2'],
      ]),
      hasHeaderRow: true,
      headerBackgroundColor: '#eeeeee',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('background-color: #eeeeee');
  });

  it('renders non-header rows with td tags', () => {
    const block = createTableBlock({
      rows: makeRows([
        ['H1'],
        ['D1'],
      ]),
      hasHeaderRow: true,
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('<td');
    expect(result).toContain('D1');
  });

  it('applies border styling from block properties', () => {
    const block = createTableBlock({
      rows: makeRows([['A']]),
      hasHeaderRow: false,
      borderColor: '#ff0000',
      borderWidth: 2,
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('border: 2px solid #ff0000');
  });

  it('applies cell padding from block properties', () => {
    const block = createTableBlock({
      rows: makeRows([['A']]),
      hasHeaderRow: false,
      cellPadding: 12,
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('padding: 12px');
  });

  it('converts merge tags in cell content', () => {
    const block = createTableBlock({
      rows: makeRows([
        ['Hi <span data-merge-tag="{{name}}">Name</span>'],
      ]),
      hasHeaderRow: false,
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('{{name}}');
    expect(result).not.toContain('data-merge-tag');
  });

  it('returns empty for hidden block', () => {
    const block = createTableBlock({
      visibility: { desktop: false, tablet: false, mobile: false },
    });
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  it('sets font-size and color from block properties', () => {
    const block = createTableBlock({
      rows: makeRows([['X']]),
      hasHeaderRow: false,
      fontSize: 18,
      color: '#111111',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('font-size="18px"');
    expect(result).toContain('color="#111111"');
  });

  describe('edge cases', () => {
    it('passes cell content through raw (supports HTML/merge tags)', () => {
      const block = createTableBlock({
        rows: makeRows([['Price: $10 & <free>']]),
        hasHeaderRow: false,
      });
      const result = renderBlock(block, ctx);
      expect(result).toContain('<table');
      // Cell content is NOT escaped — it's passed through raw to support merge tags/HTML
      expect(result).toContain('Price: $10 & <free>');
    });

    it('renders single-cell table', () => {
      const block = createTableBlock({
        rows: makeRows([['Only cell']]),
        hasHeaderRow: false,
      });
      const result = renderBlock(block, ctx);
      expect(result).toContain('<td');
      expect(result).toContain('Only cell');
    });

    it('renders header row even with single row', () => {
      const block = createTableBlock({
        rows: makeRows([['Header']]),
        hasHeaderRow: true,
      });
      const result = renderBlock(block, ctx);
      expect(result).toContain('<th');
    });

    it('borderWidth zero produces no visible border', () => {
      const block = createTableBlock({
        rows: makeRows([['A']]),
        hasHeaderRow: false,
        borderWidth: 0,
      });
      const result = renderBlock(block, ctx);
      expect(result).toContain('border: 0px solid');
    });
  });
});
