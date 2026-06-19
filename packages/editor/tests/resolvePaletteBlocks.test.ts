import { describe, expect, it } from 'vitest';
import { resolvePaletteBlocks } from '../src/utils/resolvePaletteBlocks';

interface Item {
  type: string;
  label: string;
}

const CANDIDATES: Item[] = [
  { type: 'section', label: 'Section' },
  { type: 'image', label: 'Image' },
  { type: 'title', label: 'Title' },
  { type: 'paragraph', label: 'Paragraph' },
  { type: 'button', label: 'Button' },
  { type: 'custom:qrcode', label: 'QR Code' },
];

describe('resolvePaletteBlocks', () => {
  it('returns the candidates unchanged (same reference) when paletteBlocks is undefined', () => {
    const result = resolvePaletteBlocks(CANDIDATES, undefined);
    expect(result.items).toBe(CANDIDATES);
    expect(result.unknown).toEqual([]);
  });

  it('treats an empty array as "not configured" and returns the full palette', () => {
    const result = resolvePaletteBlocks(CANDIDATES, []);
    expect(result.items).toBe(CANDIDATES);
    expect(result.unknown).toEqual([]);
  });

  it('filters to only the listed types (strict allowlist)', () => {
    const result = resolvePaletteBlocks(CANDIDATES, [
      'section',
      'image',
      'button',
    ]);
    expect(result.items.map((i) => i.type)).toEqual([
      'section',
      'image',
      'button',
    ]);
    expect(result.unknown).toEqual([]);
  });

  it('orders items by the paletteBlocks order, not the candidate order', () => {
    const result = resolvePaletteBlocks(CANDIDATES, [
      'button',
      'section',
      'title',
    ]);
    expect(result.items.map((i) => i.type)).toEqual([
      'button',
      'section',
      'title',
    ]);
  });

  it('interleaves a custom block among built-ins via the custom: prefix', () => {
    const result = resolvePaletteBlocks(CANDIDATES, [
      'section',
      'title',
      'custom:qrcode',
      'button',
    ]);
    expect(result.items.map((i) => i.type)).toEqual([
      'section',
      'title',
      'custom:qrcode',
      'button',
    ]);
    expect(result.items[2].label).toBe('QR Code');
    expect(result.unknown).toEqual([]);
  });

  it('returns the actual candidate object reference for each matched entry', () => {
    const result = resolvePaletteBlocks(CANDIDATES, ['image']);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toBe(CANDIDATES[1]);
  });

  it('collects unknown entries and skips them from items', () => {
    const result = resolvePaletteBlocks(CANDIDATES, [
      'section',
      'nope',
      'image',
      'qrcode', // missing custom: prefix → unknown
    ]);
    expect(result.items.map((i) => i.type)).toEqual(['section', 'image']);
    expect(result.unknown).toEqual(['nope', 'qrcode']);
  });

  it('renders a duplicate known type once, without reporting it unknown', () => {
    const result = resolvePaletteBlocks(CANDIDATES, [
      'image',
      'image',
      'section',
    ]);
    expect(result.items.map((i) => i.type)).toEqual(['image', 'section']);
    expect(result.unknown).toEqual([]);
  });

  it('reports a duplicate unknown entry only once', () => {
    const result = resolvePaletteBlocks(CANDIDATES, ['nope', 'nope']);
    expect(result.items).toEqual([]);
    expect(result.unknown).toEqual(['nope']);
  });

  it('returns empty items when every entry is unknown', () => {
    const result = resolvePaletteBlocks(CANDIDATES, ['foo', 'bar']);
    expect(result.items).toEqual([]);
    expect(result.unknown).toEqual(['foo', 'bar']);
  });
});
