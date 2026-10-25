import { MockLanguageModelV4 } from "ai/test";
import type { OpenAiAdapterClient } from "../../src/adapters/openai";
import type { AnthropicAdapterClient } from "../../src/adapters/anthropic";

export interface AnthropicStep {
  /** Text deltas streamed before the final message. */
  text?: string[];
  /** The final message's content; defaults to one text block of `text`. */
  content?: unknown[];
  stopReason?: string;
  usage?: Record<string, number | null>;
  /** Thrown while streaming. */
  error?: unknown;
  /** Whether the iterator checks cancellation before each delta. Default true. */
  checkSignal?: boolean;
  onFinal?: () => void;
}

/** A scripted `messages.stream`: one step per call, recording each request body and signal. */
export function fakeAnthropic(steps: AnthropicStep[]) {
  const requests: { body: Record<string, any>; signal?: AbortSignal | null }[] =
    [];
  const client = {
    messages: {
      stream(
        body: Record<string, any>,
        options?: { signal?: AbortSignal | null },
      ) {
        requests.push({
          body: JSON.parse(JSON.stringify(body)),
          signal: options?.signal,
        });
        const step = steps[requests.length - 1] ?? {};
        return {
          async *[Symbol.asyncIterator]() {
            if (step.error) throw step.error;
            for (const text of step.text ?? []) {
              if (step.checkSignal !== false) options?.signal?.throwIfAborted();
              await Promise.resolve();
              yield {
                type: "content_block_delta",
                index: 0,
                delta: { type: "text_delta", text },
              };
            }
          },
          async finalMessage() {
            step.onFinal?.();
            return {
              id: "msg_1",
              type: "message",
              role: "assistant",
              model: body.model,
              content:
                step.content ??
                (step.text
                  ? [
                      {
                        type: "text",
                        text: step.text.join(""),
                        citations: null,
                      },
                    ]
                  : []),
              stop_reason: step.stopReason ?? "end_turn",
              stop_sequence: null,
              usage: {
                input_tokens: 10,
                output_tokens: 5,
                cache_read_input_tokens: null,
                cache_creation_input_tokens: null,
                ...step.usage,
              },
            };
          },
        };
      },
    },
  };
  return { client: client as unknown as AnthropicAdapterClient, requests };
}

export interface OpenAiStep {
  /** Chunks with one choice each; the choice index defaults to 0. */
  deltas?: {
    delta: Record<string, unknown>;
    finish_reason?: string | null;
    choiceIndex?: number;
  }[];
  usage?: Record<string, unknown> | null;
  error?: unknown;
}

/** A scripted `chat.completions.create` with `stream: true`. */
export function fakeOpenAi(steps: OpenAiStep[]) {
  const requests: { body: Record<string, any>; signal?: AbortSignal | null }[] =
    [];
  const client = {
    chat: {
      completions: {
        async create(
          body: Record<string, any>,
          options?: { signal?: AbortSignal | null },
        ) {
          requests.push({
            body: JSON.parse(JSON.stringify(body)),
            signal: options?.signal,
          });
          const step = steps[requests.length - 1] ?? {};
          if (step.error) throw step.error;
          return (async function* () {
            for (const {
              delta,
              finish_reason,
              choiceIndex = 0,
            } of step.deltas ?? []) {
              await Promise.resolve();
              yield {
                id: "c",
                object: "chat.completion.chunk",
                created: 0,
                model: body.model,
                choices: [
                  {
                    index: choiceIndex,
                    delta,
                    finish_reason: finish_reason ?? null,
                  },
                ],
              };
            }
            if (step.usage !== null)
              yield {
                id: "c",
                object: "chat.completion.chunk",
                created: 0,
                model: body.model,
                choices: [],
                usage: step.usage ?? {
                  prompt_tokens: 12,
                  completion_tokens: 4,
                  total_tokens: 16,
                },
              };
          })();
        },
      },
    },
  };
  return { client: client as unknown as OpenAiAdapterClient, requests };
}

export interface VercelStep {
  /** `LanguageModelV4StreamPart`s the model streams, before its `finish`. */
  parts?: Record<string, unknown>[];
  finishReason?: string;
  usage?: Record<string, unknown>;
  error?: unknown;
}

/** A scripted AI SDK language model: one step per `doStream` call, recording each call's prompt. */
export function fakeLanguageModel(steps: VercelStep[]) {
  const calls: Record<string, any>[] = [];
  const model = new MockLanguageModelV4({
    provider: "fake",
    modelId: "fake-model",
    supportedUrls: {
      "image/*": [/^https:\/\//],
      "application/pdf": [/^https:\/\//],
    },
    async doStream(options) {
      calls.push(options);
      const step = steps[calls.length - 1] ?? {};
      if (step.error) throw step.error;
      const parts = [
        { type: "stream-start", warnings: [] },
        ...(step.parts ?? []),
        {
          type: "finish",
          finishReason: {
            unified: step.finishReason ?? "stop",
            raw: step.finishReason ?? "stop",
          },
          usage: step.usage ?? {
            inputTokens: {
              total: 12,
              noCache: 12,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: { total: 4, text: 4, reasoning: undefined },
          },
        },
      ];
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
      };
    },
    async doGenerate() {
      throw new Error("not used");
    },
  });
  return { model, calls };
}
