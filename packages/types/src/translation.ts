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
