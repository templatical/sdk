// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import './dom-stubs';

import { describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h } from 'vue';
import type { MergeTag } from '@templatical/types';
import { SYNTAX_PRESETS } from '@templatical/types';
import { useMergeTag } from '../src/composables/useMergeTag';

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

const sampleTags: MergeTag[] = [
  { label: 'First Name', value: '{{first_name}}' },
  { label: 'Last Name', value: '{{last_name}}' },
  { label: 'Email', value: '{{email}}' },
];

describe('useMergeTag', () => {
  describe('isEnabled', () => {
    it('is false when no merge tags and no callback', () => {
      const { isEnabled } = withProvide(() => useMergeTag());
      expect(isEnabled).toBe(false);
    });

    it('is true when merge tags are provided', () => {
      const { isEnabled } = withProvide(() => useMergeTag(), {
        mergeTags: sampleTags,
        mergeTagSyntax: SYNTAX_PRESETS.liquid,
      });
      expect(isEnabled).toBe(true);
    });

    it('is true when callback is provided even with empty merge tags', () => {
      const { isEnabled } = withProvide(() => useMergeTag(), {
        mergeTags: [],
        onRequestMergeTag: vi.fn(),
      });
      expect(isEnabled).toBe(true);
    });
  });

  describe('isMergeTagValue', () => {
    it('delegates to @templatical/types check', () => {
      const { isMergeTagValue } = withProvide(() => useMergeTag(), {
        mergeTagSyntax: SYNTAX_PRESETS.liquid,
      });

      expect(isMergeTagValue('{{first_name}}')).toBe(true);
      expect(isMergeTagValue('plain text')).toBe(false);
      expect(isMergeTagValue('{{nested.value}}')).toBe(true);
    });
  });

  describe('getMergeTagLabel', () => {
    it('resolves label from merge tags array', () => {
      const { getMergeTagLabel } = withProvide(() => useMergeTag(), {
        mergeTags: sampleTags,
      });

      expect(getMergeTagLabel('{{first_name}}')).toBe('First Name');
      expect(getMergeTagLabel('{{email}}')).toBe('Email');
    });

    it('returns value itself when no matching tag found', () => {
      const { getMergeTagLabel } = withProvide(() => useMergeTag(), {
        mergeTags: sampleTags,
      });

      expect(getMergeTagLabel('{{unknown}}')).toBe('{{unknown}}');
    });
  });

  describe('requestMergeTag', () => {
    it('returns null when no callback', async () => {
      const { requestMergeTag } = withProvide(() => useMergeTag());
      const result = await requestMergeTag();
      expect(result).toBeNull();
    });

    it('calls callback and returns result', async () => {
      const tag: MergeTag = { label: 'First Name', value: '{{first_name}}' };
      const callback = vi.fn().mockResolvedValue(tag);

      const { requestMergeTag } = withProvide(() => useMergeTag(), {
        onRequestMergeTag: callback,
      });

      const result = await requestMergeTag();
      expect(callback).toHaveBeenCalled();
      expect(result).toEqual(tag);
    });

    it('manages isRequesting state', async () => {
      let resolveCallback: (value: MergeTag | null) => void;
      const callback = vi.fn(
        () => new Promise<MergeTag | null>((resolve) => {
          resolveCallback = resolve;
        }),
      );

      const { requestMergeTag, isRequesting } = withProvide(() => useMergeTag(), {
        onRequestMergeTag: callback,
      });

      expect(isRequesting.value).toBe(false);

      const promise = requestMergeTag();
      expect(isRequesting.value).toBe(true);

      resolveCallback!(null);
      await promise;
      expect(isRequesting.value).toBe(false);
    });
  });
});
