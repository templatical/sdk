// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import TextField from '../src/components/toolbar/fields/TextField.vue';
import TextareaField from '../src/components/toolbar/fields/TextareaField.vue';
import NumberField from '../src/components/toolbar/fields/NumberField.vue';
import SelectField from '../src/components/toolbar/fields/SelectField.vue';
import BooleanField from '../src/components/toolbar/fields/BooleanField.vue';
import { mountEditor } from './helpers/mount';

describe('TextField', () => {
  it('renders an editable MergeTagInput (not the disabled readOnly fallback)', () => {
    const wrapper = mountEditor(TextField, {
      props: {
        field: { type: 'text', key: 'name', label: 'Name' },
        modelValue: 'hello',
      },
    });
    const input = wrapper.find('input');
    expect(input.attributes('disabled')).toBeUndefined();
    expect((input.element as HTMLInputElement).value).toBe('hello');
  });

  it('renders a disabled native input in readOnly mode', () => {
    const wrapper = mountEditor(TextField, {
      props: {
        field: { type: 'text', key: 'name', label: 'Name' },
        modelValue: 'locked',
        readOnly: true,
      },
    });
    const input = wrapper.find('input[type="text"]');
    expect(input.exists()).toBe(true);
    expect(input.attributes('disabled')).toBeDefined();
    expect((input.element as HTMLInputElement).value).toBe('locked');
  });
});

describe('TextareaField', () => {
  it('renders a disabled textarea in readOnly mode', () => {
    const wrapper = mountEditor(TextareaField, {
      props: {
        field: { type: 'textarea', key: 'bio', label: 'Bio' },
        modelValue: 'Some text',
        readOnly: true,
      },
    });
    const ta = wrapper.find('textarea');
    expect(ta.exists()).toBe(true);
    expect(ta.attributes('disabled')).toBeDefined();
  });
});

describe('NumberField', () => {
  it('renders a number input reflecting modelValue', () => {
    const wrapper = mountEditor(NumberField, {
      props: {
        field: { type: 'number', key: 'age', label: 'Age', min: 0, max: 99, step: 1 },
        modelValue: 42,
      },
    });
    const input = wrapper.find('input[type="number"]');
    expect((input.element as HTMLInputElement).value).toBe('42');
    expect(input.attributes('min')).toBe('0');
    expect(input.attributes('max')).toBe('99');
    expect(input.attributes('step')).toBe('1');
  });

  it('emits update:modelValue with a Number on input', async () => {
    const wrapper = mountEditor(NumberField, {
      props: {
        field: { type: 'number', key: 'age', label: 'Age' },
        modelValue: 0,
      },
    });
    const input = wrapper.find('input[type="number"]');
    (input.element as HTMLInputElement).value = '17';
    await input.trigger('input');

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toHaveLength(1);
    expect(emitted![0]).toEqual([17]);
  });

  it('does not emit when readOnly and user attempts to type', async () => {
    const wrapper = mountEditor(NumberField, {
      props: {
        field: { type: 'number', key: 'age', label: 'Age' },
        modelValue: 5,
        readOnly: true,
      },
    });
    const input = wrapper.find('input[type="number"]');
    (input.element as HTMLInputElement).value = '10';
    await input.trigger('input');

    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });
});

describe('SelectField', () => {
  const field = {
    type: 'select' as const,
    key: 'size',
    label: 'Size',
    options: [
      { value: 's', label: 'Small' },
      { value: 'm', label: 'Medium' },
      { value: 'l', label: 'Large' },
    ],
  };

  it('renders an option per field.options entry', () => {
    const wrapper = mountEditor(SelectField, {
      props: { field, modelValue: 'm' },
    });
    const options = wrapper.findAll('option');
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.attributes('value'))).toEqual(['s', 'm', 'l']);
  });

  it('reflects modelValue as the select value', () => {
    const wrapper = mountEditor(SelectField, {
      props: { field, modelValue: 'l' },
    });
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('l');
  });

  it('emits update:modelValue on change', async () => {
    const wrapper = mountEditor(SelectField, {
      props: { field, modelValue: 's' },
    });
    const select = wrapper.find('select');
    (select.element as HTMLSelectElement).value = 'l';
    await select.trigger('change');

    expect(wrapper.emitted('update:modelValue')).toEqual([['l']]);
  });

  it('does not emit on change when readOnly', async () => {
    const wrapper = mountEditor(SelectField, {
      props: { field, modelValue: 's', readOnly: true },
    });
    const select = wrapper.find('select');
    (select.element as HTMLSelectElement).value = 'l';
    await select.trigger('change');

    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });
});

describe('BooleanField', () => {
  const field = { type: 'boolean' as const, key: 'on', label: 'Active' };

  it('renders a switch button with aria-checked reflecting modelValue', () => {
    const wrapper = mountEditor(BooleanField, {
      props: { field, modelValue: true },
    });
    const btn = wrapper.find('button[role="switch"]');
    expect(btn.attributes('aria-checked')).toBe('true');
  });

  it('toggles and emits inverted modelValue on click', async () => {
    const wrapper = mountEditor(BooleanField, {
      props: { field, modelValue: false },
    });
    await wrapper.find('button[role="switch"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
  });

  it('is disabled and does not emit when readOnly', async () => {
    const wrapper = mountEditor(BooleanField, {
      props: { field, modelValue: false, readOnly: true },
    });
    const btn = wrapper.find('button[role="switch"]');
    expect(btn.attributes('disabled')).toBeDefined();
    await btn.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });

  it('renders required indicator when field.required is true', () => {
    const wrapper = mountEditor(BooleanField, {
      props: { field: { ...field, required: true }, modelValue: false },
    });
    expect(wrapper.text()).toContain('*');
  });
});
