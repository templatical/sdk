/** @see https://templatical.com/docs/v1/custom-blocks */

import type { BlockStyles } from "./blocks";

export type CustomBlockFieldType =
  | "text"
  | "textarea"
  | "image"
  | "color"
  | "number"
  | "select"
  | "boolean"
  | "repeatable";

export interface CustomBlockFieldBase {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}

export interface CustomBlockTextField extends CustomBlockFieldBase {
  type: "text";
  default?: string;
}

export interface CustomBlockTextareaField extends CustomBlockFieldBase {
  type: "textarea";
  default?: string;
}

export interface CustomBlockImageField extends CustomBlockFieldBase {
  type: "image";
  default?: string;
}

export interface CustomBlockColorField extends CustomBlockFieldBase {
  type: "color";
  default?: string;
}

export interface CustomBlockNumberField extends CustomBlockFieldBase {
  type: "number";
  default?: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface CustomBlockSelectField extends CustomBlockFieldBase {
  type: "select";
  options: SelectOption[];
  default?: string;
}

export interface CustomBlockBooleanField extends CustomBlockFieldBase {
  type: "boolean";
  default?: boolean;
}

export interface CustomBlockRepeatableField extends CustomBlockFieldBase {
  type: "repeatable";
  fields: Exclude<CustomBlockField, CustomBlockRepeatableField>[];
  default?: Record<string, unknown>[];
  minItems?: number;
  maxItems?: number;
}

export type CustomBlockField =
  | CustomBlockTextField
  | CustomBlockTextareaField
  | CustomBlockImageField
  | CustomBlockColorField
  | CustomBlockNumberField
  | CustomBlockSelectField
  | CustomBlockBooleanField
  | CustomBlockRepeatableField;

export interface CustomBlockDefinition {
  type: string;
  name: string;
  icon?: string;
  description?: string;
  fields: CustomBlockField[];
  template: string;
  dataSource?: DataSourceConfig;
  /**
   * Default block styles applied when a new instance of this custom block is
   * created. Deep-merged over the built-in defaults — only specify the fields
   * you want to override. Controls both the editor canvas wrapper and the
   * rendered MJML/email output.
   *
   * @example
   * defaultStyles: {
   *   padding: { top: 0, right: 0, bottom: 0, left: 0 },
   * }
   */
  defaultStyles?: Partial<BlockStyles>;
  /**
   * Optional CSS rules attached to this custom block definition. Emitted once
   * (deduped across instances) into `<mj-head><mj-style>…</mj-style></mj-head>`
   * in the rendered MJML, and adopted into the editor canvas (shadow root or
   * light-DOM mount) so authored responsive/hover/font behavior previews
   * inside the editor.
   *
   * Use this for media queries, hover states, or any CSS that should apply
   * once per definition rather than per block instance. Class names are not
   * scoped by the SDK — namespace them yourself (e.g. `.tplc-<type>-<el>`) to
   * avoid collisions with other definitions or built-in editor styles.
   *
   * @example
   * stylesheet: `
   *   @media (max-width: 480px) {
   *     .tplc-image-text-cell { display: block !important; width: 100% !important; }
   *   }
   * `
   */
  stylesheet?: string;
}

export interface DataSourceFetchContext {
  fieldValues: Record<string, unknown>;
  blockId: string;
}

export interface DataSourceConfig {
  label: string;
  onFetch: (
    context: DataSourceFetchContext,
  ) => Promise<Record<string, unknown> | null>;
}
