import { describe, expect, it } from 'vitest';
import { getWidthPercentages, getWidthPixels } from '../src';

describe('getWidthPercentages', () => {
  it('returns 100% for single column', () => {
    expect(getWidthPercentages('1')).toEqual(['100%']);
  });

  it('returns 50/50 for two columns', () => {
    expect(getWidthPercentages('2')).toEqual(['50%', '50%']);
  });

  it('returns three column widths summing to 100%', () => {
    expect(getWidthPercentages('3')).toEqual(['33.33%', '33.33%', '33.34%']);
  });

  it('returns 33.33/66.67 for 1-2 layout', () => {
    expect(getWidthPercentages('1-2')).toEqual(['33.33%', '66.67%']);
  });

  it('returns 66.67/33.33 for 2-1 layout', () => {
    expect(getWidthPercentages('2-1')).toEqual(['66.67%', '33.33%']);
  });
});

describe('getWidthPixels', () => {
  it('returns full width for single column', () => {
    expect(getWidthPixels('1', 600)).toEqual([600]);
  });

  it('returns half widths for two columns', () => {
    expect(getWidthPixels('2', 600)).toEqual([300, 300]);
  });

  it('returns third widths for three columns', () => {
    expect(getWidthPixels('3', 600)).toEqual([200, 200, 200]);
  });

  it('returns 1/3 and 2/3 for 1-2 layout', () => {
    expect(getWidthPixels('1-2', 600)).toEqual([200, 400]);
  });

  it('returns 2/3 and 1/3 for 2-1 layout', () => {
    expect(getWidthPixels('2-1', 600)).toEqual([400, 200]);
  });
});
