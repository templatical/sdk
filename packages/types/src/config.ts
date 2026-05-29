import type { SyntaxPreset, SyntaxPresetName } from "./merge-tags";

export type ViewportSize = "desktop" | "mobile";

export type UiTheme = "light" | "dark" | "auto";

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
  /**
   * Optional grouping label used by the built-in merge tag picker to
   * section the list. When no tag in the configured array carries
   * `group`, the picker renders a plain flat list with no headers.
   * Ignored by the renderer and by typing-autocomplete.
   */
  group?: string;
  /**
   * Optional helper text shown beneath the tag in the built-in merge
   * tag picker. Not rendered anywhere else (toolbar, autocomplete,
   * MJML output) and not stored on the inserted document node.
   */
  description?: string;
}

export interface MediaResult {
  url: string;
  alt?: string;
}

export interface MergeTagsConfig {
  syntax?: SyntaxPresetName | SyntaxPreset;
  tags?: MergeTag[];
  onRequest?: () => Promise<MergeTag | null>;
  /**
   * Enables typing-based autocomplete in rich text fields. When the user
   * types the syntax opener (e.g. `{{`), a popup lists matching `tags`.
   *
   * Defaults to `true`. Effective only when `tags` is non-empty AND
   * `syntax` matches a built-in preset (custom regex syntaxes cannot be
   * mapped to a trigger string and silently disable autocomplete).
   */
  autocomplete?: boolean;
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
  dark?: Omit<ThemeOverrides, "dark">;
}

export class SdkError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "SdkError";
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
