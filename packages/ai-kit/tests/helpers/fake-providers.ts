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
              options?.signal?.throwIfAborted();
              await Promise.resolve();
              yield {
                type: "content_block_delta",
                index: 0,
                delta: { type: "text_delta", text },
              };
            }
          },
          async finalMessage() {
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
