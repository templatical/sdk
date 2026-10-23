import type {
  AiAltTextRequest,
  AiMessageBatch,
  AiReplayContext,
  AiReplayOutcome,
  TemplateContent,
  AiChatMessage,
  AiChatRequest,
  AiFixRequest,
  AiMessageKind,
  AiProvider,
  AiRewriteRequest,
  AiTurnHandlers,
  AiTurnResult,
  Operation,
} from "@templatical/types";
import {
  applyOperations,
  invertOperations,
  CollaborationConflict,
  safeClone,
  SdkError,
} from "@templatical/types";
import { AI_TEMPLATE_CHANGED_MESSAGE, errorFromEvent } from "../client/errors";
import { AI_ERROR_MESSAGES, type AiWireEvent } from "../wire";

/** A wire event to play, or a pause. */
export type AiRecordedEvent = AiWireEvent | { delayMs: number };
/** Events, or events built from the request (to name its blocks). */
export type AiRecording<R> =
  AiRecordedEvent[] | ((request: R) => AiRecordedEvent[]);

export interface AiRecordedTurn {
  /** The first turn whose `match` fits the message plays; one without `match` always fits. */
  match?: RegExp;
  events: AiRecording<AiChatRequest>;
}

/** What the mock plays. A missing feature is off (`false`). */
export interface AiMockScript {
  chat?: false | AiRecordedTurn[];
  fixFinding?: false | AiRecording<AiFixRequest>;
  chatAttachments?: boolean;
  rewrite?: false | AiRecording<AiRewriteRequest>;
  altText?: false | AiRecording<AiAltTextRequest>;
  /** Keep a conversation in memory per template, with Undo and Redo. */
  conversation?: boolean;
  /** A pause before every event, in ms (0 by default). */
  delayMs?: number;
}

interface Stored {
  message: AiChatMessage;
  inverse: Operation[];
  after: TemplateContent | null;
}

