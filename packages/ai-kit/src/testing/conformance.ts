import type {
  AiAltTextRequest,
  AiFeatureName,
  AiMergeTags,
  AiProvider,
  AiReplay,
  AiRequestBase,
  TemplateContent,
} from "@templatical/types";
import { safeClone } from "@templatical/types";
import {
  AI_CONFORMANCE_ALT_TEXT_IMAGE_URL,
  AI_EVAL_MERGE_TAGS,
  AI_EVAL_TEMPLATES,
} from "./eval-set";
import { describeError, errorProblem, messageProblem } from "./checks";
import { createStandInEditor } from "./stand-in-editor";

export interface AiConformanceCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface AiConformanceReport {
  ok: boolean;
  checks: AiConformanceCheck[];
}

export interface AiConformanceOptions {
  /** The template the suite edits; the test set's welcome email by default. */
  content?: TemplateContent;
  templateId?: string;
  /** Public probe image URL; defaults to AI_CONFORMANCE_ALT_TEXT_IMAGE_URL. */
  altTextImageUrl?: string;
  mergeTags?: AiMergeTags;
  /** How long a stopped call may take to reject (D35). */
  timeoutMs?: number;
  /** An optional shorter call limit; every call is also bounded by `timeoutMs`. */
  callTimeoutMs?: number;
}

const FEATURES: Exclude<AiFeatureName, "chatAttachments">[] = [
  "chat",
  "fixFinding",
  "rewrite",
  "altText",
];

/** A 1×1 transparent PNG. */
export function tinyPng(): Blob {
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
}

const NO_RESULT = Symbol("call failed");

class ConformanceTimeoutError extends Error {
  override name = "TimeoutError";
}

/** @internal Bound the wait even when the operation ignores its signal. */
export async function withConformanceDeadline<T>(
  name: string,
  timeoutMs: number,
  run: (signal: AbortSignal) => T | PromiseLike<T>,
  controller = new AbortController(),
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new ConformanceTimeoutError(
        `${name}: timed out after ${timeoutMs} ms`,
      );
      reject(error);
      controller.abort(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => run(controller.signal)),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function preview(value: unknown): string {
  return typeof value === "string"
    ? JSON.stringify(value.slice(0, 80))
    : value === null
      ? "null"
      : typeof value;
}

/** @internal Keep a malformed value or diagnostic inside its own check. */
export async function evaluateConformanceCheck(
  name: string,
  evaluate: () =>
    | { ok: boolean; detail?: string }
    | Promise<{ ok: boolean; detail?: string }>,
): Promise<AiConformanceCheck> {
  try {
    const { ok, detail = "ok" } = await evaluate();
    return { name, ok, detail };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : preview(error),
    };
  }
}

/**
 * Drive a provider as the editor would and check the contract (A1 §6): any
 * test runner, never throws on a failed check. Each declared feature runs
 * once against a stand-in editor that applies `operations` with the engine.
 */
