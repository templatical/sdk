import { describe, expect, it } from 'vitest';
import { toPaddingString } from '../src';

describe('toPaddingString', () => {
  it('converts all four sides to CSS padding string', () => {
    expect(toPaddingString({ top: 10, right: 20, bottom: 30, left: 40 })).toBe(
      '10px 20px 30px 40px',
    );
  });

  it('handles zero values', () => {
    expect(toPaddingString({ top: 0, right: 0, bottom: 0, left: 0 })).toBe(
      '0px 0px 0px 0px',
    );
  });

  it('handles mixed zero and non-zero values', () => {
    expect(toPaddingString({ top: 0, right: 15, bottom: 0, left: 15 })).toBe(
      '0px 15px 0px 15px',
    );
  });

  it('handles all sides equal', () => {
    expect(toPaddingString({ top: 10, right: 10, bottom: 10, left: 10 })).toBe(
      '10px 10px 10px 10px',
    );
  });

  it('handles large values', () => {
    expect(
      toPaddingString({ top: 100, right: 200, bottom: 300, left: 400 }),
    ).toBe('100px 200px 300px 400px');
  });

  it('handles single pixel values', () => {
    expect(toPaddingString({ top: 1, right: 1, bottom: 1, left: 1 })).toBe(
      '1px 1px 1px 1px',
    );
  });
});
