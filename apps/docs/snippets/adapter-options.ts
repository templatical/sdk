import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import type { LanguageModel, streamText } from "ai";

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

type CreateParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming;

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

type StreamTextParams = Parameters<typeof streamText>[0];

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