export async function runAiProviderConformance(
  provider: AiProvider,
  options: AiConformanceOptions = {},
): Promise<AiConformanceReport> {
  const checks: AiConformanceCheck[] = [];
  const add = async (
    name: string,
    evaluate: Parameters<typeof evaluateConformanceCheck>[1],
  ): Promise<boolean> => {
    const check = await evaluateConformanceCheck(name, evaluate);
    checks.push(check);
    return check.ok;
  };
  const timeoutMs = options.timeoutMs ?? 5000;
  const callTimeoutMs = Math.min(options.callTimeoutMs ?? timeoutMs, timeoutMs);
  const templateId = options.templateId ?? "conformance";
  const editor = createStandInEditor(
    options.content ?? AI_EVAL_TEMPLATES.welcome,
    options.mergeTags ?? AI_EVAL_MERGE_TAGS,
  );
  const errors: unknown[] = [];
  const probes: Partial<
    Record<AiFeatureName, (signal: AbortSignal) => Promise<unknown>>
  > = {};
  const base = (): AiRequestBase => ({
    templateId,
    content: safeClone(editor.content),
    revision: null,
    sessionId: editor.sessionId,
    mergeTags: editor.mergeTags,
  });

  async function call<T>(
    name: string,
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T | typeof NO_RESULT> {
    try {
      return await withConformanceDeadline(name, callTimeoutMs, run);
    } catch (error) {
      if (!(error instanceof ConformanceTimeoutError)) errors.push(error);
      await add(`${name}: answers`, () => ({
        ok: false,
        detail: describeError(error),
      }));
      return NO_RESULT;
    }
  }

  const declared = FEATURES.filter(
    (feature) => typeof provider[feature] === "function",
  );
  await add("declares at least one feature", () => ({
    ok: declared.length > 0,
    detail: `declared: ${declared.join(", ") || "none"}`,
  }));
  for (const feature of FEATURES) {
    const member: unknown = provider[feature];
    if (member !== false && typeof member !== "function") {
      await add(`${feature}: false or a function`, () => ({
        ok: false,
        detail: `got ${typeof member}`,
      }));
    } else if (member === false) {
      await add(`${feature}: off`, () => ({
        ok: true,
        detail: `skipped: ${feature} is false`,
      }));
    }
  }

  // Turns first: they change the stand-in's template.
  let lastAssistantId: string | null = null;
  if (typeof provider.chat === "function") {
    const chat = provider.chat;
    probes.chat = (signal) =>
      chat(
        {
          ...base(),
          message: "Make the button green",
          selectedBlockId: null,
          attachments: [],
        },
        createStandInEditor(editor.content).handlers(),
        signal,
      );
    const handlers = editor.handlers();
    const result = await call("chat", (signal) =>
      chat(
        {
          ...base(),
          message:
            "Change the headline to 'Hello there' and keep the first name in it",
          selectedBlockId: null,
          attachments: [],
        },
        handlers,
        signal,
      ),
    );
    if (result !== NO_RESULT) {
      await add("chat: streams text and resolves with it", () => {
        const text = result?.text;
        const messageId = result?.messageId;
        if (messageId === null || typeof messageId === "string")
          lastAssistantId = messageId;
        return {
          ok:
            typeof text === "string" &&
            (messageId === null || typeof messageId === "string") &&
            (handlers.text === "" || text === handlers.text),
          detail: `streamed ${preview(handlers.text)}, resolved ${preview(text)}`,
        };
      });
    }
  }
  if (typeof provider.fixFinding === "function") {
    const fix = provider.fixFinding;
    probes.fixFinding = (signal) =>
      fix(
        {
          ...base(),
          finding: {
            ruleId: "a11y.button-vague-label",
            message: "The button text doesn't say what happens.",
            suggestion: "Say where the button goes.",
            reference:
              "https://docs.templatical.com/quality/accessibility/rule-catalog#buttons",
            blockId: null,
          },
        },
        createStandInEditor(editor.content).handlers(),
        signal,
      );
    const result = await call("fixFinding", (signal) =>
      fix(
        {
          ...base(),
          finding: {
            ruleId: "a11y.button-vague-label",
            message: "The button text doesn't say what happens.",
            suggestion: "Say where the button goes.",
            reference:
              "https://docs.templatical.com/quality/accessibility/rule-catalog#buttons",
            blockId: null,
          },
        },
        editor.handlers(),
        signal,
      ),
    );
    if (result !== NO_RESULT)
      await add("fixFinding: answers", () => ({
        ok: typeof result?.text === "string",
      }));
  }
  if (
    provider.chatAttachments === true &&
    typeof provider.chat === "function"
  ) {
    const chat = provider.chat;
    const result = await call("chatAttachments", (signal) =>
      chat(
        {
          ...base(),
          message: "Use this reference",
          selectedBlockId: null,
          attachments: [
            { file: tinyPng(), kind: "image", name: "reference.png" },
          ],
        },
        editor.handlers(),
        signal,
      ),
    );
    if (result !== NO_RESULT)
      await add("chatAttachments: answers", () => ({
        ok: typeof result?.text === "string" && result.text.trim() !== "",
      }));
  } else {
    await add("chatAttachments: off", () => ({
      ok: true,
      detail: "skipped: chatAttachments or chat is false",
    }));
  }

  await add("operations apply cleanly to the snapshot", () => ({
    ok: editor.refused.length === 0,
    detail:
      editor.refused.length === 0
        ? `${editor.applied.length} batch(es) applied`
        : editor.refused
            .map(
              (refusal) =>
                `${refusal.code} at op ${refusal.opIndex}: ${refusal.message}`,
            )
            .join("; "),
  }));
  await add("applied events carry increasing revisions", () => {
    const revisions = editor.serverBatches.map((batch) => batch.revision);
    return {
      ok: editor.serverBatches.every(
        (batch, index) =>
          typeof batch.batchId === "string" &&
          Number.isInteger(batch.revision) &&
          batch.operationCount >= 1 &&
          (index === 0 || batch.revision > revisions[index - 1]),
      ),
      detail:
        revisions.length === 0
          ? "no applied events"
          : `revisions ${revisions.join(", ")}`,
    };
  });

  // History.
  const conversation = provider.conversation;
  if (conversation) {
    const list = await call("conversation.list", () =>
      conversation.list(templateId),
    );
    if (list !== NO_RESULT) {
      const validMessages = await add(
        "conversation: lists messages in the Y7 shape",
        () => {
          const problem = Array.isArray(list)
            ? (list.map(messageProblem).find((p) => p !== null) ?? null)
            : "not a list";
          return {
            ok: problem === null,
            detail: problem ?? `${list.length} message(s)`,
          };
        },
      );
      await add("conversation: undo and redo replay", async () => {
        if (!validMessages)
          return { ok: false, detail: "cannot replay malformed messages" };
        const target =
          [...list]
            .reverse()
            .find(
              (message) =>
                message.role === "assistant" && message.batches.length > 0,
            )?.id ?? lastAssistantId;
        const { undo, redo } = conversation;
        if (
          !target ||
          typeof undo !== "function" ||
          typeof redo !== "function"
        ) {
          return {
            ok: true,
            detail: "nothing to undo, or undo/redo are false",
          };
        }
        let ok = true;
        const isOperations = (
          value: AiReplay | typeof NO_RESULT,
        ): value is Extract<AiReplay, { operations: unknown }> =>
          value !== NO_RESULT &&
          typeof value === "object" &&
          value !== null &&
          "operations" in value &&
          Array.isArray(value.operations) &&
          typeof value.replayId === "string" &&
          value.replayId !== "";
        const state = async () => {
          const rows = await call("conversation.list", () =>
            conversation.list(templateId),
          );
          return Array.isArray(rows)
            ? rows.find((row) => row.id === target)?.undone
            : undefined;
        };
        for (const [direction, step] of [
          ["undo", undo],
          ["redo", redo],
        ] as const) {
          const before = direction === "redo";
          let replay = await call(`conversation.${direction}`, () =>
            step(templateId, target, { sessionId: editor.sessionId }),
          );
          if (isOperations(replay)) {
            const settleReplay = conversation.settleReplay;
            if (typeof settleReplay !== "function")
              return { ok: false, detail: "settleReplay is required" };
            ok =
              (await add(
                `conversation: ${direction} replay waits for settlement`,
                async () => ({ ok: (await state()) === before }),
              )) && ok;
            const outcome = {
              replayId: replay.replayId,
              direction,
              applied: false,
              sessionId: editor.sessionId,
            };
            const refused = await call("conversation.settleReplay", () =>
              settleReplay(templateId, target, outcome),
            );
            ok =
              (await add(
                `conversation: ${direction} refused replay keeps its state`,
                async () => ({
                  ok: refused !== NO_RESULT && (await state()) === before,
                }),
              )) && ok;
            const duplicate = await call("conversation.settleReplay", () =>
              settleReplay(templateId, target, { ...outcome, applied: true }),
            );
            ok =
              (await add(
                `conversation: ${direction} replay settlement is idempotent`,
                async () => ({
                  ok: duplicate !== NO_RESULT && (await state()) === before,
                }),
              )) && ok;
            replay = await call(`conversation.${direction}`, () =>
              step(templateId, target, { sessionId: editor.sessionId }),
            );
            if (!isOperations(replay)) {
              ok = false;
              continue;
            }
            const accepted = replay;
            const applied = editor.apply(accepted.operations).applied;
            const settled = await call("conversation.settleReplay", () =>
              settleReplay(templateId, target, {
                ...outcome,
                replayId: accepted.replayId,
                applied,
              }),
            );
            ok =
              (await add(
                `conversation: ${direction} accepted replay changes its state`,
                async () => ({
                  ok:
                    applied &&
                    settled !== NO_RESULT &&
                    (await state()) === !before,
                }),
              )) && ok;
            await call("conversation.settleReplay", () =>
              settleReplay(templateId, target, {
                ...outcome,
                replayId: accepted.replayId,
                applied: false,
              }),
            );
            ok =
              (await add(
                `conversation: ${direction} accepted replay settles only once`,
                async () => ({ ok: (await state()) === !before }),
              )) && ok;
          } else {
            ok =
              replay !== NO_RESULT &&
              typeof replay === "object" &&
              replay !== null &&
              "applied" in replay &&
              typeof replay.applied?.batchId === "string" &&
              Number.isInteger(replay.applied.revision) &&
              ok;
          }
        }
        return {
          ok: ok && editor.refused.length === 0,
          detail: ok
            ? "ok"
            : "a replay was malformed, refused or settled incorrectly",
        };
      });
    }
    if (typeof conversation.clear === "function") {
      const clear = conversation.clear;
      await call("conversation.clear", () => clear(templateId));
      const after = await call("conversation.list", () =>
        conversation.list(templateId),
      );
      await add("conversation: clear empties it", () => ({
        ok: Array.isArray(after) && after.length === 0,
        detail: `${Array.isArray(after) ? after.length : "?"} message(s) left`,
      }));
    }
  } else {
    await add("conversation: off", () => ({
      ok: true,
      detail: "skipped: no conversation",
    }));
  }

  // One-shot features.
  if (typeof provider.rewrite === "function") {
    const rewrite = provider.rewrite;
    probes.rewrite = (signal) =>
      rewrite(
        {
          ...base(),
          html: "<p>Thanks for signing up. Here is everything you need to get started.</p>",
          preset: "shorten",
          language: null,
          instruction: null,
        },
        { onText: () => {} },
        signal,
      );
    const result = await call("rewrite", (signal) =>
      rewrite(
        {
          ...base(),
          html: "<p>Thanks for signing up. Here is everything you need to get started.</p>",
          preset: "shorten",
          language: null,
          instruction: null,
        },
        { onText: () => {} },
        signal,
      ),
    );
    if (result !== NO_RESULT)
      await add("rewrite: answers with html", () => {
        const html = result?.html;
        return {
          ok: typeof html === "string" && html.trim() !== "",
          detail:
            typeof html === "string"
              ? JSON.stringify(html).slice(0, 120)
              : preview(html),
        };
      });
  }
  if (typeof provider.altText === "function") {
    const altText = provider.altText;
    const request: AiAltTextRequest = {
      templateId,
      sessionId: editor.sessionId,
      blockId: "conformance-image",
      image: {
        url: options.altTextImageUrl ?? AI_CONFORMANCE_ALT_TEXT_IMAGE_URL,
      },
      currentAlt: null,
      linkHref: null,
      nearbyText: "Explore our email editor.",
      locale: editor.content.settings.locale ?? "en",
      maxLength: 125,
    };
    probes.altText = (signal) => altText(request, signal);
    const result = await call("altText", probes.altText);
    if (result !== NO_RESULT)
      await add("altText: answers within maxLength", () => {
        const alt = (result as { alt?: unknown } | null)?.alt;
        return {
          ok:
            typeof alt === "string" &&
            alt.trim() !== "" &&
            alt.length <= request.maxLength,
          detail: preview(alt),
        };
      });
  }
  // Each feature must reject an already-aborted call, fast or slow.
  const abortChecks: AiConformanceCheck[] = [];
  for (const feature of declared) {
    const probe = probes[feature]!;
    const controller = new AbortController();
    controller.abort();
    let outcome: unknown = "resolved";
    try {
      await withConformanceDeadline(
        `${feature}: abort`,
        timeoutMs,
        probe,
        controller,
      );
    } catch (error) {
      outcome = error;
    }
    const check = await evaluateConformanceCheck(
      `${feature}: stops on abort with an AbortError`,
      () => {
        const ok = outcome instanceof Error && outcome.name === "AbortError";
        return {
          ok,
          detail: ok
            ? "ok"
            : outcome instanceof ConformanceTimeoutError
              ? `still running after ${timeoutMs} ms`
              : outcome === "resolved"
                ? "resolved instead of rejecting"
                : describeError(outcome),
        };
      },
    );
    checks.push(check);
    abortChecks.push(check);

    const live = new AbortController();
    let cancel: ReturnType<typeof setTimeout> | undefined;
    let liveOutcome: unknown = "resolved";
    try {
      await withConformanceDeadline(
        `${feature}: live abort`,
        timeoutMs,
        (signal) => {
          // Invoke with a live signal. The next task lets async setup (including
          // HTTP headers/fetch) start before Stop, unlike the entry-only probe.
          const pending = probe(signal);
          cancel = setTimeout(() => live.abort(), 0);
          return pending;
        },
        live,
      );
    } catch (error) {
      liveOutcome = error;
    } finally {
      clearTimeout(cancel);
    }
    const liveCheck = await evaluateConformanceCheck(
      `${feature}: stops an in-flight call with an AbortError`,
      () => ({
        ok:
          (liveOutcome instanceof Error && liveOutcome.name === "AbortError") ||
          (liveOutcome === "resolved" && !live.signal.aborted),
        detail:
          liveOutcome instanceof ConformanceTimeoutError
            ? `still running after ${timeoutMs} ms`
            : liveOutcome === "resolved"
              ? live.signal.aborted
                ? "resolved instead of rejecting"
                : "completed before cancellation"
              : liveOutcome instanceof Error &&
                  liveOutcome.name === "AbortError"
                ? "ok"
                : describeError(liveOutcome),
      }),
    );
    checks.push(liveCheck);
    abortChecks.push(liveCheck);
  }
  if (abortChecks.length > 0) {
    await add("stops on abort with an AbortError", () => ({
      ok: abortChecks.every((check) => check.ok),
      detail:
        abortChecks
          .filter((check) => !check.ok)
          .map((check) => `${check.name}: ${check.detail}`)
          .join("; ") || "ok",
    }));
  }

  await add("errors are SdkErrors with known codes", () => {
    const bad = errors
      .map(errorProblem)
      .filter((problem): problem is string => problem !== null);
    return {
      ok: bad.length === 0,
      detail: bad.join("; ") || `${errors.length} error(s), all well formed`,
    };
  });

  return { ok: checks.every((check) => check.ok), checks };
}
