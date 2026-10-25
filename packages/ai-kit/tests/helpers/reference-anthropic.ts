import type { AnthropicAdapterClient } from "../../src/adapters/anthropic";
import { editingInstructions, rewriteInstructions } from "../../src/server";

/**
 * `referenceModel()`'s answers, as the Anthropic API would send them: the
 * conformance suite then runs the reference server through the real adapter.
 */
export function referenceAnthropicClient(): AnthropicAdapterClient {
  const client = {
    messages: {
      stream(
        body: Record<string, any>,
        options?: { signal?: AbortSignal | null },
      ) {
        options?.signal?.throwIfAborted();
        const system = body.system?.[0]?.text as string;
        const last = body.messages.at(-1);
        const afterTool =
          last?.role === "user" &&
          last.content.every(
            (block: { type: string }) => block.type === "tool_result",
          );
        const hasImageUrl = body.messages.some(
          (message: {
            role: string;
            content: { type: string; source?: { type: string } }[];
          }) =>
            message.role === "user" &&
            message.content.some(
              (block) => block.type === "image" && block.source?.type === "url",
            ),
        );
        let texts: string[] = [];
        let content: unknown[] = [];
        if (system === editingInstructions && afterTool) {
          texts = [" The background is light grey now."];
        } else if (system === editingInstructions) {
          texts = ["Making the background light grey."];
          content = [
            {
              type: "tool_use",
              id: "toolu_1",
              name: "apply_operations",
              input: {
                ops: JSON.stringify([
                  { op: "updateSettings", set: { backgroundColor: "#f3f4f6" } },
                ]),
              },
            },
          ];
        } else if (hasImageUrl) {
          texts = ["Explore the email editor"];
        } else if (system === rewriteInstructions) {
          texts = ["<p>Hello ", "there.</p>"];
        }
        return {
          async *[Symbol.asyncIterator]() {
            for (const text of texts) {
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
              id: "msg_ref",
              type: "message",
              role: "assistant",
              model: body.model,
              content: [
                ...(texts.length
                  ? [{ type: "text", text: texts.join(""), citations: null }]
                  : []),
                ...content,
              ],
              stop_reason: content.length ? "tool_use" : "end_turn",
              stop_sequence: null,
              usage: {
                input_tokens: 10,
                output_tokens: 5,
                cache_read_input_tokens: 0,
                cache_creation_input_tokens: 0,
              },
            };
          },
        };
      },
    },
  };
  return client as unknown as AnthropicAdapterClient;
}
