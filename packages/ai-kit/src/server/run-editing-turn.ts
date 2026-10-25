import type {
  AiMergeTags,
  Operation,
  TemplateContent,
} from "@templatical/types";
import type { AiWireEvent } from "../wire";
import {
  createEditingSession,
  type EditingSessionLimits,
} from "./editing-session";
import type {
  AiModelAdapter,
  AiModelAttachment,
  AiModelMessage,
  AiModelToolCall,
  AiUsage,
} from "./model";
import { buildEditingPrompt, editingInstructions } from "./prompts";
import type { NamedLock } from "./refusal";
import { applyOperationsTool } from "./tool";

export interface EditingTurnRequest {
  content: TemplateContent;
  revision?: number | null;
  mergeTags: AiMergeTags;
  selectedBlockId: string | null;
  /** `buildChatRequest` or `buildFixRequest`. */
  request: string;
  /** Earlier messages of the conversation, if you keep them. */
  history?: AiModelMessage[];
  /** A chat turn's attachments. */
  attachments?: AiModelAttachment[];
  limits?: Partial<EditingSessionLimits>;
  locks?: readonly NamedLock[];
  sessionId?: string | null;
}

export interface RunEditingTurnOptions {
  request: EditingTurnRequest;
  model: AiModelAdapter;
  /** Where events go: `aiEventStream`'s `send`, usually. */
  write: (event: AiWireEvent) => void | Promise<void>;
  /** Model calls at most (S7: 3). */
  maxSteps?: number;
  signal?: AbortSignal;
  /** Defaults to `editingInstructions`. */
  system?: string;
}

export interface EditingTurnResult {
  /** The whole reply. */
  text: string;
  /** What was applied, each batch with its inverse (Undo, if you store history). */
  batches: readonly { ops: Operation[]; inverse: Operation[] }[];
  /** The template after the turn. */
  content: TemplateContent;
  usage: AiUsage;
  /** The conversation including this turn, for your history. */
  messages: AiModelMessage[];
}

function opsArgument(input: AiModelToolCall["input"]): unknown {
  if (typeof input !== "string") return input?.ops;
  try {
    const parsed = JSON.parse(input) as { ops?: unknown };
    return typeof parsed === "object" && parsed !== null
      ? parsed.ops
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The reference editing loop (A1 §5): up to `maxSteps` model calls; text
 * streams as `text` events, each accepted `apply_operations` call as an
 * `operations` event, and every call's result goes back to the model. A step
 * that calls no tool ends the turn. It never writes `done`: add your
 * `messageId` and send it.
 */
export async function runEditingTurn(
  options: RunEditingTurnOptions,
): Promise<EditingTurnResult> {
  const { request, model, write, signal } = options;
  const maxSteps = options.maxSteps ?? 3;
  const session = createEditingSession({
    content: request.content,
    mergeTags: request.mergeTags,
    limits: request.limits,
    locks: request.locks,
    sessionId: request.sessionId,
  });
  const messages: AiModelMessage[] = [
    ...(request.history ?? []),
    {
      role: "user",
      content: buildEditingPrompt(request),
      ...(request.attachments?.length
        ? { attachments: request.attachments }
        : {}),
    },
  ];
  const usage: AiUsage = { inputTokens: 0, outputTokens: 0 };
  let text = "";

  for (let step = 0; step < maxSteps; step++) {
    signal?.throwIfAborted();
    let stepText = "";
    const calls: AiModelToolCall[] = [];
    for await (const part of model.stream({
      system: options.system ?? editingInstructions,
      messages,
      tools: [applyOperationsTool],
      signal,
    })) {
      signal?.throwIfAborted();
      if (part.type === "text") {
        stepText += part.text;
        text += part.text;
        await write({ type: "text", text: part.text });
      } else if (part.type === "tool-call") {
        calls.push({ id: part.id, name: part.name, input: part.input });
      } else {
        usage.inputTokens += part.inputTokens;
        usage.outputTokens += part.outputTokens;
      }
    }
    messages.push({
      role: "assistant",
      content: stepText,
      ...(calls.length > 0 ? { toolCalls: calls } : {}),
    });
    if (calls.length === 0) break;
    for (const call of calls) {
      signal?.throwIfAborted();
      let feedback: string;
      if (call.name !== applyOperationsTool.name) {
        feedback = `Refused: there is no tool called ${call.name}.`;
      } else {
        const result = session.apply(opsArgument(call.input));
        if (result.ok) await write({ type: "operations", ops: result.ops });
        feedback = result.feedback;
      }
      messages.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: feedback,
      });
    }
  }
  signal?.throwIfAborted();
  return {
    text,
    batches: session.batches,
    content: session.content,
    usage,
    messages,
  };
}
