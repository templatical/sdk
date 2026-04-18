import type { CustomBlockFieldType } from "@templatical/types";
import type { Component } from "vue";
import BooleanField from "./BooleanField.vue";
import ColorField from "./ColorField.vue";
import ImageField from "./ImageField.vue";
import NumberField from "./NumberField.vue";
import RepeatableField from "./RepeatableField.vue";
import SelectField from "./SelectField.vue";
import TextField from "./TextField.vue";
import TextareaField from "./TextareaField.vue";

export const fieldComponentMap: Record<CustomBlockFieldType, Component> = {
  text: TextField,
  textarea: TextareaField,
  image: ImageField,
  color: ColorField,
  number: NumberField,
  select: SelectField,
  boolean: BooleanField,
  repeatable: RepeatableField,
};

export function resolveFieldComponent(type: CustomBlockFieldType): Component {
  return fieldComponentMap[type] ?? TextField;
}