function stopped(signal: AbortSignal): Error {
  const reason = signal.reason as unknown;
  return reason instanceof Error && reason.name === "AbortError"
    ? reason
    : new DOMException("The AI request was stopped.", "AbortError");
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(stopped(signal));
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(stopped(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

const failure = () =>
  new SdkError(AI_ERROR_MESSAGES.ai_provider_error, 502, "ai_provider_error");

/**
 * An `AiProvider` that plays recorded streams: for integrators' UI tests and
 * the playground's AI scene (no model, no keys). Turns apply their
 * `operations` through the editor's handlers like a real backend's; with
 * `conversation: true` it keeps history in memory, Undo answering the turn's
 * inverse and Redo the guarded inverse of Undo. Replays change history only
 * after settlement.
 */
export function createMockAiProvider(script: AiMockScript): AiProvider {
  const delay = script.delayMs ?? 0;
  const conversations = new Map<string, Stored[]>();
  const pending = new Map<
    string,
    {
      templateId: string;
      messageId: string;
      entry: Stored;
      direction: "undo" | "redo";
      sessionId: string;
    }
  >();

  async function play<R>(
    recording: AiRecording<R>,
    request: R,
    signal: AbortSignal,
    each: (event: AiWireEvent) => Promise<void> | void,
  ): Promise<Extract<AiWireEvent, { type: "done" }>> {
    const events =
      typeof recording === "function" ? recording(request) : recording;
    for (const event of events) {
      await wait("type" in event ? delay : event.delayMs, signal);
      if (!("type" in event)) continue;
      if (event.type === "error") throw errorFromEvent(event);
      if (event.type === "done") return event;
      await each(event);
    }
    throw failure();
  }

  async function turn<
    R extends {
      templateId: string;
      content: TemplateContent;
      attachments?: { name: string; kind: "image" | "pdf" }[];
    },
  >(
    kind: AiMessageKind,
    userText: string,
    recording: AiRecording<R>,
    request: R,
    on: AiTurnHandlers,
    signal: AbortSignal,
  ): Promise<AiTurnResult> {
    let text = "";
    let inverse: Operation[] = [];
    let after = safeClone(request.content);
    const batches: AiMessageBatch[] = [];
    const done = await play(recording, request, signal, async (event) => {
      if (event.type === "text") {
        text += event.text;
        on.onText(event.text);
      } else if (event.type === "operations") {
        const result = await on.onOperations(safeClone(event.ops));
        if (!result.applied) {
          throw new CollaborationConflict(AI_TEMPLATE_CHANGED_MESSAGE, {
            code: result.code,
            opIndex: result.opIndex,
          });
        }
        // Store the wire snapshot's inverse, as a backend does. The editor may
        // normalize rich text before returning its own local inverse.
        inverse = [...invertOperations(after, event.ops), ...inverse];
        after = applyOperations(after, event.ops);
        batches.push({
          batchId: crypto.randomUUID(),
          revision: null,
          operationCount: event.ops.length,
        });
      } else if (event.type === "applied") {
        on.onApplied({
          batchId: event.batchId,
          revision: event.revision,
          operationCount: event.operationCount,
        });
        batches.push({
          batchId: event.batchId,
          revision: event.revision,
          operationCount: event.operationCount,
        });
      }
    });
    let messageId = done.messageId ?? null;
    if (script.conversation) {
      const history = conversations.get(request.templateId) ?? [];
      conversations.set(request.templateId, history);
      const createdAt = new Date().toISOString();
      history.push({
        message: {
          id: crypto.randomUUID(),
          role: "user",
          kind,
          text: userText,
          ...(request.attachments?.length
            ? {
                attachments: request.attachments.map(({ name, kind }) => ({
                  name,
                  kind,
                })),
              }
            : {}),
          batches: [],
          undone: false,
          createdAt,
        },
        inverse: [],
        after: null,
      });
      messageId = crypto.randomUUID();
      history.push({
        message: {
          id: messageId,
          role: "assistant",
          kind,
          text,
          batches,
          undone: false,
          createdAt,
        },
        inverse,
        after,
      });
    }
    return { messageId, text };
  }

  function stored(templateId: string, messageId: string): Stored {
    const entry = conversations
      .get(templateId)
      ?.find(
        (item) =>
          item.message.id === messageId && item.message.role === "assistant",
      );
    if (!entry)
      throw new SdkError(
        "That message isn't in this conversation.",
        404,
        "not_found",
      );
    return entry;
  }

  return {
    chatAttachments: !!script.chat && script.chatAttachments === true,
    chat: script.chat
      ? (request, on, signal) => {
          const recorded = (script.chat as AiRecordedTurn[]).find(
            (candidate) =>
              !candidate.match || candidate.match.test(request.message),
          );
          if (!recorded) return Promise.reject(failure());
          return turn(
            "chat",
            request.message,
            recorded.events,
            request,
            on,
            signal,
          );
        }
      : false,
    fixFinding: script.fixFinding
      ? (request, on, signal) =>
          turn(
            "fix",
            `Fix: ${request.finding.message}`,
            script.fixFinding as AiRecording<AiFixRequest>,
            request,
            on,
            signal,
          )
      : false,
    rewrite: script.rewrite
      ? async (request, on, signal) => {
          const done = await play(
            script.rewrite as AiRecording<AiRewriteRequest>,
            request,
            signal,
            (event) => {
              if (event.type === "text") on.onText(event.text);
            },
          );
          if (typeof done.html !== "string") throw failure();
          return { html: done.html };
        }
      : false,
    altText: script.altText
      ? async (request, signal) => {
          const done = await play(
            script.altText as AiRecording<AiAltTextRequest>,
            request,
            signal,
            () => {},
          );
          if (typeof done.alt !== "string") throw failure();
          return { alt: done.alt };
        }
      : false,
    ...(script.conversation
      ? {
          conversation: {
            settleReplay: async (
              templateId: string,
              messageId: string,
              outcome: AiReplayOutcome,
            ) => {
              const replay = pending.get(outcome.replayId);
              if (
                !replay ||
                replay.templateId !== templateId ||
                replay.messageId !== messageId ||
                replay.direction !== outcome.direction ||
                replay.sessionId !== outcome.sessionId
              )
                return;
              pending.delete(outcome.replayId);
              if (outcome.applied)
                replay.entry.message.undone = outcome.direction === "undo";
            },
            list: async (templateId: string) =>
              safeClone(
                (conversations.get(templateId) ?? []).map(
                  (item) => item.message,
                ),
              ),
            clear: async (templateId: string) => {
              conversations.delete(templateId);
              for (const [id, replay] of pending)
                if (replay.templateId === templateId) pending.delete(id);
            },
            undo: async (
              templateId: string,
              messageId: string,
              context: AiReplayContext,
            ) => {
              const entry = stored(templateId, messageId);
              if (entry.message.undone || entry.inverse.length === 0) {
                throw new CollaborationConflict(
                  "This change is already undone.",
                  { code: "precondition_failed" },
                );
              }
              const replayId = crypto.randomUUID();
              pending.set(replayId, {
                templateId,
                messageId,
                entry,
                direction: "undo",
                sessionId: context.sessionId,
              });
              return { operations: safeClone(entry.inverse), replayId };
            },
            redo: async (
              templateId: string,
              messageId: string,
              context: AiReplayContext,
            ) => {
              const entry = stored(templateId, messageId);
              if (!entry.message.undone) {
                throw new CollaborationConflict("This change isn't undone.", {
                  code: "precondition_failed",
                });
              }
              const operations = invertOperations(entry.after!, entry.inverse);
              const replayId = crypto.randomUUID();
              pending.set(replayId, {
                templateId,
                messageId,
                entry,
                direction: "redo",
                sessionId: context.sessionId,
              });
              return { operations, replayId };
            },
          },
        }
      : {}),
  };
}
