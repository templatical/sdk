import type {
  Block,
  CustomBlockDefinition,
  SectionBlock,
  TemplateContent,
  TemplateSettings,
  SyntaxPreset,
  SyntaxPresetName,
} from "@templatical/types";

export type Severity = "error" | "warning" | "info" | "off";

export interface LintIssue {
  /** Block id, or null for template-level issues. */
  blockId: string | null;
  ruleId: string;
  severity: Exclude<Severity, "off">;
  message: string;
  suggestion: string;
  reference: string;
  clients?: ClientSupport[];
  excerpt?: string;
  fix?: LintPatch;
}

export interface ClientSupport {
  id: string;
  name: string;
  support: "unsupported" | "partial";
  notes: string[];
  testedAt: string;
}

export interface LintPatchContext {
  updateBlock: (blockId: string, patch: Partial<Block>) => void;
  updateSettings: (patch: Partial<TemplateSettings>) => void;
  removeBlock: (blockId: string) => void;
}

export interface LintPatch {
  description: string;
  /** Removal fixes change the shared tree and are omitted in language views. */
  removesBlock?: boolean;
  apply: (ctx: LintPatchContext) => void;
}

export interface LintThresholds {
  altMaxLength: number;
  minFontSize: number;
  allCapsMinLength: number;
  minTouchTargetPx: number;
}

/**
 * Per-rule severity override. Set a rule to `'off'` to disable it.
 * Keys are the full prefixed rule IDs (`a11y.*`, `structure.*`, `link.*`, `deliverability.*`, `compat.*`, `localization.*`)
 * so a value copied from `LintIssue.ruleId` pastes straight in.
 */
export type RuleOverrides = Record<string, Severity>;

/** Options consumed only by the accessibility linter. */
export interface AccessibilityLintOptions {
  rules?: RuleOverrides;
  thresholds?: Partial<LintThresholds>;
}

/** Options consumed only by the structure linter. */
export interface StructureLintOptions {
  rules?: RuleOverrides;
}

/** Options consumed only by the links linter. */
export interface LinksLintOptions {
  rules?: RuleOverrides;
  /**
   * Host patterns that should flag as "staging / non-production".
   * Each entry is a glob-style pattern matched against the URL host.
   * `*` matches any run of characters (including `.`), so `*.staging.*`
   * matches `app.staging.example.com`.
   *
   * Default: ['localhost', '127.0.0.1', '0.0.0.0', '*.local',
   *           '*.staging.*', '*.dev.*']
   */
  nonProductionHosts?: string[];
}

export interface DeliverabilityThresholds {
  /** Visible characters below which `deliverability.low-text` fires. */
  minTextLength: number;
}

export const DEFAULT_DELIVERABILITY_THRESHOLDS: DeliverabilityThresholds = {
  minTextLength: 200,
};

export interface DeliverabilityLintOptions {
  rules?: RuleOverrides;
  thresholds?: Partial<DeliverabilityThresholds>;
  /** Hosts treated as URL shorteners. Replaces DEFAULT_SHORTENER_HOSTS; spread the default to extend it. */
  shortenerHosts?: string[];
}

export interface CompatibilityThresholds {
  maxHtmlBytes: number;
}

export const DEFAULT_COMPATIBILITY_THRESHOLDS: CompatibilityThresholds = {
  maxHtmlBytes: 92_160,
};

export interface CompatibilityLintOptions {
  rules?: RuleOverrides;
  thresholds?: Partial<CompatibilityThresholds>;
}

export interface LocalizationLintOptions {
  rules?: RuleOverrides;
}

