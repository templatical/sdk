// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  fieldComponentMap,
  resolveFieldComponent,
} from '../src/components/toolbar/fields/index';
import TextField from '../src/components/toolbar/fields/TextField.vue';
import TextareaField from '../src/components/toolbar/fields/TextareaField.vue';
import ImageField from '../src/components/toolbar/fields/ImageField.vue';
import ColorField from '../src/components/toolbar/fields/ColorField.vue';
import NumberField from '../src/components/toolbar/fields/NumberField.vue';
import SelectField from '../src/components/toolbar/fields/SelectField.vue';
import BooleanField from '../src/components/toolbar/fields/BooleanField.vue';
import RepeatableField from '../src/components/toolbar/fields/RepeatableField.vue';

describe('resolveFieldComponent', () => {
  const cases: Array<[string, unknown]> = [
    ['text', TextField],
    ['textarea', TextareaField],
    ['image', ImageField],
    ['color', ColorField],
    ['number', NumberField],
    ['select', SelectField],
    ['boolean', BooleanField],
    ['repeatable', RepeatableField],
  ];

  it.each(cases)('resolves %s to the correct component', (type, expected) => {
    expect(resolveFieldComponent(type as any)).toBe(expected);
  });

  it('falls back to TextField for an unknown type', () => {
    expect(resolveFieldComponent('unknown' as any)).toBe(TextField);
  });

  it('exports the map with all 8 field types', () => {
    expect(Object.keys(fieldComponentMap).sort()).toEqual([
      'boolean',
      'color',
      'image',
      'number',
      'repeatable',
      'select',
      'text',
      'textarea',
    ]);
  });
});
