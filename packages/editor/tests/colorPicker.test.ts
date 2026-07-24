// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import ColorPicker from '../src/components/ColorPicker.vue';
import { mountEditor } from './helpers/mount';
import { COLORS_KEY } from '../src/keys';

describe('ColorPicker', () => {
  it('renders the swatch with modelValue as background color', () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#ff0000' },
    });
    const swatchInner = wrapper.find('button span');
    expect(swatchInner.attributes('style')).toContain(
      'background-color: #ff0000',
    );
  });

  it('reflects modelValue in the hex text input', () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#abcdef' },
    });
    const input = wrapper.find('input[type="text"]');
    expect(input.element.getAttribute('value')).toBe('#abcdef');
  });

  it('emits update:modelValue when user types a new hex value', async () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#000000' },
    });
    const input = wrapper.find('input[type="text"]');
    (input.element as HTMLInputElement).value = '#123456';
    await input.trigger('input');

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toHaveLength(1);
    expect(emitted![0]).toEqual(['#123456']);
  });

  it('anchors the popover with tpl:absolute (transform-proof), not tpl:fixed', async () => {
    // A `fixed` popover resolves against a transformed ancestor of the editor
    // and lands off-target; `absolute` inside the (positioned) popover root,
    // fed root-local coords, does not. See usePopoverPosition.
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#000' },
    });
    await wrapper.find('button').trigger('click');
    const popover = wrapper.find('.tpl-color-popover');
    expect(popover.exists()).toBe(true);
    expect(popover.classes()).toContain('tpl:absolute');
    expect(popover.classes()).not.toContain('tpl:fixed');
  });

  it('toggles popover visibility when the swatch is clicked', async () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#000' },
    });
    expect(wrapper.find('hex-color-picker').exists()).toBe(false);

    await wrapper.find('button').trigger('click');
    expect(wrapper.find('hex-color-picker').exists()).toBe(true);

    await wrapper.find('button').trigger('click');
    expect(wrapper.find('hex-color-picker').exists()).toBe(false);
  });

  it('hides the hex text input when swatchOnly is true', () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#000', swatchOnly: true },
    });
    expect(wrapper.find('input[type="text"]').exists()).toBe(false);
  });

  it('disables the swatch button and input when disabled=true', () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#000', disabled: true },
    });
    expect(wrapper.find('button').attributes('disabled')).toBeDefined();
    expect(wrapper.find('input[type="text"]').attributes('disabled')).toBeDefined();
  });

  it('does not open popover when swatch clicked while disabled', async () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#000', disabled: true },
    });
    await wrapper.find('button').trigger('click');
    expect(wrapper.find('hex-color-picker').exists()).toBe(false);
  });

  it('shows the unset (no-color) swatch and empty input when modelValue is empty', () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '' },
    });
    const swatchInner = wrapper.find('button span');
    // No real color is painted: the swatch wears the 'no color' slash class
    // instead of a fake #ffffff, and carries no inline background.
    expect(swatchInner.classes()).toContain('tpl-color-swatch-empty');
    expect(swatchInner.attributes('style')).toBeFalsy();

    const input = wrapper.find('input[type="text"]');
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  it('does not wear the no-color slash class when a color is set', () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#ff0000' },
    });
    expect(wrapper.find('button span').classes()).not.toContain(
      'tpl-color-swatch-empty',
    );
  });

  it('hides the clear button when no color is set', () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '' },
    });
    // Only the swatch button is present.
    expect(wrapper.findAll('button')).toHaveLength(1);
  });

  it('renders a clear button when a color is set and emits empty on click', async () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#ff0000' },
    });
    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(2); // swatch + clear
    await buttons[1].trigger('click');
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toHaveLength(1);
    expect(emitted![0]).toEqual(['']);
  });

  it('commits the seed on pointerup when unset and the picker fired no change (issue #282)', async () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '', seedColor: '#ffffff' },
    });
    await wrapper.find('button').trigger('click'); // open the popover
    const picker = wrapper.find('hex-color-picker');
    await picker.trigger('pointerdown');
    await picker.trigger('pointerup');
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toHaveLength(1);
    expect(emitted![0]).toEqual(['#ffffff']);
  });

  it('emits only the picked color when the picker fires a real change', async () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '', seedColor: '#ffffff' },
    });
    await wrapper.find('button').trigger('click');
    const picker = wrapper.find('hex-color-picker');
    await picker.trigger('pointerdown');
    picker.element.dispatchEvent(
      new CustomEvent('color-changed', { detail: { value: '#3366cc' } }),
    );
    await picker.trigger('pointerup');
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toHaveLength(1);
    expect(emitted![0]).toEqual(['#3366cc']);
  });

  it('renders the swatch at 32px for size="sm" and 40px by default', () => {
    const sm = mountEditor(ColorPicker, {
      props: { modelValue: '#000', size: 'sm' },
    });
    expect(sm.find('button').attributes('class')).toContain('tpl:size-8');
    expect(sm.find('button').attributes('class')).not.toContain('tpl:size-10');

    const md = mountEditor(ColorPicker, { props: { modelValue: '#000' } });
    expect(md.find('button').attributes('class')).toContain('tpl:size-10');
  });

  it('uses ariaLabel for the swatch aria-label and hover title', () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#000', ariaLabel: 'Text color' },
    });
    const swatch = wrapper.find('button');
    expect(swatch.attributes('aria-label')).toBe('Text color');
    expect(swatch.attributes('title')).toBe('Text color');
  });

  it('falls back to the generic label and no title when ariaLabel is unset', () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#000' },
    });
    const swatch = wrapper.find('button');
    // Stub translations stringify to their dot-path, so the generic fallback
    // surfaces as the key itself — proving aria-label took the
    // `ariaLabel || t.colorPicker.pickColor` branch rather than staying empty.
    expect(swatch.attributes('aria-label')).toBe('colorPicker.pickColor');
    expect(swatch.attributes('title')).toBeUndefined();
  });

  it('shows the manual hex field in the swatch-only popover, set or unset', async () => {
    const set = mountEditor(ColorPicker, {
      props: { modelValue: '#ff0000', swatchOnly: true },
    });
    await set.find('button').trigger('click'); // open the popover
    const setInput = set.find('.tpl-color-popover input[type="text"]');
    expect(setInput.exists()).toBe(true);
    expect((setInput.element as HTMLInputElement).value).toBe('#ff0000');

    const unset = mountEditor(ColorPicker, {
      props: { modelValue: '', swatchOnly: true },
    });
    await unset.find('button').trigger('click');
    const unsetInput = unset.find('.tpl-color-popover input[type="text"]');
    // Shown even when unset so a first color can be typed.
    expect(unsetInput.exists()).toBe(true);
    expect((unsetInput.element as HTMLInputElement).value).toBe('');
  });

  it('commits the popover hex on change, not on input (avoids the focus fight)', async () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '', swatchOnly: true },
    });
    await wrapper.find('button').trigger('click');
    const input = wrapper.find('.tpl-color-popover input[type="text"]');
    (input.element as HTMLInputElement).value = '#123456';

    await input.trigger('input');
    // Live typing must NOT apply — every emit would refocus the editor.
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();

    await input.trigger('change');
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toHaveLength(1);
    expect(emitted![0]).toEqual(['#123456']);
  });

  it('clears via the popover field × when set, and hides the × when unset', async () => {
    const set = mountEditor(ColorPicker, {
      props: { modelValue: '#ff0000', swatchOnly: true },
    });
    await set.find('button').trigger('click');
    const clearBtn = set.find('.tpl-color-popover button');
    expect(clearBtn.exists()).toBe(true);
    await clearBtn.trigger('click');
    const emitted = set.emitted('update:modelValue');
    expect(emitted).toHaveLength(1);
    expect(emitted![0]).toEqual(['']);
    // Clearing leaves the popover open (the field stays for a re-pick).
    expect(set.find('hex-color-picker').exists()).toBe(true);

    const unset = mountEditor(ColorPicker, {
      props: { modelValue: '', swatchOnly: true },
    });
    await unset.find('button').trigger('click');
    expect(unset.find('.tpl-color-popover button').exists()).toBe(false);
  });

  it('keeps the popover wheel-only in full mode (field + × live beside the swatch)', async () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#ff0000' }, // swatchOnly defaults to false
    });
    await wrapper.find('button').trigger('click'); // open popover via swatch
    expect(wrapper.find('.tpl-color-popover hex-color-picker').exists()).toBe(
      true,
    );
    expect(
      wrapper.find('.tpl-color-popover input[type="text"]').exists(),
    ).toBe(false);
    expect(wrapper.find('.tpl-color-popover button').exists()).toBe(false);
  });

  it('normalizes an rgb modelValue to hex in the swatch, field, and wheel seed', async () => {
    // A stored color read back from the DOM (e.g. TipTap textStyle) can be rgb.
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: 'rgb(19, 100, 214)', swatchOnly: true },
    });
    // Swatch paints the hex form.
    expect(wrapper.find('button span').attributes('style')).toContain(
      'background-color: #1364d6',
    );

    await wrapper.find('button').trigger('click'); // open the popover
    // The hex field shows hex, not the raw rgb.
    const input = wrapper.find('.tpl-color-popover input[type="text"]');
    expect((input.element as HTMLInputElement).value).toBe('#1364d6');
    // The wheel (hex-only) is seeded with hex — otherwise it can't parse it.
    const wheel = wrapper.find('hex-color-picker');
    const seedColor =
      wheel.attributes('color') ?? (wheel.element as { color?: string }).color;
    expect(seedColor).toBe('#1364d6');
  });

  it('normalizes rgb to hex in the full-mode field too', () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: 'rgb(255, 102, 0)' },
    });
    const input = wrapper.find('input[type="text"]');
    expect((input.element as HTMLInputElement).value).toBe('#ff6600');
  });

  describe('presets', () => {
    it('renders a preset grid in the popover from the presets prop', async () => {
      const wrapper = mountEditor(ColorPicker, {
        props: { modelValue: '#000', presets: ['#ff0000', '#00ff00'] },
      });
      await wrapper.find('button').trigger('click'); // open the popover

      const group = wrapper.find('.tpl-color-popover [role="radiogroup"]');
      expect(group.exists()).toBe(true);
      const presetButtons = group.findAll('button');
      expect(presetButtons.map((b) => b.attributes('aria-label'))).toEqual([
        '#ff0000',
        '#00ff00',
      ]);
    });

    it('renders a duplicate preset entry only once', async () => {
      const wrapper = mountEditor(ColorPicker, {
        props: {
          modelValue: '#000',
          presets: ['#ff0000', '#ff0000', '#00ff00'],
        },
      });
      await wrapper.find('button').trigger('click');

      const presetButtons = wrapper.findAll(
        '.tpl-color-popover [role="radiogroup"] button',
      );
      expect(presetButtons.map((b) => b.attributes('aria-label'))).toEqual([
        '#ff0000',
        '#00ff00',
      ]);
    });

    it('applies a preset color on click', async () => {
      const wrapper = mountEditor(ColorPicker, {
        props: { modelValue: '', presets: ['#ff0000', '#00ff00'] },
      });
      await wrapper.find('button').trigger('click');

      const presetButtons = wrapper.findAll(
        '.tpl-color-popover [role="radiogroup"] button',
      );
      await presetButtons[0].trigger('click');

      const emitted = wrapper.emitted('update:modelValue');
      expect(emitted).toHaveLength(1);
      expect(emitted![0]).toEqual(['#ff0000']);
    });

    it('marks the preset matching the current value as selected (case-insensitive)', async () => {
      const wrapper = mountEditor(ColorPicker, {
        props: { modelValue: '#FF0000', presets: ['#ff0000', '#00ff00'] },
      });
      await wrapper.find('button').trigger('click');

      const presetButtons = wrapper.findAll(
        '.tpl-color-popover [role="radiogroup"] button',
      );
      expect(presetButtons[0].attributes('aria-checked')).toBe('true');
      expect(presetButtons[1].attributes('aria-checked')).toBe('false');
    });

    it('marks the preset selected when the current value is stored as rgb', async () => {
      const wrapper = mountEditor(ColorPicker, {
        props: { modelValue: 'rgb(255, 0, 0)', presets: ['#ff0000', '#00ff00'] },
      });
      await wrapper.find('button').trigger('click');

      const presetButtons = wrapper.findAll(
        '.tpl-color-popover [role="radiogroup"] button',
      );
      expect(presetButtons[0].attributes('aria-checked')).toBe('true');
    });

    it('marks a 3-digit preset selected against a 6-digit rgb round-trip value', async () => {
      // #abc expands to #aabbcc = rgb(170, 187, 204); canonicalization makes the
      // shorthand preset compare equal to the browser-serialized value.
      const wrapper = mountEditor(ColorPicker, {
        props: {
          modelValue: 'rgb(170, 187, 204)',
          presets: ['#abc', '#00ff00'],
        },
      });
      await wrapper.find('button').trigger('click');

      const presetButtons = wrapper.findAll(
        '.tpl-color-popover [role="radiogroup"] button',
      );
      expect(presetButtons[0].attributes('aria-checked')).toBe('true');
      expect(presetButtons[1].attributes('aria-checked')).toBe('false');
    });

    it('shows no preset as selected when the value is unset', async () => {
      const wrapper = mountEditor(ColorPicker, {
        props: { modelValue: '', presets: ['#ff0000', '#00ff00'] },
      });
      await wrapper.find('button').trigger('click');

      const presetButtons = wrapper.findAll(
        '.tpl-color-popover [role="radiogroup"] button',
      );
      expect(
        presetButtons.every((b) => b.attributes('aria-checked') === 'false'),
      ).toBe(true);
    });

    it('hides the wheel and hex inputs when allowCustom is false with presets', async () => {
      const wrapper = mountEditor(ColorPicker, {
        props: {
          modelValue: '#ff0000',
          presets: ['#ff0000', '#00ff00'],
          allowCustom: false,
        },
      });
      await wrapper.find('button').trigger('click');

      // Popover is preset-grid only: no wheel, no hex field anywhere.
      expect(wrapper.find('.tpl-color-popover [role="radiogroup"]').exists()).toBe(
        true,
      );
      expect(wrapper.find('hex-color-picker').exists()).toBe(false);
      expect(wrapper.find('input[type="text"]').exists()).toBe(false);
    });

    it('keeps the wheel when allowCustom is false but no presets resolve (guard)', async () => {
      const wrapper = mountEditor(ColorPicker, {
        props: { modelValue: '#000', allowCustom: false },
      });
      await wrapper.find('button').trigger('click');

      // With nothing to fall back on, the free-form controls stay so a color
      // can still be chosen.
      expect(wrapper.find('.tpl-color-popover [role="radiogroup"]').exists()).toBe(
        false,
      );
      expect(wrapper.find('hex-color-picker').exists()).toBe(true);
    });

    it('renders unchanged when no presets are configured', async () => {
      const wrapper = mountEditor(ColorPicker, {
        props: { modelValue: '#000' },
      });
      // Full-mode inline field is present before opening (unchanged behavior).
      expect(wrapper.find('input[type="text"]').exists()).toBe(true);

      await wrapper.find('button').trigger('click');
      expect(wrapper.find('.tpl-color-popover [role="radiogroup"]').exists()).toBe(
        false,
      );
      expect(wrapper.find('hex-color-picker').exists()).toBe(true);
    });

    it('reads presets from the injected editor colors when no prop is given', async () => {
      const wrapper = mountEditor(ColorPicker, {
        props: { modelValue: '#000' },
        provides: {
          [COLORS_KEY]: {
            presets: ['#abc123'],
            allowCustom: true,
            allowCustomIgnored: false,
            invalidPresets: [],
          },
        },
      });
      await wrapper.find('button').trigger('click');

      const presetButtons = wrapper.findAll(
        '.tpl-color-popover [role="radiogroup"] button',
      );
      expect(presetButtons.map((b) => b.attributes('aria-label'))).toEqual([
        '#abc123',
      ]);
    });

    it('a presets prop overrides the injected editor colors', async () => {
      const wrapper = mountEditor(ColorPicker, {
        props: { modelValue: '#000', presets: ['#123456'] },
        provides: {
          [COLORS_KEY]: {
            presets: ['#abcdef'],
            allowCustom: true,
            allowCustomIgnored: false,
            invalidPresets: [],
          },
        },
      });
      await wrapper.find('button').trigger('click');

      const presetButtons = wrapper.findAll(
        '.tpl-color-popover [role="radiogroup"] button',
      );
      expect(presetButtons.map((b) => b.attributes('aria-label'))).toEqual([
        '#123456',
      ]);
    });

    describe('radiogroup semantics + roving tabindex', () => {
      it('exposes the preset grid as a radiogroup of role=radio chips', async () => {
        const wrapper = mountEditor(ColorPicker, {
          props: { modelValue: '#000', presets: ['#ff0000', '#00ff00'] },
        });
        await wrapper.find('button').trigger('click');

        const group = wrapper.find('.tpl-color-popover [role="radiogroup"]');
        expect(group.exists()).toBe(true);
        const chips = group.findAll('[role="radio"]');
        expect(chips).toHaveLength(2);
      });

      it('gives the checked chip tabindex 0 and the others -1', async () => {
        const wrapper = mountEditor(ColorPicker, {
          props: {
            modelValue: '#00ff00',
            presets: ['#ff0000', '#00ff00', '#0000ff'],
          },
        });
        await wrapper.find('button').trigger('click');

        const chips = wrapper.findAll('.tpl-color-popover [role="radio"]');
        expect(chips.map((c) => c.attributes('tabindex'))).toEqual([
          '-1',
          '0',
          '-1',
        ]);
      });

      it('gives the first chip tabindex 0 when no preset is checked', async () => {
        const wrapper = mountEditor(ColorPicker, {
          props: { modelValue: '', presets: ['#ff0000', '#00ff00', '#0000ff'] },
        });
        await wrapper.find('button').trigger('click');

        const chips = wrapper.findAll('.tpl-color-popover [role="radio"]');
        expect(chips.map((c) => c.attributes('tabindex'))).toEqual([
          '0',
          '-1',
          '-1',
        ]);
      });

      it('roves focus with arrow keys (wrapping) without emitting', async () => {
        const wrapper = mountEditor(ColorPicker, {
          props: { modelValue: '', presets: ['#ff0000', '#00ff00', '#0000ff'] },
          attachTo: document.body,
        });
        await wrapper.find('button').trigger('click');
        const [a, b, c] = wrapper
          .findAll('.tpl-color-popover [role="radio"]')
          .map((chip) => chip.element as HTMLElement);

        a.focus();
        const right = dispatchArrow(a, 'ArrowRight');
        expect(right.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(b);

        dispatchArrow(b, 'ArrowDown');
        expect(document.activeElement).toBe(c);

        // Wrap forward: last → first.
        dispatchArrow(c, 'ArrowRight');
        expect(document.activeElement).toBe(a);

        // Wrap backward: first → last.
        dispatchArrow(a, 'ArrowLeft');
        expect(document.activeElement).toBe(c);

        // Moving focus never selects.
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
        wrapper.unmount();
      });

      it('leaves Enter/Space to native button activation to emit', async () => {
        const wrapper = mountEditor(ColorPicker, {
          props: { modelValue: '', presets: ['#ff0000', '#00ff00'] },
          attachTo: document.body,
        });
        await wrapper.find('button').trigger('click');
        const chips = wrapper.findAll('.tpl-color-popover [role="radio"]');
        const first = chips[0].element as HTMLElement;
        first.focus();

        // The roving handler only claims the four arrow keys, so Enter is not
        // consumed — the browser's native button activation still fires.
        const enter = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        });
        first.dispatchEvent(enter);
        expect(enter.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(first);
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();

        // Native activation = click, which applies the preset.
        await chips[0].trigger('click');
        expect(wrapper.emitted('update:modelValue')![0]).toEqual(['#ff0000']);
        wrapper.unmount();
      });
    });

    describe('none chip (locked-mode unset)', () => {
      it('renders the none chip only in locked mode, as the first radio', async () => {
        const locked = mountEditor(ColorPicker, {
          props: { modelValue: '', presets: ['#ff0000'], allowCustom: false },
        });
        await locked.find('button').trigger('click');
        const lockedChips = locked.findAll('.tpl-color-popover [role="radio"]');
        // Leading none chip + the single preset.
        expect(lockedChips).toHaveLength(2);
        expect(lockedChips[0].attributes('aria-label')).toBe(
          'colorPicker.clear',
        );
        expect(lockedChips[1].attributes('aria-label')).toBe('#ff0000');
      });

      it('renders no none chip in freeform mode (clear lives on the hex field)', async () => {
        const freeform = mountEditor(ColorPicker, {
          // allowCustom defaults to true → freeform controls present.
          props: { modelValue: '', presets: ['#ff0000'] },
        });
        await freeform.find('button').trigger('click');
        const chips = freeform.findAll('.tpl-color-popover [role="radio"]');
        expect(chips).toHaveLength(1);
        expect(chips[0].attributes('aria-label')).toBe('#ff0000');
      });

      it('marks the none chip checked when unset and unchecked when a value is set', async () => {
        const unset = mountEditor(ColorPicker, {
          props: { modelValue: '', presets: ['#ff0000'], allowCustom: false },
        });
        await unset.find('button').trigger('click');
        expect(
          unset
            .find('.tpl-color-popover [role="radio"]')
            .attributes('aria-checked'),
        ).toBe('true');

        const set = mountEditor(ColorPicker, {
          props: {
            modelValue: '#ff0000',
            presets: ['#ff0000'],
            allowCustom: false,
          },
        });
        await set.find('button').trigger('click');
        const setChips = set.findAll('.tpl-color-popover [role="radio"]');
        // none chip unchecked, preset checked.
        expect(setChips[0].attributes('aria-checked')).toBe('false');
        expect(setChips[1].attributes('aria-checked')).toBe('true');
      });

      it('emits empty (unset) when the none chip is activated', async () => {
        const wrapper = mountEditor(ColorPicker, {
          props: {
            modelValue: '#ff0000',
            presets: ['#ff0000'],
            allowCustom: false,
          },
        });
        await wrapper.find('button').trigger('click');
        const none = wrapper.findAll('.tpl-color-popover [role="radio"]')[0];
        await none.trigger('click');
        const emitted = wrapper.emitted('update:modelValue');
        expect(emitted).toHaveLength(1);
        expect(emitted![0]).toEqual(['']);
      });

      it('holds the single tab stop as the first radio when the value is unset', async () => {
        const wrapper = mountEditor(ColorPicker, {
          props: {
            modelValue: '',
            presets: ['#ff0000', '#00ff00'],
            allowCustom: false,
          },
        });
        await wrapper.find('button').trigger('click');
        const chips = wrapper.findAll('.tpl-color-popover [role="radio"]');
        expect(chips.map((c) => c.attributes('tabindex'))).toEqual([
          '0',
          '-1',
          '-1',
        ]);
      });

      it('checks no chip for an off-palette value but keeps the none chip as the tab stop', async () => {
        // A factory default like #333333 is outside the offered palette: correct
        // radiogroup semantics leave every chip unchecked, and the first radio
        // (the none chip) still holds the tab stop.
        const wrapper = mountEditor(ColorPicker, {
          props: {
            modelValue: '#333333',
            presets: ['#ff0000', '#00ff00'],
            allowCustom: false,
          },
        });
        await wrapper.find('button').trigger('click');
        const chips = wrapper.findAll('.tpl-color-popover [role="radio"]');
        expect(chips.map((c) => c.attributes('aria-checked'))).toEqual([
          'false',
          'false',
          'false',
        ]);
        expect(chips[0].attributes('tabindex')).toBe('0');
      });
    });
  });
});

function dispatchArrow(el: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(event);
  return event;
}
