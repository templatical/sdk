import type {
  SyntaxPresetName,
  Operation,
  OperationErrorCode,
  TemplateContent,
} from "@templatical/types";

export type AiMergeTagSyntax = SyntaxPresetName | "custom";

export interface AiMergeTag {
  value: string;
  label: string;
  group?: string;
  description?: string;
}

export interface AiMergeTags {
  syntax: AiMergeTagSyntax;
  tags: AiMergeTag[];
}

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
  /** The editor syntax and declared tags; `tags` is empty when none are declared. */
  mergeTags: AiMergeTags;
}

export interface AiChatAttachment {
  file: Blob;
  kind: "image" | "pdf";
  name: string;
}

export interface AiChatRequest extends AiRequestBase {
  /** 1–4,000 characters. */
  message: string;
  /** The selected block, when the backend has it; `null` otherwise. */
  selectedBlockId: string | null;
  /** Always present; at most 4 files, each at most 5 MB, at most 10 MB together. */
  attachments: AiChatAttachment[];
}

export interface AiFixFinding {
  /** Non-empty lint rule id, at most 200 characters. */
  ruleId: string;
  /** The problem, at most 1,000 code points. */
  message: string;
  /** The linter's suggested action, at most 1,000 code points. */
  suggestion: string;
  /** Rule docs URL: http(s), at most 2,048 characters; never fetched by the model. */
  reference: string;
  /** Block id (at most 200 characters), or null for a template-level finding. */
  blockId: string | null;
  /** Diagnostic excerpt when supplied by the rule, at most 1,000 code points. */
  excerpt?: string;
}

export interface AiFixRequest extends AiRequestBase {
  finding: AiFixFinding;
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

export interface AiAltTextRequest {
  templateId: string;
  sessionId: string;
  blockId: string;
  image: { url: string };
  currentAlt: string | null;
  linkHref: string | null;
  /** Plain text, at most 2,000 code points. */
  nearbyText: string;
  locale: string;
  /** Effective lint altMaxLength: integer 1–1,000, counted as string.length. */
  maxLength: number;
}

export interface AiAppliedBatch {
  batchId: string;
  revision: number;
  operationCount: number;
}

export type AiOperationsResult =
  | { applied: true; inverse: Operation[] }
  | {
      applied: false;
      code: OperationErrorCode;
      opIndex: number;
      message: string;
    };

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

export type AiReplay =
  | { operations: Operation[]; replayId: string }
  | { applied: { batchId: string; revision: number } };

export type AiMessageKind = "chat" | "fix";

export interface AiMessageBatch {
  batchId: string;
  revision: number | null;
  operationCount: number;
}

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  kind: AiMessageKind;
  /** The author's message, a fix's "Fix: {message}", or the assistant's reply. */
  text: string;
  /** Reference metadata on user messages only; file retention is the backend's choice. */
  attachments?: { name: string; kind: "image" | "pdf" }[];
  /** What the assistant's turn applied; empty for user messages. */
  batches: AiMessageBatch[];
  /** `true` after Undo, `false` after Redo. */
  undone: boolean;
  /** ISO 8601. */
  createdAt: string;
}

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

export interface AiReplayOutcome {
  replayId: string;
  direction: "undo" | "redo";
  applied: boolean;
  sessionId: string;
}

export interface AiReplayContext {
  sessionId: string;
}

export type AiErrorCode =
  | "feature_unavailable"
  | "limit_reached"
  | "rate_limited"
  | "ai_turn_running"
  | "content_too_large"
  | "ai_output_invalid"
  | "ai_provider_error";

export interface AiLimitDetails extends Readonly<Record<string, unknown>> {
  /** Which allowance ran out, in the backend's words (`aiMonthly`). */
  limit: string;
  /** ISO 8601: when it renews. */
  resetsAt: string;
}

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
  /** True means chat accepts attachments; has no effect while chat is false. */
  chatAttachments: false | true;
  rewrite:
    | false
    | ((
        request: AiRewriteRequest,
        on: AiRewriteHandlers,
        signal: AbortSignal,
      ) => Promise<{ html: string }>);
  altText:
    | false
    | ((
        request: AiAltTextRequest,
        signal: AbortSignal,
      ) => Promise<{ alt: string }>);
  conversation?: AiConversationProvider;
}

export type AiFeatureName = Exclude<keyof AiProvider, "conversation">;
