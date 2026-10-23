import type {
  AiFeatureName,
  AiProvider,
  AiReplay,
  AiReplayOutcome,
  AiRequestBase,
  AiTurnHandlers,
  AiTurnResult,
} from "@templatical/types";
import { CollaborationConflict, SdkError } from "@templatical/types";
import {
  AI_GENERATE_FIELDS,
  AI_ROUTES,
  AI_SESSION_HEADER,
  AI_WIRE_HEADER,
  AI_WIRE_VERSION,
  aiRoutePath,
  type AiDoneEvent,
  type AiRouteName,
  type AiWireEvent,
} from "../wire";
import {
  AI_TEMPLATE_CHANGED_MESSAGE,
  errorFromEvent,
  errorFromResponse,
  providerFailure,
} from "./errors";
import { readSse } from "./sse";

export type HttpAiFeatures = Partial<
  Record<AiFeatureName | "conversation", boolean>
>;

export interface HttpAiProviderOptions {
  /** Where the wire's routes live: `{baseUrl}/templates/{t}/ai/…`. */
  baseUrl: string;
  /** Your auth headers, or a function (async for a token refresh) called per request. */
  headers?:
    | Record<string, string>
    | (() => Record<string, string> | Promise<Record<string, string>>);
  /** `fetch`'s `credentials`, for cookie auth. */
  credentials?: RequestCredentials;
  /** `false` turns a feature off, `conversation` included. Everything else is on. */
  features?: HttpAiFeatures;
}

