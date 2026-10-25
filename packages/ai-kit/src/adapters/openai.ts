// @templatical/ai-kit/adapters/openai — the kit's model contract over OpenAI's
// Chat Completions API, which OpenAI-compatible servers implement too. Types
// only from the SDK: you pass the client.
import type OpenAI from "openai";
import type {
  AiModelAdapter,
  AiModelAttachment,
  AiModelMessage,
  AiModelPart,
  AiUsage,
} from "../server/model";
import type { AiToolDefinition } from "../server/tool";
import {
  blobBase64,
  cutOff,
  providerError,
  refused,
  toolArguments,
} from "./shared";

type CreateParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming;
type MessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ContentPart = OpenAI.Chat.Completions.ChatCompletionContentPart;

/** The one method the adapter calls: `new OpenAI()` and `new AzureOpenAI()` fit it. */
export interface OpenAiAdapterClient {
  chat: {
    completions: {
      create(
        body: CreateParams,
        options?: { signal?: AbortSignal | null },
      ): PromiseLike<
        AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
      >;
    };
  };
}

export interface OpenAiAdapterOptions {
  /** A client you construct: `new OpenAI()`, `new AzureOpenAI()`, or one with a `baseURL` for an OpenAI-compatible server. */
  client: OpenAiAdapterClient;
  /** The model id. No default. */
  model: string;
  /** `max_completion_tokens`. Default: the API's own. */
  maxTokens?: number;
  /** Further request fields, e.g. `reasoning_effort`. */
  params?: Omit<
    CreateParams,
    | "model"
    | "messages"
    | "tools"
    | "stream"
    | "stream_options"
    | "max_completion_tokens"
    | "max_tokens"
    | "n"
  >;
}

function toTool(
  tool: AiToolDefinition,
): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

async function toPart(
  attachment: AiModelAttachment,
  index: number,
): Promise<ContentPart> {
  if (attachment.kind === "image-url")
    return { type: "image_url", image_url: { url: attachment.url } };
  const url = `data:${attachment.mediaType};base64,${await blobBase64(attachment.data)}`;
  return attachment.kind === "pdf"
    ? {
        type: "file",
        file: { filename: `attachment-${index + 1}.pdf`, file_data: url },
      }
    : { type: "image_url", image_url: { url } };
}

async function toMessage(
  message: AiModelMessage,
): Promise<MessageParam | null> {
  if (message.role === "tool")
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content,
    };
  if (message.role === "assistant") {
    if (message.content.length === 0 && !message.toolCalls?.length) return null;
    return {
      role: "assistant",
      content: message.content.length > 0 ? message.content : null,
      ...(message.toolCalls?.length
        ? {
            tool_calls: message.toolCalls.map((call) => ({
              id: call.id,
              type: "function" as const,
              function: {
                name: call.name,
                arguments: toolArguments(call.input),
              },
            })),
          }
        : {}),
    };
  }
  const files = await Promise.all((message.attachments ?? []).map(toPart));
  return {
    role: "user",
    content: [...files, { type: "text", text: message.content }],
  };
}

/** An `AiModelAdapter` over OpenAI's Chat Completions API. */
export function createOpenAiAdapter(
  options: OpenAiAdapterOptions,
): AiModelAdapter {
  return {
    async *stream({
      system,
      messages,
      tools,
      signal,
    }): AsyncIterable<AiModelPart> {
      const body: CreateParams = {
        ...options.params,
        model: options.model,
        stream: true,
        stream_options: { include_usage: true },
        ...(options.maxTokens !== undefined
          ? { max_completion_tokens: options.maxTokens }
          : {}),
        messages: [
          { role: "system", content: system },
          ...(await Promise.all(messages.map(toMessage))).filter(
            (message) => message !== null,
          ),
        ],
        ...(tools.length > 0 ? { tools: tools.map(toTool) } : {}),
      };
      const calls = new Map<
        number,
        { id: string; name: string; args: string }
      >();
      let finish: string | null = null;
      let usage: AiUsage | undefined;
      try {
        const stream = await options.client.chat.completions.create(body, {
          signal,
        });
        for await (const chunk of stream) {
          signal?.throwIfAborted();
          const choice = chunk.choices.find((choice) => choice.index === 0);
          const delta = choice?.delta;
          if (delta?.refusal) throw refused();
          if (delta?.content) yield { type: "text", text: delta.content };
          for (const call of delta?.tool_calls ?? []) {
            const seen = calls.get(call.index) ?? {
              id: "",
              name: "",
              args: "",
            };
            calls.set(call.index, {
              id: call.id ?? seen.id,
              name: call.function?.name ?? seen.name,
              args: seen.args + (call.function?.arguments ?? ""),
            });
          }
          if (choice?.finish_reason) finish = choice.finish_reason;
          if (chunk.usage) {
            const cached = chunk.usage.prompt_tokens_details?.cached_tokens;
            usage = {
              inputTokens: chunk.usage.prompt_tokens - (cached ?? 0),
              outputTokens: chunk.usage.completion_tokens,
              ...(cached !== undefined ? { cacheReadInputTokens: cached } : {}),
            };
          }
        }
        signal?.throwIfAborted();
      } catch (error) {
        throw providerError(error);
      }
      if (finish === "content_filter") throw refused();
      if (finish === "length" && calls.size > 0) throw cutOff();
      for (const [, call] of [...calls].sort(([a], [b]) => a - b)) {
        yield {
          type: "tool-call",
          id: call.id,
          name: call.name,
          input: call.args,
        };
      }
      if (usage) yield { type: "usage", ...usage };
    },
  };
}
