// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import './dom-stubs';

import { describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, ref } from 'vue';
import { useMediaCategories } from '../src/composables/useMediaCategories';

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

function createMockPlanConfig(mediaConfig: any = null) {
  return {
    config: ref({ media: mediaConfig }),
    isLoading: ref(false),
    hasFeature: vi.fn(() => false),
    features: computed(() => null),
    fetchConfig: vi.fn(),
  };
}

const sampleMediaConfig = {
  use_media_library: true,
  max_file_size: 10485760,
  categories: {
    images: {
      mime_types: ['image/jpeg', 'image/png', 'image/gif'],
      extensions: ['.jpg', '.png', '.gif'],
    },
    documents: {
      mime_types: ['application/pdf'],
      extensions: ['.pdf'],
    },
    videos: {
      mime_types: ['video/mp4'],
      extensions: ['.mp4'],
    },
  },
};

describe('useMediaCategories', () => {
  describe('isMediaLibraryEnabled', () => {
    it('defaults to true when no media config', () => {
      const planConfig = createMockPlanConfig(null);
      const { isMediaLibraryEnabled } = withProvide(() => useMediaCategories(), {
        planConfig,
      });
      expect(isMediaLibraryEnabled.value).toBe(true);
    });

    it('reflects config value', () => {
      const planConfig = createMockPlanConfig({ use_media_library: false });
      const { isMediaLibraryEnabled } = withProvide(() => useMediaCategories(), {
        planConfig,
      });
      expect(isMediaLibraryEnabled.value).toBe(false);
    });
  });

  describe('allAcceptedMimeTypes', () => {
    it('flattens all category mime types', () => {
      const planConfig = createMockPlanConfig(sampleMediaConfig);
      const { allAcceptedMimeTypes } = withProvide(() => useMediaCategories(), {
        planConfig,
      });
      expect(allAcceptedMimeTypes.value).toEqual([
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'video/mp4',
      ]);
    });
  });

  describe('allAcceptedInputString', () => {
    it('joins with commas', () => {
      const planConfig = createMockPlanConfig(sampleMediaConfig);
      const { allAcceptedInputString } = withProvide(() => useMediaCategories(), {
        planConfig,
      });
      expect(allAcceptedInputString.value).toBe(
        'image/jpeg,image/png,image/gif,application/pdf,video/mp4',
      );
    });
  });

  describe('maxFileSize', () => {
    it('defaults to 0', () => {
      const planConfig = createMockPlanConfig(null);
      const { maxFileSize } = withProvide(() => useMediaCategories(), {
        planConfig,
      });
      expect(maxFileSize.value).toBe(0);
    });

    it('reads from config', () => {
      const planConfig = createMockPlanConfig(sampleMediaConfig);
      const { maxFileSize } = withProvide(() => useMediaCategories(), {
        planConfig,
      });
      expect(maxFileSize.value).toBe(10485760);
    });
  });

  describe('availableCategories', () => {
    it('returns category keys', () => {
      const planConfig = createMockPlanConfig(sampleMediaConfig);
      const { availableCategories } = withProvide(() => useMediaCategories(), {
        planConfig,
      });
      expect(availableCategories.value).toEqual(['images', 'documents', 'videos']);
    });
  });

  describe('isAcceptedMimeType', () => {
    it('returns true for valid type', () => {
      const planConfig = createMockPlanConfig(sampleMediaConfig);
      const { isAcceptedMimeType } = withProvide(() => useMediaCategories(), {
        planConfig,
      });
      expect(isAcceptedMimeType('image/jpeg')).toBe(true);
      expect(isAcceptedMimeType('application/pdf')).toBe(true);
    });

    it('returns false for invalid type', () => {
      const planConfig = createMockPlanConfig(sampleMediaConfig);
      const { isAcceptedMimeType } = withProvide(() => useMediaCategories(), {
        planConfig,
      });
      expect(isAcceptedMimeType('text/plain')).toBe(false);
    });

    it('with filter categories checks only specified categories', () => {
      const planConfig = createMockPlanConfig(sampleMediaConfig);
      const { isAcceptedMimeType } = withProvide(() => useMediaCategories(), {
        planConfig,
      });
      expect(isAcceptedMimeType('image/jpeg', ['images'])).toBe(true);
      expect(isAcceptedMimeType('application/pdf', ['images'])).toBe(false);
      expect(isAcceptedMimeType('application/pdf', ['documents'])).toBe(true);
    });
  });

  describe('isImageMimeType', () => {
    it('checks images category only', () => {
      const planConfig = createMockPlanConfig(sampleMediaConfig);
      const { isImageMimeType } = withProvide(() => useMediaCategories(), {
        planConfig,
      });
      expect(isImageMimeType('image/jpeg')).toBe(true);
      expect(isImageMimeType('image/png')).toBe(true);
      expect(isImageMimeType('application/pdf')).toBe(false);
      expect(isImageMimeType('video/mp4')).toBe(false);
    });
  });

  describe('getCategoryForMimeType', () => {
    it('returns matching category', () => {
      const planConfig = createMockPlanConfig(sampleMediaConfig);
      const { getCategoryForMimeType } = withProvide(() => useMediaCategories(), {
        planConfig,
      });
      expect(getCategoryForMimeType('image/jpeg')).toBe('images');
      expect(getCategoryForMimeType('application/pdf')).toBe('documents');
      expect(getCategoryForMimeType('video/mp4')).toBe('videos');
    });

    it('returns null for unmatched', () => {
      const planConfig = createMockPlanConfig(sampleMediaConfig);
      const { getCategoryForMimeType } = withProvide(() => useMediaCategories(), {
        planConfig,
      });
      expect(getCategoryForMimeType('text/plain')).toBeNull();
    });
  });
});
