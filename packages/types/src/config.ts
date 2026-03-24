import type { SyntaxPreset, SyntaxPresetName } from './merge-tags';

export type ViewportSize = 'desktop' | 'tablet' | 'mobile';

export interface CustomFont {
    name: string;
    url: string;
    fallback?: string;
}

export interface FontsConfig {
    defaultFallback?: string;
    defaultFont?: string;
    customFonts?: CustomFont[];
}

export interface ExportResult {
    html: string;
    mjml: string;
}

export interface MergeTag {
    label: string;
    value: string;
}

export interface MergeTagsConfig {
    syntax?: SyntaxPresetName | SyntaxPreset;
    tags?: MergeTag[];
}

export interface DisplayCondition {
    label: string;
    before: string;
    after: string;
    group?: string;
    description?: string;
}

export interface DisplayConditionsConfig {
    conditions: DisplayCondition[];
    allowCustom?: boolean;
}

export interface ThemeOverrides {
    bg?: string;
    bgElevated?: string;
    bgHover?: string;
    bgActive?: string;
    border?: string;
    borderLight?: string;
    text?: string;
    textMuted?: string;
    textDim?: string;
    primary?: string;
    primaryHover?: string;
    primaryLight?: string;
    secondary?: string;
    secondaryHover?: string;
    secondaryLight?: string;
    success?: string;
    successLight?: string;
    warning?: string;
    warningLight?: string;
    danger?: string;
    dangerLight?: string;
    canvasBg?: string;
}

export class SdkError extends Error {
    constructor(
        message: string,
        public readonly statusCode?: number,
    ) {
        super(message);
        this.name = 'SdkError';
    }

    get isNotFound(): boolean {
        return this.statusCode === 404;
    }

    get isUnauthorized(): boolean {
        return this.statusCode === 401;
    }

    get isServerError(): boolean {
        return this.statusCode !== undefined && this.statusCode >= 500;
    }
}
