import type {
  AiFeatureName,
  AiMergeTags,
  AiProvider,
  TemplateContent,
} from "@templatical/types";
export type HttpAiFeatures = Partial<
  Record<AiFeatureName | "conversation", boolean>
>;

export interface AiConformanceCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface AiConformanceReport {
  ok: boolean;
  checks: AiConformanceCheck[];
}

export interface AiConformanceOptions {
  /** The template the suite edits; the test set's welcome email by default. */
  content?: TemplateContent;
  templateId?: string;
  /** Public image URL fetched by the model provider for the alt-text probe. */
  altTextImageUrl?: string;
  mergeTags?: AiMergeTags | null;
  /** How long a stopped call may take to reject (D35). */
  timeoutMs?: number;
  /** An optional shorter call limit; every call is also bounded by `timeoutMs`. */
  callTimeoutMs?: number;
}

export interface AiWireConformanceOptions {
  baseUrl: string;
  features?: HttpAiFeatures;
  headers?:
    | Record<string, string>
    | (() => Record<string, string> | Promise<Record<string, string>>);
  templateId?: string;
  /** Defaults to https://docs.templatical.com/og-image.png. */
  altTextImageUrl?: string;
  timeoutMs?: number;
  callTimeoutMs?: number;
}

export declare function runAiProviderConformance(
  provider: AiProvider,
  options?: AiConformanceOptions,
): Promise<AiConformanceReport>;

export declare function runAiWireConformance(
  options: AiWireConformanceOptions,
): Promise<AiConformanceReport>;
