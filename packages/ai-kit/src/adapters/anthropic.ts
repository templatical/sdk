// @templatical/ai-kit/adapters/anthropic — the kit's model contract over the
// Anthropic SDK's `messages.stream`. Types only from the SDK: you pass the client.
import type Anthropic from "@anthropic-ai/sdk";
import type {
  AiModelAdapter,
  AiModelAttachment,
  AiModelMessage,
  AiModelPart,
} from "../server/model";
import type { AiToolDefinition } from "../server/tool";
import {
  blobBase64,
  cutOff,
  ownState,
  providerError,
  refused,
  toolInput,
} from "./shared";

type StreamParams = Anthropic.MessageStreamParams;

/** The one method the adapter calls: `new Anthropic()` fits it. */
export interface AnthropicAdapterClient {
  messages: {
    stream(
      body: StreamParams,
      options?: { signal?: AbortSignal | null },
    ): AsyncIterable<Anthropic.RawMessageStreamEvent> & {
      finalMessage(): Promise<Anthropic.Message>;
    };
  };
}

export interface AnthropicAdapterOptions {
  /** A client you construct: `new Anthropic()`, or one with its own `baseURL`. */
  client: AnthropicAdapterClient;
  /** The model id. No default. */
  model: string;
  /** `max_tokens`. Default 16_000. */
  maxTokens?: number;
  /** Prompt caching: a breakpoint after the system prompt plus automatic caching. Default true. */
  cache?: boolean;
  /** Further request fields, e.g. `output_config` or `metadata`. */
  params?: Omit<
    StreamParams,
    | "model"
    | "system"
    | "messages"
    | "tools"
    | "max_tokens"
    | "stream"
    | "cache_control"
  >;
}

const ADAPTER = "anthropic";
const CUT_OFF = new Set(["max_tokens", "model_context_window_exceeded"]);
const EPHEMERAL = { type: "ephemeral" } as const;

function toTool(tool: AiToolDefinition): Anthropic.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
  };
}

async function toBlock(
  attachment: AiModelAttachment,
): Promise<Anthropic.ContentBlockParam> {
  if (attachment.kind === "image-url")
    return { type: "image", source: { type: "url", url: attachment.url } };
  const data = await blobBase64(attachment.data);
  return attachment.kind === "pdf"
    ? {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data },
      }
    : {
        type: "image",
        source: {
          type: "base64",
          media_type:
            attachment.mediaType as Anthropic.Base64ImageSource["media_type"],
          data,
        },
      };
}

async function toMessages(
  messages: AiModelMessage[],
): Promise<Anthropic.MessageParam[]> {
  const out: Anthropic.MessageParam[] = [];
  for (const message of messages) {
    if (message.role === "tool") {
      const result: Anthropic.ToolResultBlockParam = {
        type: "tool_result",
        tool_use_id: message.toolCallId,
        content: message.content,
      };
      const last = out.at(-1);
      // All results of one step go back in one user message.
      if (
        last?.role === "user" &&
        Array.isArray(last.content) &&
        last.content.every((block) => block.type === "tool_result")
      ) {
        last.content.push(result);
      } else {
        out.push({ role: "user", content: [result] });
      }
    } else if (message.role === "assistant") {
      const own = ownState<Anthropic.ContentBlockParam>(message.state, ADAPTER);
      const content = own ?? [
        ...(message.content
          ? [{ type: "text" as const, text: message.content }]
          : []),
        ...(message.toolCalls ?? []).map((call) => ({
          type: "tool_use" as const,
          id: call.id,
          name: call.name,
          input: toolInput(call.input),
        })),
      ];
      // An empty assistant turn would be refused; skipping it keeps the history valid.
      if (content.length > 0) out.push({ role: "assistant", content });
    } else {
      const files = await Promise.all((message.attachments ?? []).map(toBlock));
      out.push({
        role: "user",
        content: [...files, { type: "text", text: message.content }],
      });
    }
  }
  return out;
}

/** An `AiModelAdapter` over the Anthropic Messages API. */
export function createAnthropicAdapter(
  options: AnthropicAdapterOptions,
): AiModelAdapter {
  const cache = options.cache ?? true;
  return {
    async *stream({
      system,
      messages,
      tools,
      signal,
    }): AsyncIterable<AiModelPart> {
      const body: StreamParams = {
        ...options.params,
        model: options.model,
        max_tokens: options.maxTokens ?? 16_000,
        system: [
          {
            type: "text",
            text: system,
            ...(cache ? { cache_control: EPHEMERAL } : {}),
          },
        ],
        messages: await toMessages(messages),
        ...(tools.length > 0 ? { tools: tools.map(toTool) } : {}),
        ...(cache ? { cache_control: EPHEMERAL } : {}),
      };
      let final: Anthropic.Message;
      try {
        const stream = options.client.messages.stream(body, { signal });
        for await (const event of stream) {
          signal?.throwIfAborted();
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          )
            yield { type: "text", text: event.delta.text };
        }
        final = await stream.finalMessage();
        signal?.throwIfAborted();
      } catch (error) {
        throw providerError(error);
      }
      if (final.stop_reason === "refusal") throw refused();
      const calls = final.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );
      if (
        calls.length > 0 &&
        final.stop_reason !== null &&
        CUT_OFF.has(final.stop_reason)
      )
        throw cutOff();
      yield {
        type: "state",
        state: { adapter: ADAPTER, content: final.content },
      };
      for (const block of calls) {
        yield {
          type: "tool-call",
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
      }
      const usage = final.usage;
      yield {
        type: "usage",
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        ...(usage.cache_read_input_tokens != null
          ? { cacheReadInputTokens: usage.cache_read_input_tokens }
          : {}),
        ...(usage.cache_creation_input_tokens != null
          ? { cacheWriteInputTokens: usage.cache_creation_input_tokens }
          : {}),
      };
    },
  };
}
