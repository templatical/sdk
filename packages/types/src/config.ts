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
   * Enables typing-based autocomplete in rich text blocks and in every
   * merge-tag-enabled input/textarea field (toolbars, template settings,
   * custom-block text fields). When the user types the syntax opener
   * (e.g. `{{`), a popup lists matching `tags`. Both surfaces share the
   * same popup, so behavior is identical.
   *
   * Defaults to `true`. Effective only when `tags` is non-empty AND
   * `syntax` matches a built-in preset (custom regex syntaxes cannot be
   * mapped to a trigger string and silently disable autocomplete).
   */
  autocomplete?: boolean;
}

/**
 * A standalone logic tag — a control-flow token (e.g. `{% else %}`) inserted
 * at the cursor. Distinct from data merge tags; rendered as a keyword badge.
 */
export interface LogicTag {
  label: string;
  value: string;
  /** Optional grouping label used to section the logic picker. */
  group?: string;
  /** Optional helper text shown beneath the tag in the picker. */
  description?: string;
}

/**
 * A paired logic construct — an opening tag (`before`) and its matching closer
 * (`after`), e.g. `{% if vip %}` … `{% endif %}`. Selecting one inserts both
 * pills at once, wrapping the selection (or with the caret placed between
 * them). Shares its `before`/`after` shape with `DisplayCondition`.
 */
export interface LogicPair {
  label: string;
  /** Opening logic tag, including delimiters (e.g. `{% if vip %}`). */
  before: string;
  /** Closing logic tag, including delimiters (e.g. `{% endif %}`). */
  after: string;
  /** Optional grouping label used to section the logic picker. */
  group?: string;
  /** Optional helper text shown beneath the pair in the picker. */
  description?: string;
}

/**
 * Standalone logic-tag configuration, independent of `mergeTags`. `tags` are
 * single control-flow tokens inserted at the cursor; `pairs` are open/close
 * constructs inserted around the selection. Both appear in the built-in logic
 * picker, grouped together by `group`. Typed/pasted logic highlighting is
 * always on regardless of this.
 */
export interface LogicTagsConfig {
  tags?: LogicTag[];
  pairs?: LogicPair[];
  /**
   * Consumer-owned picker. When set, the "Insert logic" affordance calls this
   * instead of the built-in logic picker — return the chosen tag/pair (or
   * `null` to cancel). Mirrors `MergeTagsConfig.onRequest`; lets consumers use
   * their own UI and custom syntax. Precedence: `onRequest` → built-in picker.
   */
  onRequest?: () => Promise<LogicTag | LogicPair | null>;
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
