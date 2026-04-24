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

  it('uses DEFAULT_TEXT_COLOR fallback when modelValue is empty', () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: '' },
    });
    const swatchInner = wrapper.find('button span');
    // Fallback kicks in via internalColor getter
    expect(swatchInner.attributes('style')).toMatch(/background-color:/);
  });
});
