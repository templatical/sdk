// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import './dom-stubs';

import { describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, type InjectionKey } from 'vue';
import type { MergeTag } from '@templatical/types';
import { SYNTAX_PRESETS } from '@templatical/types';
import { useMergeTag } from '../src/composables/useMergeTag';
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  MERGE_TAG_AUTOCOMPLETE_KEY,
  ON_REQUEST_MERGE_TAG_KEY,
} from '../src/keys';

function withProvide<T>(
  setup: () => T,
  provides: Record<string | symbol, unknown> = {},
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
  for (const sym of Object.getOwnPropertySymbols(provides)) {
    app.provide(sym as InjectionKey<unknown>, provides[sym]);
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
        [MERGE_TAGS_KEY as symbol]: sampleTags,
        [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
      });
      expect(isEnabled).toBe(true);
    });

    it('is true when callback is provided even with empty merge tags', () => {
      const { isEnabled } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: [],
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: vi.fn(),
      });
      expect(isEnabled).toBe(true);
    });
  });

  describe('isMergeTagValue', () => {
    it('delegates to @templatical/types check', () => {
      const { isMergeTagValue } = withProvide(() => useMergeTag(), {
        [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
      });

      expect(isMergeTagValue('{{first_name}}')).toBe(true);
      expect(isMergeTagValue('plain text')).toBe(false);
      expect(isMergeTagValue('{{nested.value}}')).toBe(true);
    });
  });

  describe('getMergeTagLabel', () => {
    it('resolves label from merge tags array', () => {
      const { getMergeTagLabel } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: sampleTags,
      });

      expect(getMergeTagLabel('{{first_name}}')).toBe('First Name');
      expect(getMergeTagLabel('{{email}}')).toBe('Email');
    });

    it('returns value itself when no matching tag found', () => {
      const { getMergeTagLabel } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: sampleTags,
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
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: callback,
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
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: callback,
      });

      expect(isRequesting.value).toBe(false);

      const promise = requestMergeTag();
      expect(isRequesting.value).toBe(true);

      resolveCallback!(null);
      await promise;
      expect(isRequesting.value).toBe(false);
    });

    it('resets isRequesting when callback throws', async () => {
      const callback = vi.fn().mockRejectedValue(new Error('User cancelled'));

      const { requestMergeTag, isRequesting } = withProvide(() => useMergeTag(), {
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: callback,
      });

      await expect(requestMergeTag()).rejects.toThrow('User cancelled');
      expect(isRequesting.value).toBe(false);
    });

    it('returns null when callback returns null', async () => {
      const callback = vi.fn().mockResolvedValue(null);

      const { requestMergeTag } = withProvide(() => useMergeTag(), {
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: callback,
      });

      const result = await requestMergeTag();
      expect(result).toBeNull();
    });
  });

  describe('isMergeTagValue with different syntax presets', () => {
    it('works with handlebars syntax', () => {
      const { isMergeTagValue } = withProvide(() => useMergeTag(), {
        [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.handlebars,
      });

      expect(isMergeTagValue('{{first_name}}')).toBe(true);
      expect(isMergeTagValue('plain text')).toBe(false);
    });

    it('works with mailchimp syntax', () => {
      const { isMergeTagValue } = withProvide(() => useMergeTag(), {
        [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.mailchimp,
      });

      expect(isMergeTagValue('*|FNAME|*')).toBe(true);
      expect(isMergeTagValue('{{first_name}}')).toBe(false);
    });

    it('works with ampscript syntax', () => {
      const { isMergeTagValue } = withProvide(() => useMergeTag(), {
        [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.ampscript,
      });

      expect(isMergeTagValue('%%=v(@first_name)=%%')).toBe(true);
      expect(isMergeTagValue('{{first_name}}')).toBe(false);
    });
  });

  describe('getMergeTagLabel with different tags', () => {
    it('returns value for empty merge tags array', () => {
      const { getMergeTagLabel } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: [],
      });

      expect(getMergeTagLabel('{{first_name}}')).toBe('{{first_name}}');
    });
  });

  describe('syntax default', () => {
    it('defaults to liquid syntax when not provided', () => {
      const { syntax } = withProvide(() => useMergeTag());
      expect(syntax).toEqual(SYNTAX_PRESETS.liquid);
    });
  });

  describe('autocomplete flag', () => {
    it('defaults to true when not provided', () => {
      const { autocomplete } = withProvide(() => useMergeTag());
      expect(autocomplete).toBe(true);
    });

    it('reflects provided true value', () => {
      const { autocomplete } = withProvide(() => useMergeTag(), {
        [MERGE_TAG_AUTOCOMPLETE_KEY as symbol]: true,
      });
      expect(autocomplete).toBe(true);
    });

    it('reflects provided false value (consumer disabled)', () => {
      const { autocomplete } = withProvide(() => useMergeTag(), {
        [MERGE_TAG_AUTOCOMPLETE_KEY as symbol]: false,
      });
      expect(autocomplete).toBe(false);
    });
  });
});
