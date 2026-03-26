// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import './dom-stubs';

import { describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, ref } from 'vue';
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

function createMockPlanConfig(hasPluggableMedia = false) {
  return {
    config: ref(null),
    isLoading: ref(false),
    hasFeature: vi.fn((feature: string) => feature === 'pluggable_media' && hasPluggableMedia),
    features: computed(() => null),
    fetchConfig: vi.fn(),
  };
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
  describe('isPluggableMediaEnabled', () => {
    it('is false when no callback', () => {
      const planConfig = createMockPlanConfig(true);
      const { isPluggableMediaEnabled } = withProvide(() => useMediaPicker(), {
        planConfig,
      });
      expect(isPluggableMediaEnabled.value).toBe(false);
    });

    it('is false when callback exists but feature not enabled', () => {
      const planConfig = createMockPlanConfig(false);
      const callback = vi.fn();
      const { isPluggableMediaEnabled } = withProvide(() => useMediaPicker(), {
        planConfig,
        onRequestMedia: callback,
      });
      expect(isPluggableMediaEnabled.value).toBe(false);
    });

    it('is true when callback exists AND feature enabled', () => {
      const planConfig = createMockPlanConfig(true);
      const callback = vi.fn();
      const { isPluggableMediaEnabled } = withProvide(() => useMediaPicker(), {
        planConfig,
        onRequestMedia: callback,
      });
      expect(isPluggableMediaEnabled.value).toBe(true);
    });
  });

  describe('requestMedia', () => {
    it('returns null when no callback', async () => {
      const planConfig = createMockPlanConfig();
      const { requestMedia } = withProvide(() => useMediaPicker(), {
        planConfig,
      });
      const result = await requestMedia();
      expect(result).toBeNull();
    });

    it('calls callback with context', async () => {
      const planConfig = createMockPlanConfig(true);
      const callback = vi.fn().mockResolvedValue(mockMediaItem);
      const { requestMedia } = withProvide(() => useMediaPicker(), {
        planConfig,
        onRequestMedia: callback,
      });

      const result = await requestMedia({ accept: ['images'] });
      expect(callback).toHaveBeenCalledWith({ accept: ['images'] });
      expect(result).toEqual(mockMediaItem);
    });

    it('defaults context to empty object', async () => {
      const planConfig = createMockPlanConfig(true);
      const callback = vi.fn().mockResolvedValue(null);
      const { requestMedia } = withProvide(() => useMediaPicker(), {
        planConfig,
        onRequestMedia: callback,
      });

      await requestMedia();
      expect(callback).toHaveBeenCalledWith({});
    });

    it('manages isRequesting state', async () => {
      const planConfig = createMockPlanConfig(true);
      let resolveCallback: (value: MediaItem | null) => void;
      const callback = vi.fn(
        () => new Promise<MediaItem | null>((resolve) => {
          resolveCallback = resolve;
        }),
      );

      const { requestMedia, isRequesting } = withProvide(() => useMediaPicker(), {
        planConfig,
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
