/** @see https://templatical.com/docs/v1/custom-blocks */

export type CustomBlockFieldType =
    | 'text'
    | 'textarea'
    | 'image'
    | 'color'
    | 'number'
    | 'select'
    | 'boolean'
    | 'repeatable';

export interface CustomBlockFieldBase {
    key: string;
    label: string;
    required?: boolean;
    placeholder?: string;
    readOnly?: boolean;
}

export interface CustomBlockTextField extends CustomBlockFieldBase {
    type: 'text';
    default?: string;
}

export interface CustomBlockTextareaField extends CustomBlockFieldBase {
    type: 'textarea';
    default?: string;
}

export interface CustomBlockImageField extends CustomBlockFieldBase {
    type: 'image';
    default?: string;
}

export interface CustomBlockColorField extends CustomBlockFieldBase {
    type: 'color';
    default?: string;
}

export interface CustomBlockNumberField extends CustomBlockFieldBase {
    type: 'number';
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
    type: 'select';
    options: SelectOption[];
    default?: string;
}

export interface CustomBlockBooleanField extends CustomBlockFieldBase {
    type: 'boolean';
    default?: boolean;
}

export interface CustomBlockRepeatableField extends CustomBlockFieldBase {
    type: 'repeatable';
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
