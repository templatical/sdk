import { describe, expect, it } from 'vitest';
import {
  ASPECT_RATIO_VALUES,
  getExportSettings,
  calculateOutputDimensions,
} from '../src/composables/useImageCrop';

describe('ASPECT_RATIO_VALUES', () => {
  it('has free as undefined', () => {
    expect(ASPECT_RATIO_VALUES.free).toBeUndefined();
  });

  it('has square as 1', () => {
    expect(ASPECT_RATIO_VALUES.square).toBe(1);
  });

  it('has landscape43 as 4/3', () => {
    expect(ASPECT_RATIO_VALUES.landscape43).toBeCloseTo(1.333, 2);
  });

  it('has landscape169 as 16/9', () => {
    expect(ASPECT_RATIO_VALUES.landscape169).toBeCloseTo(1.778, 2);
  });

  it('has original as undefined', () => {
    expect(ASPECT_RATIO_VALUES.original).toBeUndefined();
  });
});

describe('getExportSettings', () => {
  it('returns PNG for image/png', () => {
    const settings = getExportSettings('image/png');
    expect(settings.mimeType).toBe('image/png');
    expect(settings.quality).toBe(1);
  });

  it('returns PNG for image/gif (converts GIF to PNG)', () => {
    const settings = getExportSettings('image/gif');
    expect(settings.mimeType).toBe('image/png');
    expect(settings.quality).toBe(1);
  });

  it('returns WebP for image/webp', () => {
    const settings = getExportSettings('image/webp');
    expect(settings.mimeType).toBe('image/webp');
    expect(settings.quality).toBe(0.92);
  });

  it('defaults to JPEG for other types', () => {
    const settings = getExportSettings('image/jpeg');
    expect(settings.mimeType).toBe('image/jpeg');
    expect(settings.quality).toBe(0.92);
  });

  it('defaults to JPEG for unknown types', () => {
    const settings = getExportSettings('image/bmp');
    expect(settings.mimeType).toBe('image/jpeg');
    expect(settings.quality).toBe(0.92);
  });
});

describe('calculateOutputDimensions', () => {
  it('returns original dimensions when no constraints', () => {
    const result = calculateOutputDimensions(800, 600);
    expect(result).toEqual({ width: 800, height: 600 });
  });

  it('scales down to maxWidth maintaining aspect ratio', () => {
    const result = calculateOutputDimensions(800, 600, 400);
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });

  it('scales down to maxHeight maintaining aspect ratio', () => {
    const result = calculateOutputDimensions(800, 600, undefined, 300);
    expect(result.height).toBe(300);
    expect(result.width).toBe(400);
  });

  it('respects both constraints - width limited first', () => {
    const result = calculateOutputDimensions(1000, 500, 400, 300);
    // Width scales: 1000 -> 400, height: 500 * 0.4 = 200
    // 200 < 300, so maxHeight doesn't kick in
    expect(result.width).toBe(400);
    expect(result.height).toBe(200);
  });

  it('respects both constraints - height limited after width', () => {
    const result = calculateOutputDimensions(1000, 800, 600, 300);
    // Width scales: 1000 -> 600, height: 800 * 0.6 = 480
    // 480 > 300, so maxHeight kicks in: height -> 300, width: 600 * (300/480) = 375
    expect(result.height).toBe(300);
    expect(result.width).toBe(375);
  });

  it('does not scale up when smaller than constraints', () => {
    const result = calculateOutputDimensions(200, 150, 400, 300);
    expect(result).toEqual({ width: 200, height: 150 });
  });

  it('handles square dimensions', () => {
    const result = calculateOutputDimensions(1000, 1000, 500);
    expect(result).toEqual({ width: 500, height: 500 });
  });

  it('handles zero maxWidth', () => {
    const result = calculateOutputDimensions(800, 600, 0, 300);
    // maxWidth=0 is falsy, skip; maxHeight=300 kicks in
    expect(result.height).toBe(300);
    expect(result.width).toBe(400);
  });
});
