// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import './dom-stubs';

import { describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, type InjectionKey } from 'vue';
import type { MergeTag } from '@templatical/types';
import { SYNTAX_PRESETS } from '@templatical/types';
import { useMergeTag } from '../src/composables/useMergeTag';
import { useMergeTagPicker } from '../src/composables/useMergeTagPicker';
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  MERGE_TAG_AUTOCOMPLETE_KEY,
  MERGE_TAG_PICKER_KEY,
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
  describe('canRequestMergeTag', () => {
    it('is false when neither tags nor onRequest is provided', () => {
      const { canRequestMergeTag } = withProvide(() => useMergeTag());
      expect(canRequestMergeTag).toBe(false);
    });

    it('is true when only static tags are provided (built-in picker handles the click)', () => {
      const { canRequestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: sampleTags,
        [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
      });
      expect(canRequestMergeTag).toBe(true);
    });

    it('is true when only onRequest callback is provided (empty tags)', () => {
      const { canRequestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: [],
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: vi.fn(),
      });
      expect(canRequestMergeTag).toBe(true);
    });

    it('is true when both static tags and callback are provided', () => {
      const { canRequestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: sampleTags,
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: vi.fn(),
      });
      expect(canRequestMergeTag).toBe(true);
    });

    it('is false when tags is provided but empty (no callback either)', () => {
      const { canRequestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: [],
      });
      expect(canRequestMergeTag).toBe(false);
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

    it('opens the built-in picker when only static tags are set', async () => {
      const picker = useMergeTagPicker();
      const openSpy = vi.spyOn(picker, 'open');

      const { requestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: sampleTags,
        [MERGE_TAG_PICKER_KEY as symbol]: picker,
      });

      const promise = requestMergeTag();
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy.mock.calls[0]![0]).toEqual(sampleTags);

      picker.resolve(sampleTags[0]!);
      const result = await promise;
      expect(result).toEqual(sampleTags[0]);
    });

    it('returns null from picker fall-through when user cancels', async () => {
      const picker = useMergeTagPicker();

      const { requestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: sampleTags,
        [MERGE_TAG_PICKER_KEY as symbol]: picker,
      });

      const promise = requestMergeTag();
      picker.resolve(null);
      expect(await promise).toBeNull();
    });

    it('invokes onRequest (NOT the picker) when both onRequest and tags are configured — precedence', async () => {
      const picker = useMergeTagPicker();
      const openSpy = vi.spyOn(picker, 'open');
      const callback = vi.fn().mockResolvedValue(sampleTags[1]);

      const { requestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: sampleTags,
        [MERGE_TAG_PICKER_KEY as symbol]: picker,
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: callback,
      });

      const result = await requestMergeTag();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(openSpy).not.toHaveBeenCalled();
      expect(result).toEqual(sampleTags[1]);
    });

    it('does not pass tags as an argument to onRequest (callback contract unchanged)', async () => {
      const callback = vi.fn().mockResolvedValue(null);

      const { requestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: sampleTags,
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: callback,
      });

      await requestMergeTag();
      expect(callback).toHaveBeenCalledWith();
      expect(callback.mock.calls[0]).toEqual([]);
    });

    it('isRequesting flips to true during picker fall-through and back to false after', async () => {
      const picker = useMergeTagPicker();

      const { requestMergeTag, isRequesting } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: sampleTags,
        [MERGE_TAG_PICKER_KEY as symbol]: picker,
      });

      expect(isRequesting.value).toBe(false);
      const promise = requestMergeTag();
      expect(isRequesting.value).toBe(true);
      picker.resolve(null);
      await promise;
      expect(isRequesting.value).toBe(false);
    });

    it('concurrent requestMergeTag through the picker: first resolves null, second wins', async () => {
      const picker = useMergeTagPicker();

      const { requestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: sampleTags,
        [MERGE_TAG_PICKER_KEY as symbol]: picker,
      });

      const first = requestMergeTag();
      const second = requestMergeTag();
      expect(await first).toBeNull();
      picker.resolve(sampleTags[2]!);
      expect(await second).toEqual(sampleTags[2]);
    });

    it('returns null when tags is non-empty but picker is not provided (headless caller)', async () => {
      const { requestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: sampleTags,
        // No MERGE_TAG_PICKER_KEY provided.
      });
      expect(await requestMergeTag()).toBeNull();
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
