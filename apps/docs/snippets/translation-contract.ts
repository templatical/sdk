import type {
  CustomBlockDefinition,
  Operation,
  SyntaxPreset,
  TemplateContent,
} from "@templatical/types";

export type TranslationErrorCode =
  "rate_limited" | "limit_reached" | "content_too_large" | "translation_failed";

export interface TranslationField {
  /** A block field id, or `settings/<path>`. */
  id: string;
  /** Merge and logic tags masked as numbered placeholders. */
  text: string;
  format: "html" | "text";
}

export interface TranslationRequest {
  templateId: string | null;
  sourceLocale: string;
  targetLocale: string;
  /** At most 50 fields and 20,000 characters of text per call. */
  fields: TranslationField[];
}

export interface TranslationResult {
  fields: { id: string; text: string }[];
}

/** A translation backend. Reject with an SdkError or, when aborted, an AbortError. */
export interface TranslationProvider {
  translate(
    request: TranslationRequest,
    signal: AbortSignal,
  ): Promise<TranslationResult>;
}

export const TRANSLATION_MAX_FIELDS = 50;
export const TRANSLATION_MAX_CHARS = 20_000;

export interface LocaleString {
  id: string;
  format: "html" | "text";
  /** The masked default value. */
  source: string;
  /** The hash of the unmasked default at extraction time. */
  sourceHash: string;
  /** The stored translation masked with the source's token ids. */
  text?: string;
}

export declare const TRANSLATABLE_HTML_FIELDS: Readonly<
  Record<string, readonly string[]>
>;

export declare function maskTags(
  text: string,
  syntax: SyntaxPreset,
  format: "html" | "text",
): { text: string; tokens: string[] };

export declare function unmaskTags(
  text: string,
  tokens: string[],
): string | null;

export declare function localeStrings(
  content: TemplateContent,
  locale: string,
  options: {
    definitions?: readonly CustomBlockDefinition[];
    syntax: SyntaxPreset;
    only: "gaps" | "all";
    blockId?: string;
  },
): { strings: LocaleString[]; tokens: Record<string, string[]> };

export declare function applyLocaleStrings(
  content: TemplateContent,
  locale: string,
  values: { id: string; text: string; sourceHash: string }[],
  options: {
    definitions?: readonly CustomBlockDefinition[];
    syntax: SyntaxPreset;
    tokens: Record<string, string[]>;
  },
): {
  operations: Operation[];
  rejected: {
    id: string;
    reason: "tags_changed" | "unknown_field" | "not_translatable";
  }[];
};
