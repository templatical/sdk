import type {
  Block,
  SectionBlock,
  TemplateContent,
  TemplateSettings,
} from "@templatical/types";

export type Severity = "error" | "warning" | "info" | "off";

export interface A11yIssue {
  /** Block id, or null for template-level issues. */
  blockId: string | null;
  ruleId: string;
  severity: Exclude<Severity, "off">;
  message: string;
  fix?: A11yPatch;
}

export interface A11yPatchContext {
  updateBlock: (blockId: string, patch: Partial<Block>) => void;
  updateSettings: (patch: Partial<TemplateSettings>) => void;
}

export interface A11yPatch {
  description: string;
  apply: (ctx: A11yPatchContext) => void;
}

export interface A11yThresholds {
  altMaxLength: number;
  minFontSize: number;
  allCapsMinLength: number;
  minTouchTargetPx: number;
}

export interface A11yOptions {
  /**
   * Fully disable linting. When true, the editor skips lazy-loading the
   * package, hides the sidebar tab, and suppresses inline badges.
   */
  disabled?: boolean;
  /** Locale for vague-text dictionaries and message text. Falls back to `en`. */
  locale?: string;
  /** Per-rule severity override. Set to `'off'` to disable a specific rule. */
  rules?: Record<string, Severity>;
  thresholds?: Partial<A11yThresholds>;
}

export interface ResolvedOptions {
  locale: string;
  rules: Record<string, Severity>;
  thresholds: A11yThresholds;
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
  fix?: A11yPatch;
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

export const DEFAULT_THRESHOLDS: A11yThresholds = {
  altMaxLength: 125,
  minFontSize: 14,
  allCapsMinLength: 20,
  minTouchTargetPx: 44,
};
