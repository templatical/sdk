import type {
  Block,
  SectionBlock,
  TemplateContent,
  TemplateSettings,
} from "@templatical/types";

export type Severity = "error" | "warning" | "info" | "off";

export interface LintIssue {
  /** Block id, or null for template-level issues. */
  blockId: string | null;
  ruleId: string;
  severity: Exclude<Severity, "off">;
  message: string;
  fix?: LintPatch;
}

export interface LintPatchContext {
  updateBlock: (blockId: string, patch: Partial<Block>) => void;
  updateSettings: (patch: Partial<TemplateSettings>) => void;
  removeBlock: (blockId: string) => void;
}

export interface LintPatch {
  description: string;
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
 * Keys are the full prefixed rule IDs (`a11y.*`, `structure.*`, `link.*`)
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

export interface LintOptions {
  /**
   * Fully disable linting. When true, the editor skips lazy-loading the
   * package, hides the sidebar tab, and suppresses inline badges.
   */
  disabled?: boolean;
  /** Locale for vague-text dictionaries and message text. Falls back to `en`. */
  locale?: string;
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
}

export interface ResolvedLinksOptions {
  nonProductionHosts: string[];
}

export interface ResolvedOptions {
  locale: string;
  rules: RuleOverrides;
  thresholds: LintThresholds;
  links: ResolvedLinksOptions;
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
}

export interface RuleMeta {
  /** Stable identifier — used for severity overrides and message lookup. */
  id: string;
  /** Default severity when no override is supplied. */
  severity: Exclude<Severity, "off">;
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
