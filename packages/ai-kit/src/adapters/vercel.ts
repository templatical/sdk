// @templatical/ai-kit/adapters/vercel — the kit's model contract over the
// Vercel AI SDK's `streamText`, for any AI SDK provider model.
import {
  jsonSchema,
  streamText,
  tool,
  type AssistantModelMessage,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";
import type {
  AiModelAdapter,
  AiModelAttachment,
  AiModelMessage,
  AiModelPart,
  AiModelToolCall,
} from "../server/model";
import type { AiToolDefinition } from "../server/tool";
import { cutOff, ownState, providerError, refused, toolInput } from "./shared";

type StreamTextParams = Parameters<typeof streamText>[0];
type AssistantPart = Exclude<AssistantModelMessage["content"], string>[number];

export interface VercelAdapterOptions {
  /** An AI SDK model, e.g. `anthropic('…')` from `@ai-sdk/anthropic`, or a gateway model id. */
  model: LanguageModel;
  /** `maxOutputTokens`. Default: the provider's own. */
  maxTokens?: number;
  /** Further `streamText` options, e.g. `providerOptions` or `maxRetries`. */
  params?: Omit<
    StreamTextParams,
    | "model"
    | "system"
    | "instructions"
    | "messages"
    | "prompt"
    | "tools"
    | "abortSignal"
    | "maxOutputTokens"
  >;
}

const ADAPTER = "vercel";

function toTools(tools: AiToolDefinition[]): ToolSet {
  return Object.fromEntries(
    tools.map((definition) => [
      definition.name,
      // No `execute`: the kit applies the call, so the SDK stops after one step.
      tool({
        description: definition.description,
        inputSchema: jsonSchema(definition.inputSchema),
      }),
    ]),
  );
}

async function toFilePart(attachment: AiModelAttachment) {
  if (attachment.kind === "image-url")
    return {
      type: "file" as const,
      data: new URL(attachment.url),
      mediaType: "image",
    };
  const data = new Uint8Array(await attachment.data.arrayBuffer());
  return {
    type: "file" as const,
    data,
    mediaType:
      attachment.kind === "pdf" ? "application/pdf" : attachment.mediaType,
  };
}

async function toMessages(messages: AiModelMessage[]): Promise<ModelMessage[]> {
  const out: ModelMessage[] = [];
  for (const message of messages) {
    if (message.role === "tool") {
      const result = {
        type: "tool-result" as const,
        toolCallId: message.toolCallId,
        toolName: message.name,
        output: { type: "text" as const, value: message.content },
      };
      const last = out.at(-1);
      // All results of one step go back in one tool message.
      if (last?.role === "tool") last.content.push(result);
      else out.push({ role: "tool", content: [result] });
    } else if (message.role === "assistant") {
      const content: AssistantPart[] = ownState<AssistantPart>(
        message.state,
        ADAPTER,
      ) ?? [
        ...(message.content
          ? [{ type: "text" as const, text: message.content }]
          : []),
        ...(message.toolCalls ?? []).map((call) => ({
          type: "tool-call" as const,
          toolCallId: call.id,
          toolName: call.name,
          input: toolInput(call.input),
        })),
      ];
      if (content.length > 0) out.push({ role: "assistant", content });
    } else {
      const files = await Promise.all(
        (message.attachments ?? []).map(toFilePart),
      );
      out.push({
        role: "user",
        content: [...files, { type: "text", text: message.content }],
      });
    }
  }
  return out;
}

/** An `AiModelAdapter` over the Vercel AI SDK. */
export function createVercelAdapter(
  options: VercelAdapterOptions,
): AiModelAdapter {
  return {
    async *stream({
      system,
      messages,
      tools,
      signal,
    }): AsyncIterable<AiModelPart> {
      const calls: AiModelToolCall[] = [];
      let toolInputStarted = false;
      let finishReason: string | undefined;
      let usage:
        | {
            inputTokens?: number;
            outputTokens?: number;
            inputTokenDetails?: {
              noCacheTokens?: number;
              cacheReadTokens?: number;
              cacheWriteTokens?: number;
            };
          }
        | undefined;
      let state: AssistantPart[] | undefined;
      try {
        const result = streamText({
          ...options.params,
          model: options.model,
          instructions: system,
          messages: await toMessages(messages),
          ...(tools.length > 0 ? { tools: toTools(tools) } : {}),
          ...(options.maxTokens !== undefined
            ? { maxOutputTokens: options.maxTokens }
            : {}),
          abortSignal: signal,
        });
        for await (const part of result.stream) {
          signal?.throwIfAborted();
          if (part.type === "text-delta")
            yield { type: "text", text: part.text };
          else if (part.type === "tool-input-start") toolInputStarted = true;
          else if (part.type === "tool-call")
            calls.push({
              id: part.toolCallId,
              name: part.toolName,
              input: part.input as Record<string, unknown>,
            });
          else if (part.type === "finish") {
            finishReason = part.finishReason;
            usage = part.totalUsage;
          } else if (part.type === "error") throw part.error;
          // Our own signal is checked at the top of the loop, so this abort
          // came from the SDK itself, e.g. `params.timeout`.
          else if (part.type === "abort")
            throw new Error(part.reason ?? "The AI SDK aborted the stream.");
        }
        signal?.throwIfAborted();
        if (finishReason === "content-filter") throw refused();
        if (finishReason === "length" && (toolInputStarted || calls.length > 0))
          throw cutOff();
        const assistant = (await result.responseMessages).find(
          (message) => message.role === "assistant",
        );
        if (assistant && typeof assistant.content !== "string")
          state = assistant.content;
      } catch (error) {
        throw providerError(error);
      }
      if (state)
        yield { type: "state", state: { adapter: ADAPTER, content: state } };
      for (const call of calls) yield { type: "tool-call", ...call };
      if (usage) {
        const details = usage.inputTokenDetails;
        yield {
          type: "usage",
          inputTokens:
            details?.noCacheTokens ??
            (usage.inputTokens !== undefined
              ? Math.max(
                  0,
                  usage.inputTokens -
                    (details?.cacheReadTokens ?? 0) -
                    (details?.cacheWriteTokens ?? 0),
                )
              : 0),
          outputTokens: usage.outputTokens ?? 0,
          ...(details?.cacheReadTokens !== undefined
            ? { cacheReadInputTokens: details.cacheReadTokens }
            : {}),
          ...(details?.cacheWriteTokens !== undefined
            ? { cacheWriteInputTokens: details.cacheWriteTokens }
            : {}),
        };
      }
    },
  };
}
