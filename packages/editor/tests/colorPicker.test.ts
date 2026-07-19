// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import ColorPicker from '../src/components/ColorPicker.vue';
import { mountEditor } from './helpers/mount';

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

  it('shows a popover clear for swatch-only when set, and clears + closes on click', async () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#ff0000', swatchOnly: true },
    });
    await wrapper.find('button').trigger('click'); // open the popover
    expect(wrapper.find('hex-color-picker').exists()).toBe(true);
    const clearBtn = wrapper.find('.tpl-color-popover button');
    expect(clearBtn.exists()).toBe(true);

    await clearBtn.trigger('click');
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toHaveLength(1);
    expect(emitted![0]).toEqual(['']);
    // Clearing closes the popover for immediate feedback.
    expect(wrapper.find('hex-color-picker').exists()).toBe(false);
  });

  it('shows no popover clear for swatch-only when the color is unset', async () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '', swatchOnly: true },
    });
    await wrapper.find('button').trigger('click');
    expect(wrapper.find('hex-color-picker').exists()).toBe(true);
    expect(wrapper.find('.tpl-color-popover button').exists()).toBe(false);
  });

  it('adds no popover clear in full mode — the hex input × owns clearing', async () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '#ff0000' }, // swatchOnly defaults to false
    });
    await wrapper.find('button').trigger('click'); // open popover via swatch
    expect(wrapper.find('hex-color-picker').exists()).toBe(true);
    expect(wrapper.find('.tpl-color-popover button').exists()).toBe(false);
  });
});
