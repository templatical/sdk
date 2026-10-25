import type {
  AiAppliedBatch,
  AiAltTextRequest,
  AiChatMessage,
  AiChatAttachment,
  AiErrorCode,
  AiFixFinding,
  AiMergeTags,
  AiRewritePreset,
  Operation,
  TemplateContent,
} from "@templatical/types";

/** Sent as {@link AI_WIRE_HEADER} on every request and response. */
export const AI_WIRE_VERSION = "1";
export const AI_WIRE_HEADER = "Templatical-AI-Wire";
/** The editor session, on turns, Undo, Redo and replay settlement. */
export const AI_SESSION_HEADER = "X-Templatical-Session";

export type AiRouteName =
  | "generate"
  | "fixFinding"
  | "rewriteText"
  | "altText"
  | "conversationMessages"
  | "undoMessage"
  | "redoMessage"
  | "clearConversation"
  | "settleReplay";

export interface AiRoute {
  method: "GET" | "POST" | "DELETE";
  /** Relative to the base URL the integrator chooses. */
  path: string;
}

/** The wire's routes (A1 §4). */
export const AI_ROUTES: Readonly<Record<AiRouteName, AiRoute>> = {
  generate: { method: "POST", path: "/templates/{template}/ai/generate" },
  fixFinding: { method: "POST", path: "/templates/{template}/ai/fix-finding" },
  rewriteText: {
    method: "POST",
    path: "/templates/{template}/ai/rewrite-text",
  },
  altText: { method: "POST", path: "/templates/{template}/ai/alt-text" },
  conversationMessages: {
    method: "GET",
    path: "/templates/{template}/ai/conversation-messages",
  },
  undoMessage: {
    method: "POST",
    path: "/templates/{template}/ai/messages/{message}/undo",
  },
  redoMessage: {
    method: "POST",
    path: "/templates/{template}/ai/messages/{message}/redo",
  },
  settleReplay: {
    method: "POST",
    path: "/templates/{template}/ai/messages/{message}/replays/{replayId}",
  },
  clearConversation: {
    method: "DELETE",
    path: "/templates/{template}/ai/conversation",
  },
};

/** A route's path with its ids filled in, each URI-encoded. */
export function aiRoutePath(
  route: AiRouteName,
  params: { template: string; message?: string; replayId?: string },
): string {
  return AI_ROUTES[route].path.replace(
    /\{(template|message|replayId)\}/g,
    (_, key: "template" | "message" | "replayId") =>
      encodeURIComponent(params[key] ?? ""),
  );
}

export interface AiRouteMatch {
  route: AiRouteName;
  template: string;
  message: string | null;
  replayId?: string;
}

const MATCHERS = (Object.keys(AI_ROUTES) as AiRouteName[]).map((route) => ({
  route,
  method: AI_ROUTES[route].method,
  pattern: new RegExp(
    `${AI_ROUTES[route].path
      .replace("{template}", "([^/]+)")
      .replace("{message}", "([^/]+)")
      .replace("{replayId}", "([^/]+)")}$`,
  ),
  hasMessage: AI_ROUTES[route].path.includes("{message}"),
}));

/**
 * Which route a request is, whatever path the backend mounts the wire under:
 * the route must end the pathname. `null` for anything else.
 */