function abortError(signal: AbortSignal): Error {
  const reason = signal.reason as unknown;
  return reason instanceof Error && reason.name === "AbortError"
    ? reason
    : new DOMException("The AI request was stopped.", "AbortError");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * An `AiProvider` over the wire (A1 §4): JSON or multipart requests, SSE
 * answers for turns and rewrite, JSON for history.
 * Errors are `SdkError`s; stopping a call rejects with an `AbortError`.
 */
export function createHttpAiProvider(
  options: HttpAiProviderOptions,
): AiProvider {
  return createHttpAiProviderWithFetch(options, (input, init) =>
    fetch(input, init),
  );
}

/** @internal A per-instance transport for wire conformance; not a package export. */
export function createHttpAiProviderWithFetch(
  options: HttpAiProviderOptions,
  fetchRequest: typeof fetch,
): AiProvider {
  const base = options.baseUrl.replace(/\/+$/, "");
  const on = (feature: AiFeatureName | "conversation") =>
    options.features?.[feature] !== false;

  async function request(
    route: AiRouteName,
    params: { template: string; message?: string; replayId?: string },
    init: {
      json?: unknown;
      form?: FormData;
      session?: string;
      stream?: boolean;
      signal?: AbortSignal;
    },
  ): Promise<Response> {
    init.signal?.throwIfAborted();
    const own =
      typeof options.headers === "function"
        ? await options.headers()
        : (options.headers ?? {});
    const headers = new Headers(own);
    headers.set(AI_WIRE_HEADER, AI_WIRE_VERSION);
    headers.set(
      "Accept",
      init.stream ? "text/event-stream" : "application/json",
    );
    if (init.session) headers.set(AI_SESSION_HEADER, init.session);
    let body: BodyInit | undefined;
    if (init.form) {
      body = init.form;
    } else if (init.json !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(init.json);
    }
    let response: Response;
    try {
      init.signal?.throwIfAborted();
      response = await fetchRequest(`${base}${aiRoutePath(route, params)}`, {
        method: AI_ROUTES[route].method,
        headers,
        body,
        ...(options.credentials ? { credentials: options.credentials } : {}),
        signal: init.signal,
      });
    } catch (error) {
      if (init.signal?.aborted) throw abortError(init.signal);
      throw error instanceof SdkError ? error : providerFailure();
    }
    if (!response.ok) throw await errorFromResponse(response);
    return response;
  }

  /**
   * One streamed call. `each` handles every event before `done`; it may
   * throw to end the call (a refusal, the editor's own error), which aborts
   * the request.
   */
  async function streamed<T>(
    route: AiRouteName,
    template: string,
    init: { json?: unknown; form?: FormData; session?: string },
    signal: AbortSignal,
    // Never called with `done` or `error`: those end the call first.
    each: (event: AiWireEvent) => Promise<void> | void,
    done: (event: AiDoneEvent) => T | undefined,
  ): Promise<T> {
    const controller = new AbortController();
    const stop = () => controller.abort(signal.reason);
    if (signal.aborted) stop();
    signal.addEventListener("abort", stop, { once: true });
    try {
      const response = await request(
        route,
        { template },
        {
          ...init,
          stream: true,
          signal: controller.signal,
        },
      );
      if (!response.body) throw providerFailure();
      for await (const event of readSse(response.body)) {
        if (signal.aborted) {
          // Already received server edits still need reconciliation after Stop.
          if (event.type === "applied") await each(event);
          if (event.type === "done" || event.type === "error")
            throw abortError(signal);
          continue;
        }
        if (event.type === "error") throw errorFromEvent(event);
        if (event.type === "done") {
          const value = done(event);
          if (value === undefined) throw providerFailure();
          return value;
        }
        await each(event);
      }
      throw providerFailure();
    } catch (error) {
      if (signal.aborted) throw abortError(signal);
      controller.abort();
      if (error instanceof SdkError) throw error;
      if (error instanceof Error && error.name === "AbortError") throw error;
      if (error instanceof Error && !(error instanceof TypeError)) throw error;
      throw providerFailure();
    } finally {
      signal.removeEventListener("abort", stop);
    }
  }

  function turn(
    route: "generate" | "fixFinding",
    req: AiRequestBase,
    init: { json?: unknown; form?: FormData },
    handlers: AiTurnHandlers,
    signal: AbortSignal,
  ): Promise<AiTurnResult> {
    let text = "";
    return streamed(
      route,
      req.templateId,
      { ...init, session: req.sessionId },
      signal,
      async (event) => {
        if (event.type === "text") {
          text += event.text;
          handlers.onText(event.text);
        } else if (event.type === "operations") {
          const result = await handlers.onOperations(event.ops);
          if (!result.applied) {
            // SSE is one-way: the backend can't be told mid-turn, so the
            // request ends here with the operation's own code (§4).
            throw new CollaborationConflict(AI_TEMPLATE_CHANGED_MESSAGE, {
              code: result.code,
              opIndex: result.opIndex,
            });
          }
        } else if (event.type === "applied") {
          handlers.onApplied({
            batchId: event.batchId,
            revision: event.revision,
            operationCount: event.operationCount,
          });
        }
      },
      (done) =>
        typeof done.messageId === "string" || done.messageId === null
          ? { messageId: done.messageId, text }
          : undefined,
    );
  }

  async function json<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      throw providerFailure();
    }
  }

  async function replay(
    route: "undoMessage" | "redoMessage",
    templateId: string,
    messageId: string,
    sessionId: string,
  ): Promise<AiReplay> {
    const response = await request(
      route,
      { template: templateId, message: messageId },
      { session: sessionId },
    );
    const body = await json<{
      data?: {
        operations?: unknown;
        replayId?: unknown;
        batchId?: unknown;
        revision?: unknown;
      };
    }>(response);
    if (!isRecord(body)) throw providerFailure();
    const data = body.data ?? {};
    if (
      Array.isArray(data.operations) &&
      typeof data.replayId === "string" &&
      data.replayId !== ""
    )
      return { operations: data.operations, replayId: data.replayId };
    if (typeof data.batchId === "string" && typeof data.revision === "number") {
      return { applied: { batchId: data.batchId, revision: data.revision } };
    }
    throw providerFailure();
  }

  return {
    chatAttachments: on("chat") && on("chatAttachments"),
    chat: on("chat")
      ? (req, handlers, signal) => {
          const body = {
            message: req.message,
            selectedBlockId: req.selectedBlockId,
            mergeTags: req.mergeTags,
            content: req.content,
            revision: req.revision,
          };
          if (req.attachments.length === 0)
            return turn("generate", req, { json: body }, handlers, signal);
          const form = new FormData();
          form.set(AI_GENERATE_FIELDS.message, req.message);
          if (req.selectedBlockId !== null)
            form.set(AI_GENERATE_FIELDS.selectedBlockId, req.selectedBlockId);
          form.set(AI_GENERATE_FIELDS.mergeTags, JSON.stringify(req.mergeTags));
          form.set(AI_GENERATE_FIELDS.content, JSON.stringify(req.content));
          if (req.revision !== null)
            form.set(AI_GENERATE_FIELDS.revision, String(req.revision));
          for (const attachment of req.attachments)
            form.append(
              AI_GENERATE_FIELDS.attachment,
              attachment.file,
              attachment.name,
            );
          return turn("generate", req, { form }, handlers, signal);
        }
      : false,
    fixFinding: on("fixFinding")
      ? (req, handlers, signal) =>
          turn(
            "fixFinding",
            req,
            {
              json: {
                finding: req.finding,
                mergeTags: req.mergeTags,
                content: req.content,
                revision: req.revision,
              },
            },
            handlers,
            signal,
          )
      : false,
    rewrite: on("rewrite")
      ? (req, handlers, signal) =>
          streamed(
            "rewriteText",
            req.templateId,
            {
              json: {
                html: req.html,
                preset: req.preset,
                language: req.language,
                instruction: req.instruction,
                mergeTags: req.mergeTags,
              },
            },
            signal,
            (event) => {
              if (event.type === "text") handlers.onText(event.text);
            },
            (done) =>
              typeof done.html === "string" ? { html: done.html } : undefined,
          )
      : false,
    altText: on("altText")
      ? (req, signal) => {
          const { templateId, sessionId, ...body } = req;
          return streamed(
            "altText",
            templateId,
            { json: body, session: sessionId },
            signal,
            () => {},
            (done) =>
              typeof done.alt === "string" ? { alt: done.alt } : undefined,
          );
        }
      : false,
    ...(on("conversation")
      ? {
          conversation: {
            settleReplay: async (
              templateId: string,
              messageId: string,
              outcome: AiReplayOutcome,
            ) => {
              await request(
                "settleReplay",
                {
                  template: templateId,
                  message: messageId,
                  replayId: outcome.replayId,
                },
                {
                  session: outcome.sessionId,
                  json: {
                    direction: outcome.direction,
                    applied: outcome.applied,
                  },
                },
              );
            },
            list: async (templateId: string) => {
              const response = await request(
                "conversationMessages",
                { template: templateId },
                {},
              );
              const body = await json<{ data?: unknown }>(response);
              if (!isRecord(body)) throw providerFailure();
              if (!Array.isArray(body.data)) throw providerFailure();
              return body.data;
            },
            clear: async (templateId: string) => {
              await request("clearConversation", { template: templateId }, {});
            },
            undo: (
              templateId: string,
              messageId: string,
              context: { sessionId: string },
            ) =>
              replay("undoMessage", templateId, messageId, context.sessionId),
            redo: (
              templateId: string,
              messageId: string,
              context: { sessionId: string },
            ) =>
              replay("redoMessage", templateId, messageId, context.sessionId),
          },
        }
      : {}),
  };
}
