// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import './dom-stubs';

import { describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h } from 'vue';
import type { MediaItem } from '../src/types';
import { useMediaPicker } from '../src/composables/useMediaPicker';

function withProvide<T>(
  setup: () => T,
  provides: Record<string, unknown> = {},
): T {
  let result: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h('div');
      },
    }),
  );
  for (const [key, value] of Object.entries(provides)) {
    app.provide(key, value);
  }
  app.mount(document.createElement('div'));
  app.unmount();
  return result!;
}

const mockMediaItem: MediaItem = {
  id: 'media-1',
  filename: 'test.jpg',
  mime_type: 'image/jpeg',
  size: 1024,
  url: 'https://example.com/test.jpg',
  small_url: null,
  medium_url: null,
  large_url: null,
  folder_id: null,
  conversions_generated: false,
} as MediaItem;

describe('useMediaPicker', () => {
  // A configured handler is the whole condition: gating this by plan would charge
  // a consumer for *not* using Cloud's storage, i.e. meter nothing Cloud pays for.
  describe('isPluggableMediaEnabled', () => {
    it('is false when no callback', () => {
      const { isPluggableMediaEnabled } = withProvide(() => useMediaPicker(), {});
      expect(isPluggableMediaEnabled.value).toBe(false);
    });

    it('is true whenever a callback exists, on any plan', () => {
      const callback = vi.fn();
      const { isPluggableMediaEnabled } = withProvide(() => useMediaPicker(), {
        onRequestMedia: callback,
      });
      expect(isPluggableMediaEnabled.value).toBe(true);
    });
  });

  describe('requestMedia', () => {
    it('returns null when no callback', async () => {
      const { requestMedia } = withProvide(() => useMediaPicker(), {
      });
      const result = await requestMedia();
      expect(result).toBeNull();
    });

    it('calls callback with context', async () => {
      const callback = vi.fn().mockResolvedValue(mockMediaItem);
      const { requestMedia } = withProvide(() => useMediaPicker(), {
        onRequestMedia: callback,
      });

      const result = await requestMedia({ accept: ['images'] });
      expect(callback).toHaveBeenCalledWith({ accept: ['images'] });
      expect(result).toEqual(mockMediaItem);
    });

    it('defaults context to empty object', async () => {
      const callback = vi.fn().mockResolvedValue(null);
      const { requestMedia } = withProvide(() => useMediaPicker(), {
        onRequestMedia: callback,
      });

      await requestMedia();
      expect(callback).toHaveBeenCalledWith({});
    });

    it('manages isRequesting state', async () => {
      let resolveCallback: (value: MediaItem | null) => void;
      const callback = vi.fn(
        () => new Promise<MediaItem | null>((resolve) => {
          resolveCallback = resolve;
        }),
      );

      const { requestMedia, isRequesting } = withProvide(() => useMediaPicker(), {
        onRequestMedia: callback,
      });

      expect(isRequesting.value).toBe(false);

      const promise = requestMedia();
      expect(isRequesting.value).toBe(true);

      resolveCallback!(null);
      await promise;
      expect(isRequesting.value).toBe(false);
    });
  });
});
