import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  ASPECT_RATIO_VALUES,
  getExportSettings,
  calculateOutputDimensions,
  resizeCanvas,
  canvasToFile,
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

  it('handles equal width and height constraints', () => {
    const result = calculateOutputDimensions(1000, 1000, 500, 500);
    expect(result).toEqual({ width: 500, height: 500 });
  });

  it('handles very large dimensions', () => {
    const result = calculateOutputDimensions(10000, 8000, 1920, 1080);
    // Width scales: 10000 -> 1920, height: 8000 * 0.192 = 1536
    // 1536 > 1080, so height clamps: 1080, width: 1920 * (1080/1536) = 1350
    expect(result.height).toBe(1080);
    expect(result.width).toBeLessThanOrEqual(1920);
  });

  it('returns original when exactly at constraints', () => {
    const result = calculateOutputDimensions(400, 300, 400, 300);
    expect(result).toEqual({ width: 400, height: 300 });
  });

  it('handles zero width input', () => {
    const result = calculateOutputDimensions(0, 600, 400, 300);
    // Width 0 < 400, skip width constraint
    // Height 600 > 300, ratio=0.5: height -> 300, width -> round(0 * 0.5) = 0
    expect(result.width).toBe(0);
    expect(result.height).toBe(300);
  });

  it('handles zero height input', () => {
    const result = calculateOutputDimensions(800, 0, 400, 300);
    // Width: 800 > 400, so ratio = 0.5; width -> 400, height -> 0 * 0.5 = 0
    expect(result.width).toBe(400);
    expect(result.height).toBe(0);
  });

  it('handles zero width and height input', () => {
    const result = calculateOutputDimensions(0, 0);
    expect(result).toEqual({ width: 0, height: 0 });
  });

  it('handles extreme wide aspect ratio (panoramic)', () => {
    const result = calculateOutputDimensions(10000, 100, 1000, 500);
    // Width scales: 10000 -> 1000, height: 100 * 0.1 = 10
    // 10 < 500, so maxHeight doesn't kick in
    expect(result.width).toBe(1000);
    expect(result.height).toBe(10);
  });

  it('handles extreme tall aspect ratio', () => {
    const result = calculateOutputDimensions(100, 10000, 500, 1000);
    // Width: 100 < 500, skip width constraint
    // Height: 10000 > 1000, ratio = 0.1; height -> 1000, width -> 100 * 0.1 = 10
    expect(result.height).toBe(1000);
    expect(result.width).toBe(10);
  });

  it('handles 1x1 pixel dimensions', () => {
    const result = calculateOutputDimensions(1, 1, 500, 500);
    expect(result).toEqual({ width: 1, height: 1 });
  });
});

describe('getExportSettings (additional)', () => {
  it('returns JPEG for image/tiff (unknown type)', () => {
    const settings = getExportSettings('image/tiff');
    expect(settings.mimeType).toBe('image/jpeg');
    expect(settings.quality).toBe(0.92);
  });

  it('returns JPEG for empty string', () => {
    const settings = getExportSettings('');
    expect(settings.mimeType).toBe('image/jpeg');
    expect(settings.quality).toBe(0.92);
  });
});

function createMockCanvas(width: number, height: number) {
  const ctx = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    drawImage: vi.fn(),
  };
  return {
    width,
    height,
    getContext: vi.fn(() => ctx),
    toBlob: vi.fn(),
    __ctx: ctx,
  } as unknown as HTMLCanvasElement & { __ctx: typeof ctx };
}

describe('resizeCanvas', () => {
  let origDocument: typeof globalThis.document;

  beforeEach(() => {
    origDocument = globalThis.document;
    // Provide a minimal document stub for resizeCanvas
    (globalThis as any).document = {
      createElement: vi.fn(() => createMockCanvas(0, 0)),
    };
  });

  afterEach(() => {
    (globalThis as any).document = origDocument;
  });

  it('returns same canvas when no constraints', () => {
    const source = createMockCanvas(800, 600);
    const result = resizeCanvas(source);
    expect(result).toBe(source);
  });

  it('returns same canvas when within bounds', () => {
    const source = createMockCanvas(200, 150);
    const result = resizeCanvas(source, 400, 300);
    expect(result).toBe(source);
  });

  it('scales down width proportionally', () => {
    const resized = createMockCanvas(0, 0);
    vi.mocked(document.createElement).mockReturnValue(resized as any);

    const source = createMockCanvas(800, 600);
    const result = resizeCanvas(source, 400);

    expect(result).toBe(resized);
    expect(resized.width).toBe(400);
    expect(resized.height).toBe(300);
  });

  it('scales down height proportionally', () => {
    const resized = createMockCanvas(0, 0);
    vi.mocked(document.createElement).mockReturnValue(resized as any);

    const source = createMockCanvas(800, 600);
    const result = resizeCanvas(source, undefined, 300);

    expect(result).toBe(resized);
    expect(resized.height).toBe(300);
    expect(resized.width).toBe(400);
  });

  it('draws source onto resized canvas', () => {
    const resized = createMockCanvas(0, 0);
    vi.mocked(document.createElement).mockReturnValue(resized as any);

    const source = createMockCanvas(800, 600);
    resizeCanvas(source, 400);

    const ctx = resized.__ctx;
    expect(resized.getContext).toHaveBeenCalledWith('2d');
    expect(ctx.imageSmoothingEnabled).toBe(true);
    expect(ctx.imageSmoothingQuality).toBe('high');
    expect(ctx.drawImage).toHaveBeenCalledWith(source, 0, 0, 400, 300);
  });
});

describe('canvasToFile', () => {
  it('resolves with File from blob', async () => {
    const canvas = createMockCanvas(100, 100);
    const blob = new Blob(['test'], { type: 'image/jpeg' });

    (canvas.toBlob as any).mockImplementation(
      (callback: (b: Blob | null) => void) => {
        callback(blob);
      },
    );

    const file = await canvasToFile(canvas, 'photo.jpg', {
      mimeType: 'image/jpeg',
      quality: 0.92,
    });

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('photo.jpeg');
    expect(file.type).toBe('image/jpeg');
  });

  it('rejects when toBlob returns null', async () => {
    const canvas = createMockCanvas(100, 100);

    (canvas.toBlob as any).mockImplementation(
      (callback: (b: Blob | null) => void) => {
        callback(null);
      },
    );

    await expect(
      canvasToFile(canvas, 'photo.jpg', {
        mimeType: 'image/jpeg',
        quality: 0.92,
      }),
    ).rejects.toThrow('Failed to create blob from canvas');
  });

  it('uses correct extension from mime type', async () => {
    const canvas = createMockCanvas(100, 100);
    const blob = new Blob(['test'], { type: 'image/png' });

    (canvas.toBlob as any).mockImplementation(
      (callback: (b: Blob | null) => void) => {
        callback(blob);
      },
    );

    const file = await canvasToFile(canvas, 'photo.jpg', {
      mimeType: 'image/png',
      quality: 1,
    });

    expect(file.name).toBe('photo.png');
  });

  it('strips old extension before adding new one', async () => {
    const canvas = createMockCanvas(100, 100);
    const blob = new Blob(['test'], { type: 'image/webp' });

    (canvas.toBlob as any).mockImplementation(
      (callback: (b: Blob | null) => void) => {
        callback(blob);
      },
    );

    const file = await canvasToFile(canvas, 'my-image.png', {
      mimeType: 'image/webp',
      quality: 0.92,
    });

    expect(file.name).toBe('my-image.webp');
  });
});