export function matchAiRoute(
  method: string,
  pathname: string,
): AiRouteMatch | null {
  const upper = method.toUpperCase();
  for (const matcher of MATCHERS) {
    if (matcher.method !== upper) continue;
    const found = matcher.pattern.exec(pathname);
    if (!found) continue;
    try {
      return {
        route: matcher.route,
        template: decodeURIComponent(found[1]),
        message: matcher.hasMessage ? decodeURIComponent(found[2]) : null,
        ...(matcher.route === "settleReplay"
          ? { replayId: decodeURIComponent(found[3]) }
          : {}),
      };
    } catch (error) {
      if (error instanceof URIError) return null;
      throw error;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Server-sent events: `data: {json}` lines, `: ping` comments
// ---------------------------------------------------------------------------

/** A chunk of the reply (chat, fix) or of the rewritten text. */
export interface AiTextEvent {
  type: "text";
  text: string;
}

/** Operations for the editor to apply (new in A1). */
export interface AiOperationsEvent {
  type: "operations";
  ops: Operation[];
}

/** A batch the backend applied to its copy of the template. */
export interface AiAppliedEvent extends AiAppliedBatch {
  type: "applied";
}

/** The last event of a successful stream: turns require `messageId`, or `null`
 * without history; rewrite requires `html`.
 */
export type AiDoneEvent = { type: "done" } & (
  | { messageId: string | null; html?: never; alt?: never }
  | { html: string; messageId?: never; alt?: never }
  | { alt: string; messageId?: never; html?: never }
);

/** The last event of a failed stream; other fields are the error's details. */
export interface AiErrorEvent {
  type: "error";
  code: string;
  message: string;
  [detail: string]: unknown;
}

export type AiWireEvent =
  AiTextEvent | AiOperationsEvent | AiAppliedEvent | AiDoneEvent | AiErrorEvent;

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

export type AiAltTextBody = Omit<AiAltTextRequest, "templateId" | "sessionId">;

export interface AiGenerateBody {
  attachments: AiChatAttachment[];
  message: string;
  selectedBlockId: string | null;
  mergeTags: AiMergeTags;
  content: TemplateContent;
  revision: number | null;
}

export interface AiFixFindingBody {
  finding: AiFixFinding;
  mergeTags: AiMergeTags;
  content: TemplateContent;
  revision: number | null;
}

export interface AiRewriteBody {
  html: string;
  preset: AiRewritePreset | null;
  language: string | null;
  instruction: string | null;
  mergeTags: AiMergeTags;
}

/** The multipart fields of generate; mergeTags and content are JSON strings. */
export const AI_GENERATE_FIELDS = {
  message: "message",
  selectedBlockId: "selectedBlockId",
  mergeTags: "mergeTags",
  content: "content",
  revision: "revision",
  attachment: "attachment",
} as const;

/** `GET …/conversation-messages`. */
export interface AiConversationResponse {
  data: AiChatMessage[];
}

/** `POST …/messages/{m}/undo` and `…/redo`. */
export interface AiReplayResponse {
  data:
    | { operations: Operation[]; replayId: string }
    | { batchId: string; revision: number };
}

// ---------------------------------------------------------------------------
// Errors and limits
// ---------------------------------------------------------------------------

/** The HTTP status each code answers with before a stream starts. */
export const AI_ERROR_STATUS: Readonly<Record<string, number>> = {
  feature_unavailable: 403,
  limit_reached: 403,
  rate_limited: 429,
  ai_turn_running: 409,
  content_too_large: 413,
  ai_output_invalid: 422,
  ai_provider_error: 502,
  not_found: 404,
  block_exists: 409,
  block_missing: 409,
  anchor_missing: 409,
  precondition_failed: 409,
  lock_held: 409,
  locked_by_others: 409,
  invalid_operation: 422,
};

/** Default messages, user-presentable, for the AI codes. */
export const AI_ERROR_MESSAGES: Readonly<Record<AiErrorCode, string>> = {
  feature_unavailable: "This AI feature isn't available.",
  limit_reached: "You've used up your AI allowance for now.",
  rate_limited: "Too many AI requests. Try again in a moment.",
  ai_turn_running: "An AI request is already running on this template.",
  content_too_large: "This template is too large for AI.",
  ai_output_invalid: "The AI couldn't produce a valid result. Try again.",
  ai_provider_error: "AI is unavailable right now. Try again later.",
};

/** The wire's request limits (S7 Y3), shared by the client and the kit. */
export const AI_LIMITS = {
  contentMaxBytes: 200_000,
  messageMaxChars: 4000,
  attachmentsMax: 4,
  attachmentMaxBytes: 5 * 1024 * 1024,
  attachmentsTotalMaxBytes: 10 * 1024 * 1024,
  rewriteHtmlMaxChars: 20_000,
  instructionMaxChars: 500,
  mergeTagsMax: 500,
  opsPerBatchMax: 100,
} as const;
