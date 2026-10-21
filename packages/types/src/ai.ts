import type { SyntaxPresetName } from "./merge-tags";
import type { Operation, OperationErrorCode } from "./operations";
import type { TemplateContent } from "./template";

// ---------------------------------------------------------------------------
// Merge tags, as an AI backend reads them
// ---------------------------------------------------------------------------

/** The editor's merge-tag syntax: a built-in preset's name, or `custom`. */
export type AiMergeTagSyntax = SyntaxPresetName | "custom";

/** One declared merge tag. Never `sample` or `onRequest`. */
export interface AiMergeTag {
  value: string;
  label: string;
  group?: string;
  description?: string;
}

/**
 * The editor's merge tags: write tags as their bare `value` in this syntax,
 * and no others. At most 500 tags; `value` ≤ 200, `label` ≤ 100, `group` ≤ 100,
 * `description` ≤ 200 characters.
 */
export interface AiMergeTags {
  syntax: AiMergeTagSyntax;
  tags: AiMergeTag[];
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** What every AI request carries. */
export interface AiRequestBase {
  templateId: string;
  /**
   * The template as the editor has it, after it sent its pending edits. A
   * backend that holds the template itself (Templatical Cloud) ignores it.
   */
  content: TemplateContent;
  /** The collaboration revision `content` is at, or `null` without collaboration. */
  revision: number | null;
  /** The editor session (`X-Templatical-Session` on the wire). */
  sessionId: string;
  /** `null` when the editor declares none. */
  mergeTags: AiMergeTags | null;
}

export interface AiChatRequest extends AiRequestBase {
  /** 1–4,000 characters. */
  message: string;
  /** The selected block, when the backend has it; `null` otherwise. */
  selectedBlockId: string | null;
}

export type ScoringCategory = "spam" | "readability" | "bestPractices";
export type FindingSeverity = "high" | "medium" | "low";

/** A scoring finding to fix, as the editor sends it. */
export interface AiFixFinding {
  id: string;
  message: string;
  suggestion: string;
  category: ScoringCategory;
  /** `null` when the finding is about the whole template. */
  blockId: string | null;
}

export interface AiFixRequest extends AiRequestBase {
  finding: AiFixFinding;
}

export interface AiDesignRequest extends AiRequestBase {
  /** Notes from the user, ≤ 2,000 characters. */
  prompt: string | null;
  /** A PNG, JPEG, WebP or GIF image, or a PDF; ≤ 5 MB. */
  file: Blob;
  fileKind: "image" | "pdf";
}

export type AiRewritePreset =
  "shorten" | "expand" | "friendlier" | "formal" | "fixGrammar" | "translate";

export interface AiRewriteRequest extends AiRequestBase {
  /**
   * The paragraph's HTML (1–20,000 characters), merge tags as the editor's
   * tags (`<span data-merge-tag="{{first_name}}" …>`).
   */
  html: string;
  preset: AiRewritePreset | null;
  /** A BCP 47 tag; set when `preset` is `translate`. */
  language: string | null;
  /** ≤ 500 characters. At least one of `preset` and `instruction` is set. */
  instruction: string | null;
}

/** A finding of the editor's linter, sent as context so scoring doesn't repeat it. */
export interface AiLintFinding {
  ruleId: string;
  blockId: string | null;
  message: string;
}

export interface AiScoreRequest extends AiRequestBase {
  /** At most 200. */
  lintFindings: AiLintFinding[];
}

export type AiSuggestionsRequest = AiRequestBase;

// ---------------------------------------------------------------------------
// Turns
// ---------------------------------------------------------------------------

/** A batch a backend applied to the template itself. */
export interface AiAppliedBatch {
  batchId: string;
  revision: number;
  operationCount: number;
}

/** What the editor answers for a batch of operations it was handed. */
export type AiOperationsResult =
  | { applied: true; inverse: Operation[] }
  | {
      applied: false;
      code: OperationErrorCode;
      opIndex: number;
      message: string;
    };

/**
 * What a chat, fix or design turn reports as it runs. A turn hands its edits
 * over one of two ways, and may mix them:
 *
 * - `onOperations`: the editor applies the batch at once and answers with its
 *   inverse, or with why it refused (another person holds a block, the
 *   template changed). A turn's batches form one undo step.
 * - `onApplied`: the backend already applied the batch to its copy. The editor
 *   follows the collaboration revision, or reloads the template when the turn
 *   ends; with neither a collaboration nor a templates provider it refuses.
 */
export interface AiTurnHandlers {
  onText(text: string): void;
  onOperations(ops: Operation[]): Promise<AiOperationsResult>;
  onApplied(batch: AiAppliedBatch): void;
}

export interface AiRewriteHandlers {
  /** A chunk of the rewritten text, for a live preview. */
  onText(text: string): void;
}

export interface AiTurnResult {
  /** The assistant message's id in `conversation`, or `null` without history. */
  messageId: string | null;
  /** The whole reply. */
  text: string;
}

/** What Undo or Redo of a message returns: operations to apply, or a batch applied. */
export type AiReplay =
  | { operations: Operation[]; replayId: string }
  | { applied: { batchId: string; revision: number } };

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export type AiMessageKind = "chat" | "fix" | "design";

/**
 * A batch an assistant message applied: `revision` is the backend's for a
 * batch the server applied, `null` for one the editor applied itself.
 */
export interface AiMessageBatch {
  batchId: string;
  revision: number | null;
  operationCount: number;
}

/** One message of a template's AI conversation. */
export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  kind: AiMessageKind;
  /** A fix's user message reads "Fix: {message}"; a design's "Built from design". */
  text: string;
  /** What the assistant's turn applied; empty for user messages. */
  batches: AiMessageBatch[];
  /** `true` after Undo, `false` after Redo. */
  undone: boolean;
  /** ISO 8601. */
  createdAt: string;
}