export interface LintOptions {
  /**
   * Fully disable linting. When true, the editor skips lazy-loading the
   * package, hides the sidebar tab, and suppresses inline badges.
   */
  disabled?: boolean;
  /** Message language. Falls back to `en`. */
  locale?: string;
  /** Template language to lint. Defaults to `content.settings.locale`. Dictionaries remain a union. */
  contentLocale?: string;
  /** Definitions used to identify custom blocks' translatable text. */
  customBlocks?: CustomBlockDefinition[];
  /** Merge-tag syntax for localization checks. Defaults to Liquid. */
  mergeTagSyntax?: SyntaxPresetName | SyntaxPreset;
  /**
   * Accessibility linter config. Set to `false` to disable the whole
   * `lintAccessibility` linter without enumerating its rules.
   */
  accessibility?: false | AccessibilityLintOptions;
  /**
   * Structure linter config. Set to `false` to disable the whole
   * `lintStructure` linter without enumerating its rules.
   */
  structure?: false | StructureLintOptions;
  /**
   * Links linter config. Set to `false` to disable the whole `lintLinks`
   * linter without enumerating its rules.
   */
  links?: false | LinksLintOptions;
  /**
   * Deliverability linter config. Set to `false` to disable the whole
   * `lintDeliverability` linter without enumerating its rules.
   */
  deliverability?: false | DeliverabilityLintOptions;
  /** Email-client compatibility checks over pass-through content. */
  compatibility?: false | CompatibilityLintOptions;
  /** Missing, stale, and mismatched merge-tag checks for language versions. */
  localization?: false | LocalizationLintOptions;
}

export interface ResolvedLinksOptions {
  nonProductionHosts: string[];
}

export interface ResolvedDeliverabilityOptions {
  minTextLength: number;
  shortenerHosts: string[];
}

export interface ResolvedCompatibilityOptions {
  maxHtmlBytes: number;
}

export interface ResolvedOptions {
  locale: string;
  contentLocale?: string;
  customBlocks?: CustomBlockDefinition[];
  mergeTagSyntax?: SyntaxPresetName | SyntaxPreset;
  rules: RuleOverrides;
  thresholds: LintThresholds;
  links: ResolvedLinksOptions;
  deliverability: ResolvedDeliverabilityOptions;
  compatibility: ResolvedCompatibilityOptions;
  /** Returns the effective severity for a rule (override or default). */
  severity: (ruleId: string) => Severity;
}

export interface WalkContext {
  parent: Block | null;
  section: SectionBlock | null;
  columnIndex: number | null;
  depth: number;
  /**
   * Nearest opaque ancestor background, or template settings background.
   * Hex string, lowercased.
   */
  resolvedBackgroundColor: string;
  /**
   * Document-level default text color (`settings.textColor`), lowercased hex.
   * A text block that doesn't set its own `color` inherits this, so contrast
   * rules resolve the effective color against it.
   */
  resolvedTextColor: string;
}

export interface RuleMeta {
  /** Stable identifier — used for severity overrides and message lookup. */
  id: string;
  /** Default severity when no override is supplied. */
  severity: Exclude<Severity, "off">;
  /** Absolute documentation or source URL explaining the rule. */
  reference: string;
  /**
   * For a rule whose hits explain themselves in more than one way: each
   * variant has its own localized message, keyed `<id>.<variant>`, and a hit
   * picks one with `RuleHit.messageVariant`. A rule without variants has one
   * message, keyed by its `id`.
   */
  messageVariants?: readonly string[];
}

/**
 * What a rule emits per match. The orchestrator combines this with the
 * rule's `meta` (for `ruleId` + default severity) and resolves the
 * localized message via the active locale's message map.
 */
export interface RuleHit {
  blockId: string | null;
  /** Interpolation values for the rule's localized message template. */
  params?: Record<string, string | number>;
  /** One of the rule's `meta.messageVariants`: formats the message `<id>.<variant>`. */
  messageVariant?: string;
  clients?: ClientSupport[];
  excerpt?: string;
  fix?: LintPatch;
}

export interface Rule {
  meta: RuleMeta;
  /** Block-level rule. Returns a hit or null. */
  block?: (
    block: Block,
    ctx: WalkContext,
    opts: ResolvedOptions,
  ) => RuleHit | null;
  /** Template-level rule. Runs once after the walk. */
  template?: (content: TemplateContent, opts: ResolvedOptions) => RuleHit[];
  compiledHtml?: (html: string, opts: ResolvedOptions) => RuleHit[];
}

export const DEFAULT_A11Y_THRESHOLDS: LintThresholds = {
  altMaxLength: 125,
  minFontSize: 14,
  allCapsMinLength: 20,
  minTouchTargetPx: 44,
};

export const DEFAULT_NON_PRODUCTION_HOSTS: string[] = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "*.local",
  "*.staging.*",
  "*.dev.*",
];
