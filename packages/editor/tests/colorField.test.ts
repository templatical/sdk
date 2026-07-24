// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { CustomBlockColorField } from '@templatical/types';
import ColorField from '../src/components/toolbar/fields/ColorField.vue';
import { mountEditor } from './helpers/mount';
import { COLORS_KEY } from '../src/keys';

function field(
  overrides: Partial<CustomBlockColorField> = {},
): CustomBlockColorField {
  return {
    type: 'color',
    key: 'brandColor',
    label: 'Brand color',
    ...overrides,
  };
}

// The trigger swatch button carries the generic pick-color aria-label (stub
// translations stringify to their dot-path), which is unique within the field.
const TRIGGER = 'button[aria-label="colorPicker.pickColor"]';

function popoverPresetLabels(wrapper: ReturnType<typeof mountEditor>): string[] {
  // Color swatches only — exclude the leading "no colour" chip that the shared
  // ColorPicker renders in locked mode (it reuses `.tpl-color-swatch-empty`).
  return wrapper
    .findAll('.tpl-color-popover [role="radiogroup"] [role="radio"]')
    .filter((b) => !b.classes().includes('tpl-color-swatch-empty'))
    .map((b) => b.attributes('aria-label') ?? '');
}

/** An unlocked editor palette — the wheel and hex input are still offered. */
const editorPalette = {
  presets: ['#abcdef'],
  allowCustom: true,
  allowCustomIgnored: false,
  invalidPresets: [],
};

/** A locked editor palette — a field may narrow it, never unlock it. */
const lockedEditorPalette = { ...editorPalette, allowCustom: false };

async function openPicker(
  fieldConfig: CustomBlockColorField,
  provides?: Record<symbol, unknown>,
) {
  const wrapper = mountEditor(ColorField, {
    props: { field: fieldConfig, modelValue: '#000' },
    ...(provides ? { provides } : {}),
  });
  await wrapper.find(TRIGGER).trigger('click');
  return wrapper;
}

describe('ColorField presets (field narrows the editor palette)', () => {
  it('renders the field presets in place of the editor palette', async () => {
    const wrapper = await openPicker(field({ presets: ['#123456'] }), {
      [COLORS_KEY]: editorPalette,
    });

    expect(popoverPresetLabels(wrapper)).toEqual(['#123456']);
  });

  it('inherits the editor palette when the field sets no presets', async () => {
    const wrapper = await openPicker(field(), { [COLORS_KEY]: editorPalette });

    expect(popoverPresetLabels(wrapper)).toEqual(['#abcdef']);
    // Inheritance runs in both directions: the editor's free-form entry too.
    expect(wrapper.find('hex-color-picker').exists()).toBe(true);
  });

  it('inherits the editor palette for an explicitly empty presets list', async () => {
    // `[]` narrows nothing — it does NOT mean "no chips".
    const wrapper = await openPicker(field({ presets: [] }), {
      [COLORS_KEY]: editorPalette,
    });

    expect(popoverPresetLabels(wrapper)).toEqual(['#abcdef']);
  });

  it('inherits the editor palette when every field preset is invalid', async () => {
    const wrapper = await openPicker(field({ presets: ['nope', '#12'] }), {
      [COLORS_KEY]: editorPalette,
    });

    expect(popoverPresetLabels(wrapper)).toEqual(['#abcdef']);
  });

  it('renders only the valid subset when some field presets are invalid', async () => {
    const wrapper = await openPicker(
      field({ presets: ['#0b5cff', 'nope', '#abc'] }),
      { [COLORS_KEY]: editorPalette },
    );

    // The valid entries narrow the palette; the editor's `#abcdef` is dropped.
    expect(popoverPresetLabels(wrapper)).toEqual(['#0b5cff', '#abc']);
  });
});

