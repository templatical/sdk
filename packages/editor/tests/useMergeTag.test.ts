// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import './dom-stubs';

import { describe, expect, it, vi } from 'vitest';
import { shallowRef, createApp, defineComponent, h, ref, type InjectionKey } from 'vue';
import type { MergeTag } from '@templatical/types';
import { SYNTAX_PRESETS } from '@templatical/types';
import { useMergeTag } from '../src/composables/useMergeTag';
import { useMergeTagPicker } from '../src/composables/useMergeTagPicker';
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  MERGE_TAG_AUTOCOMPLETE_KEY,
  MERGE_TAG_PICKER_KEY,
  MERGE_TAG_SHOW_RAW_VALUE_KEY,
  MERGE_TAG_REQUESTING_KEY,
  ON_REQUEST_MERGE_TAG_KEY,
  TRANSLATIONS_KEY,
} from '../src/keys';
import en from '../src/i18n/locales/en';

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
  // Every host that opens the picker has to be visible to the one guard that
  // keeps a rich-text block from being torn out of edit mode mid-insert
  // (useRichTextEditor's handleClickOutside). A per-call ref makes that guard
  // blind to any host but the one that happens to own it.
  describe('isRequesting sharing', () => {
    it('shares one ref across instances under the same editor', async () => {
      const shared = ref(false);
      const [a, b] = withProvide(
        () => [useMergeTag(), useMergeTag()] as const,
        {
          [MERGE_TAGS_KEY]: shallowRef(sampleTags),
          [MERGE_TAG_REQUESTING_KEY]: shared,
          [MERGE_TAG_PICKER_KEY]: useMergeTagPicker(),
        },
      );

      expect(a.isRequesting).toBe(b.isRequesting);
      expect(a.isRequesting).toBe(shared);
    });

    it('flags the shared ref while one instance awaits the picker', async () => {
      const shared = ref(false);
      const picker = useMergeTagPicker();
      const [a, b] = withProvide(
        () => [useMergeTag(), useMergeTag()] as const,
        {
          [MERGE_TAGS_KEY]: shallowRef(sampleTags),
          [MERGE_TAG_REQUESTING_KEY]: shared,
          [MERGE_TAG_PICKER_KEY]: picker,
        },
      );

      const pending = a.requestMergeTag();
      expect(b.isRequesting.value).toBe(true);

      picker.resolve(sampleTags[0]);
      await pending;
      expect(b.isRequesting.value).toBe(false);
    });

    it('falls back to a private ref when nothing is provided', () => {
      const [a, b] = withProvide(
        () => [useMergeTag(), useMergeTag()] as const,
        { [MERGE_TAGS_KEY]: shallowRef(sampleTags) },
      );

      expect(a.isRequesting).not.toBe(b.isRequesting);
      expect(a.isRequesting.value).toBe(false);
    });
  });

  describe('canRequestMergeTag', () => {
    it('is false when neither tags nor onRequest is provided', () => {
      const { canRequestMergeTag } = withProvide(() => useMergeTag());
      expect(canRequestMergeTag.value).toBe(false);
    });

    it('is true when only static tags are provided (built-in picker handles the click)', () => {
      const { canRequestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
        [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
      });
      expect(canRequestMergeTag.value).toBe(true);
    });

    it('is true when only onRequest callback is provided (empty tags)', () => {
      const { canRequestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef([]),
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: vi.fn(),
      });
      expect(canRequestMergeTag.value).toBe(true);
    });

    it('is true when both static tags and callback are provided', () => {
      const { canRequestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: vi.fn(),
      });
      expect(canRequestMergeTag.value).toBe(true);
    });

    it('is false when tags is provided but empty (no callback either)', () => {
      const { canRequestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef([]),
      });
      expect(canRequestMergeTag.value).toBe(false);
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
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
      });

      expect(getMergeTagLabel('{{first_name}}')).toBe('First Name');
      expect(getMergeTagLabel('{{email}}')).toBe('Email');
    });

    it('returns value itself when no matching tag found', () => {
      const { getMergeTagLabel } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
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
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
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
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
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
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
        [MERGE_TAG_PICKER_KEY as symbol]: picker,
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: callback,
      });

      const result = await requestMergeTag();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(openSpy).not.toHaveBeenCalled();
      expect(result).toEqual(sampleTags[1]);
    });

    it('passes the request context to onRequest, never the tags array', async () => {
      const callback = vi.fn().mockResolvedValue(null);

      const { requestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: callback,
      });

      await requestMergeTag({ reason: 'insert' });
      expect(callback.mock.calls[0]).toEqual([{ reason: 'insert' }]);
    });

    it('isRequesting flips to true during picker fall-through and back to false after', async () => {
      const picker = useMergeTagPicker();

      const { requestMergeTag, isRequesting } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
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
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
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
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
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
        [MERGE_TAGS_KEY as symbol]: shallowRef([]),
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

  // Issue #733.
  describe('findMergeTag', () => {
    it('returns the configured tag for an exact value match', () => {
      const { findMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
      });
      expect(findMergeTag('{{last_name}}')).toEqual({
        label: 'Last Name',
        value: '{{last_name}}',
      });
    });

    // Unlike getMergeTagLabel, which falls back to the raw token — callers
    // deciding whether a chip can be re-picked must tell absence apart.
    it('returns undefined rather than falling back to the token', () => {
      const { findMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
      });
      expect(findMergeTag('{{unknown}}')).toBeUndefined();
    });
  });

  // The single home for "chooser or raw text?". The canvas chip and a sidebar
  // field chip must not be able to answer it differently.
  describe('canRepickMergeTag', () => {
    it('is true for a configured tag', () => {
      const { canRepickMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
      });
      expect(canRepickMergeTag('{{email}}')).toBe(true);
    });

    it('is false for an unknown token when only tags are configured', () => {
      const { canRepickMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
      });
      expect(canRepickMergeTag('{{unknown}}')).toBe(false);
    });

    // The trap: a consumer who drives insertion entirely through onRequest and
    // leaves `tags` empty would otherwise get raw editing on every chip.
    it('is true for an unknown token when the consumer owns the chooser', () => {
      const { canRepickMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef([]),
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: vi.fn(),
      });
      expect(canRepickMergeTag('{{unknown}}')).toBe(true);
    });

    it('is false with nothing configured at all', () => {
      const { canRepickMergeTag } = withProvide(() => useMergeTag());
      expect(canRepickMergeTag('{{anything}}')).toBe(false);
    });
  });

  // Issue #733: hiding raw tokens has to cover what a tag *renders as*, not
  // only its tooltip. `getMergeTagLabel` falls back to the token itself, which
  // put an opaque identifier on screen — and, through the chip's accessible
  // name, into a screen reader.
  describe('getMergeTagDisplayLabel', () => {
    it('uses the configured label for a declared tag', () => {
      const { getMergeTagDisplayLabel } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
      });
      expect(getMergeTagDisplayLabel('{{email}}')).toBe('Email');
    });

    it('prefers the configured label over a stale stored one', () => {
      const { getMergeTagDisplayLabel } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
      });
      expect(getMergeTagDisplayLabel('{{email}}', 'Old Name')).toBe('Email');
    });

    // #737: a consumer whose picker MINTS a tag on insert or edit returns a
    // MergeTag that is in no `tags` array. Its label is written onto the node,
    // so the chain must reach it before falling back to the token — otherwise
    // the chip renders a raw identifier the instant the author picks a field.
    it('uses the stored label for a minted tag, even when raw tokens are shown', () => {
      const { getMergeTagDisplayLabel } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
      });
      expect(getMergeTagDisplayLabel('{{minted-uuid}}', 'Loyalty Tier')).toBe(
        'Loyalty Tier',
      );
    });

    it('shows an undeclared token as itself by default', () => {
      // The editor makes a tag out of anything syntax-shaped, so for a
      // readable syntax the token is the only thing identifying it.
      const { getMergeTagDisplayLabel } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
      });
      expect(getMergeTagDisplayLabel('{{unknown}}')).toBe('{{unknown}}');
    });

    it('falls back to the stored label when raw tokens are hidden', () => {
      const { getMergeTagDisplayLabel } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef([]),
        [MERGE_TAG_SHOW_RAW_VALUE_KEY as symbol]: false,
      });
      expect(getMergeTagDisplayLabel('{{opaque}}', 'First Name')).toBe(
        'First Name',
      );
    });

    it('falls back to a neutral placeholder with no stored label', () => {
      const { getMergeTagDisplayLabel } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef([]),
        [MERGE_TAG_SHOW_RAW_VALUE_KEY as symbol]: false,
        [TRANSLATIONS_KEY as symbol]: en,
      });
      expect(getMergeTagDisplayLabel('{{opaque}}')).toBe('Merge tag');
    });

    it('treats a blank stored label as absent', () => {
      const { getMergeTagDisplayLabel } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef([]),
        [MERGE_TAG_SHOW_RAW_VALUE_KEY as symbol]: false,
        [TRANSLATIONS_KEY as symbol]: en,
      });
      expect(getMergeTagDisplayLabel('{{opaque}}', '   ')).toBe('Merge tag');
    });

    it('never returns the token when raw tokens are hidden', () => {
      const { getMergeTagDisplayLabel } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef([]),
        [MERGE_TAG_SHOW_RAW_VALUE_KEY as symbol]: false,
        [TRANSLATIONS_KEY as symbol]: en,
      });
      for (const stored of [undefined, '', 'Given Name']) {
        expect(getMergeTagDisplayLabel('{{opaque}}', stored)).not.toContain(
          'opaque',
        );
      }
    });

    it('works headlessly, with no translations provided', () => {
      const { getMergeTagDisplayLabel } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef([]),
        [MERGE_TAG_SHOW_RAW_VALUE_KEY as symbol]: false,
      });
      expect(getMergeTagDisplayLabel('{{opaque}}')).toBe('Merge tag');
    });
  });

  describe('showRawValue', () => {
    it('defaults to true', () => {
      const { showRawValue } = withProvide(() => useMergeTag());
      expect(showRawValue).toBe(true);
    });

    it('reflects a consumer opt-out', () => {
      const { showRawValue } = withProvide(() => useMergeTag(), {
        [MERGE_TAG_SHOW_RAW_VALUE_KEY as symbol]: false,
      });
      expect(showRawValue).toBe(false);
    });
  });

  describe('requestMergeTag context', () => {
    it('forwards the context to the consumer chooser', async () => {
      const onRequest = vi.fn().mockResolvedValue(null);
      const { requestMergeTag } = withProvide(() => useMergeTag(), {
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: onRequest,
      });

      await requestMergeTag({ reason: 'edit', current: sampleTags[0] });

      expect(onRequest).toHaveBeenCalledWith({
        reason: 'edit',
        current: sampleTags[0],
      });
    });

    it('calls a zero-argument chooser with undefined on a plain insert', async () => {
      const onRequest = vi.fn().mockResolvedValue(null);
      const { requestMergeTag } = withProvide(() => useMergeTag(), {
        [ON_REQUEST_MERGE_TAG_KEY as symbol]: onRequest,
      });

      await requestMergeTag();

      expect(onRequest).toHaveBeenCalledWith(undefined);
    });

    it('hands the built-in picker the tag to preselect', async () => {
      const open = vi.fn().mockResolvedValue(null);
      const { requestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
        [MERGE_TAG_PICKER_KEY as symbol]: { open },
      });

      await requestMergeTag({ reason: 'edit', current: sampleTags[2] });

      expect(open).toHaveBeenCalledWith(sampleTags, {
        current: sampleTags[2],
      });
    });

    it('opens the picker with nothing preselected on an insert', async () => {
      const open = vi.fn().mockResolvedValue(null);
      const { requestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY as symbol]: shallowRef(sampleTags),
        [MERGE_TAG_PICKER_KEY as symbol]: { open },
      });

      await requestMergeTag({ reason: 'insert' });

      expect(open).toHaveBeenCalledWith(sampleTags, { current: undefined });
    });
  });
});