/**
 * A stored conversation per template: the chat panel loads it, and Undo and
 * Redo work after a reload. Without it the chat lives in memory.
 */
export interface AiConversationProvider {
  /** Settle an editor-applied replay, idempotently, after applying or refusing it. */
  settleReplay(
    templateId: string,
    messageId: string,
    outcome: AiReplayOutcome,
  ): Promise<void>;
  /** Oldest first. */
  list(templateId: string): Promise<AiChatMessage[]>;
  /** New chat; `false` hides the button. */
  clear: false | ((templateId: string) => Promise<void>);
  undo:
    | false
    | ((
        templateId: string,
        messageId: string,
        context: AiReplayContext,
      ) => Promise<AiReplay>);
  redo:
    | false
    | ((
        templateId: string,
        messageId: string,
        context: AiReplayContext,
      ) => Promise<AiReplay>);
}

/**
 * The outcome of an editor-applied replay. The backend changes `undone` only
 * on `applied: true`; a refusal or an unsettled replay leaves it unchanged.
 * Settlement is idempotent per `replayId`: later settlements are no-ops.
 * A server-applied replay is never settled.
 */
export interface AiReplayOutcome {
  replayId: string;
  direction: "undo" | "redo";
  applied: boolean;
  sessionId: string;
}

/** Who asks for an Undo or Redo: the editor session (`X-Templatical-Session` on the wire). */
export interface AiReplayContext {
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface ScoringFinding {
  id: string;
  severity: FindingSeverity;
  message: string;
  /** `null` when the finding isn't about one block. */
  blockId: string | null;
  suggestion: string;
}

export interface CategoryScore {
  /** An integer 0–100. */
  score: number;
  findings: ScoringFinding[];
}

export interface ScoringResult {
  /** An integer 0–100. */
  score: number;
  categories: Record<ScoringCategory, CategoryScore>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * The codes an AI provider rejects with, as `SdkError.code`. Undo and Redo may
 * also reject with S6's operation codes (`precondition_failed`, …) as a
 * `CollaborationConflict`, and a `rate_limited` rejection is a
 * `ThrottledError`. An `AbortError` means the turn was stopped.
 */
export type AiErrorCode =
  | "feature_unavailable"
  | "limit_reached"
  | "rate_limited"
  | "ai_turn_running"
  | "content_too_large"
  | "ai_output_invalid"
  | "ai_provider_error";

/** `limit_reached`'s `details`. */
export interface AiLimitDetails extends Readonly<Record<string, unknown>> {
  /** Which allowance ran out, in the backend's words (`aiMonthly`). */
  limit: string;
  /** ISO 8601: when it renews. */
  resetsAt: string;
}

// ---------------------------------------------------------------------------
// The provider
// ---------------------------------------------------------------------------

/**
 * The bring-your-own AI contract: `init({ ai })`. One member per feature,
 * `false` when you don't offer it (the editor hides its entry point), a
 * function when you do. Every call gets an `AbortSignal`; stopping a turn
 * aborts it, and the rejection is an `AbortError`.
 *
 * Reject with an `SdkError` whose `code` is an `AiErrorCode` and whose
 * message the user can read. `@templatical/ai-kit/client`'s
 * `createHttpAiProvider` implements this over a documented REST and SSE wire;
 * Templatical Cloud is one backend for it.
 */
export interface AiProvider {
  chat:
    | false
    | ((
        request: AiChatRequest,
        on: AiTurnHandlers,
        signal: AbortSignal,
      ) => Promise<AiTurnResult>);
  fixFinding:
    | false
    | ((
        request: AiFixRequest,
        on: AiTurnHandlers,
        signal: AbortSignal,
      ) => Promise<AiTurnResult>);
  design:
    | false
    | ((
        request: AiDesignRequest,
        on: AiTurnHandlers,
        signal: AbortSignal,
      ) => Promise<AiTurnResult>);
  rewrite:
    | false
    | ((
        request: AiRewriteRequest,
        on: AiRewriteHandlers,
        signal: AbortSignal,
      ) => Promise<{ html: string }>);
  score:
    | false
    | ((
        request: AiScoreRequest,
        signal: AbortSignal,
      ) => Promise<ScoringResult>);
  suggestions:
    | false
    | ((
        request: AiSuggestionsRequest,
        signal: AbortSignal,
      ) => Promise<string[]>);
  conversation?: AiConversationProvider;
}

/** The provider's features: its members other than `conversation`. */
export type AiFeatureName = Exclude<keyof AiProvider, "conversation">;