describe('ColorField allowCustom (narrowing only)', () => {
  it('locks a field under an unlocked editor', async () => {
    const wrapper = await openPicker(
      field({ presets: ['#123456'], allowCustom: false }),
      { [COLORS_KEY]: editorPalette },
    );

    expect(wrapper.find('hex-color-picker').exists()).toBe(false);
    expect(popoverPresetLabels(wrapper)).toEqual(['#123456']);
  });

  it('inherits the lock when the field says nothing', async () => {
    const wrapper = await openPicker(field(), {
      [COLORS_KEY]: lockedEditorPalette,
    });

    expect(wrapper.find('hex-color-picker').exists()).toBe(false);
    expect(popoverPresetLabels(wrapper)).toEqual(['#abcdef']);
  });

  it('cannot unlock a locked editor with allowCustom: true', async () => {
    const wrapper = await openPicker(field({ allowCustom: true }), {
      [COLORS_KEY]: lockedEditorPalette,
    });

    // The request is ignored: still no wheel, still the editor's palette.
    expect(wrapper.find('hex-color-picker').exists()).toBe(false);
    expect(popoverPresetLabels(wrapper)).toEqual(['#abcdef']);
  });

  it('narrows a locked editor to the field presets, staying locked', async () => {
    const wrapper = await openPicker(
      field({ presets: ['#123456'], allowCustom: true }),
      { [COLORS_KEY]: lockedEditorPalette },
    );

    expect(wrapper.find('hex-color-picker').exists()).toBe(false);
    expect(popoverPresetLabels(wrapper)).toEqual(['#123456']);
  });
});

describe('ColorField with no editor colors config', () => {
  it('validates, locks, and renders the leading none chip', async () => {
    // No COLORS_KEY provided → the inject default (no presets, custom allowed).
    const wrapper = await openPicker(
      field({ presets: ['#111111', 'nope', '#ffffff'], allowCustom: false }),
    );

    const radios = wrapper.findAll(
      '.tpl-color-popover [role="radiogroup"] [role="radio"]',
    );
    // Leading none chip + the two VALID field presets ('nope' was dropped).
    expect(radios).toHaveLength(3);
    expect(radios[0].classes()).toContain('tpl-color-swatch-empty');
    expect(radios[0].attributes('aria-label')).toBe('colorPicker.clear');
    expect(popoverPresetLabels(wrapper)).toEqual(['#111111', '#ffffff']);
    expect(wrapper.find('hex-color-picker').exists()).toBe(false);
  });

  it('keeps the wheel when a lock would leave no palette at all', async () => {
    // Nothing to pick from: `ColorPicker`'s belt-and-braces guard keeps the
    // free-form controls so a colour can still be set.
    const wrapper = await openPicker(field({ allowCustom: false }));

    expect(wrapper.find('hex-color-picker').exists()).toBe(true);
    expect(popoverPresetLabels(wrapper)).toEqual([]);
  });
});

describe('ColorField is presentational — it never warns', () => {
  // The field config is audited once per block definition at registration time
  // (see useEditorCore's "custom-block colour fields" tests). This component
  // remounts on every block selection and renders once per repeater item, so a
  // warning from here would repeat forever.
  it.each([
    ['invalid presets', field({ presets: ['nope'] })],
    ['an empty presets list', field({ presets: [] })],
    ['an ignored allowCustom: true', field({ allowCustom: true })],
    [
      'an off-palette default',
      field({ presets: ['#123456'], allowCustom: false, default: '#7c3aed' }),
    ],
  ])('stays silent on %s, across repeated mounts', (_label, fieldConfig) => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (let i = 0; i < 3; i++) {
      mountEditor(ColorField, {
        props: { field: fieldConfig, modelValue: '#000' },
        provides: { [COLORS_KEY]: lockedEditorPalette },
      });
    }

    // Scoped to the logger tag — the unit env also emits a benign `[Vue warn]`
    // for the unregistered `hex-color-picker` custom element, which is not ours.
    expect(warnSpy).not.toHaveBeenCalledWith('[Templatical]', expect.anything());
    warnSpy.mockRestore();
  });
});
