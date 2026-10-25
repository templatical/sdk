import { afterEach, describe, expect, it, vi } from "vitest";
import { ThrottledError } from "@templatical/types";
import { createVercelAdapter } from "../../src/adapters/vercel";
import type { AiModelMessage, AiModelPart } from "../../src/server";
import { applyOperationsTool } from "../../src/server";
import { MockLanguageModelV4 } from "ai/test";
import { fakeLanguageModel } from "../helpers/fake-providers";

async function collect(
  parts: AsyncIterable<AiModelPart>,
): Promise<AiModelPart[]> {
  const out: AiModelPart[] = [];
  for await (const part of parts) out.push(part);
  return out;
}

const user = (content: string): AiModelMessage => ({ role: "user", content });
const text = (id: string, delta: string) => [
  { type: "text-start", id },
  { type: "text-delta", id, delta },
  { type: "text-end", id },
];

describe("createVercelAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("streams text, then state, the tool calls and usage with cache tokens", async () => {
    const { model } = fakeLanguageModel([
      {
        parts: [
          {
            type: "reasoning-start",
            id: "r1",
            providerMetadata: { anthropic: { signature: "sig" } },
          },
          { type: "reasoning-delta", id: "r1", delta: "" },
          {
            type: "reasoning-end",
            id: "r1",
            providerMetadata: { anthropic: { signature: "sig" } },
          },
          ...text("t1", "On it."),
          {
            type: "tool-call",
            toolCallId: "tc_1",
            toolName: "apply_operations",
            input: '{"ops":"[]"}',
          },
        ],
        finishReason: "tool-calls",
        usage: {
          inputTokens: {
            total: 1000,
            noCache: 60,
            cacheRead: 900,
            cacheWrite: 40,
          },
          outputTokens: { total: 9, text: 9, reasoning: undefined },
        },
      },
    ]);

    const parts = await collect(
      createVercelAdapter({ model: model as never }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [applyOperationsTool],
      }),
    );

    expect(parts[0]).toEqual({ type: "text", text: "On it." });
    expect(parts[1]).toMatchObject({
      type: "state",
      state: { adapter: "vercel" },
    });
    const state = (parts[1] as { state: { content: { type: string }[] } })
      .state;
    expect(state.content.map((part) => part.type)).toEqual([
      "reasoning",
      "text",
      "tool-call",
    ]);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(parts.slice(2)).toEqual([
      {
        type: "tool-call",
        id: "tc_1",
        name: "apply_operations",
        input: { ops: "[]" },
      },
      {
        type: "usage",
        inputTokens: 60,
        outputTokens: 9,
        cacheReadInputTokens: 900,
        cacheWriteInputTokens: 40,
      },
    ]);
  });

  it("subtracts cache tokens from total input when uncached usage is missing", async () => {
    const { model } = fakeLanguageModel([
      {
        usage: {
          inputTokens: {
            total: 1000,
            noCache: undefined,
            cacheRead: 900,
            cacheWrite: 40,
          },
          outputTokens: { total: 9, text: 9, reasoning: undefined },
        },
      },
    ]);
    const parts = await collect(
      createVercelAdapter({ model }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [],
      }),
    );

    expect(parts).toEqual([
      {
        type: "usage",
        inputTokens: 60,
        outputTokens: 9,
        cacheReadInputTokens: 900,
        cacheWriteInputTokens: 40,
      },
    ]);
  });

  it("sends instructions, tools without execute, max output tokens, params and files before text", async () => {
    const warnings = vi
      .spyOn(process, "emitWarning")
      .mockImplementation(() => {});
    const { model, calls } = fakeLanguageModel([{ parts: text("t1", "ok") }]);
    await collect(
      createVercelAdapter({
        model: model as never,
        maxTokens: 500,
        params: { temperature: 0 },
      }).stream({
        system: "S",
        messages: [
          {
            role: "user",
            content: "Build this",
            attachments: [
              {
                kind: "image",
                mediaType: "image/png",
                data: new Blob([new Uint8Array([1, 2, 3])]),
              },
              {
                kind: "pdf",
                mediaType: "application/pdf",
                data: new Blob([new Uint8Array([4, 5])]),
              },
              { kind: "image-url", url: "https://example.com/a.png" },
            ],
          },
        ],
        tools: [applyOperationsTool],
      }),
    );

    const options = calls[0];
    expect(options.maxOutputTokens).toBe(500);
    expect(options.temperature).toBe(0);
    expect(options.prompt[0]).toEqual({ role: "system", content: "S" });
    expect(
      options.prompt[1].content.map(
        (part: { type: string; mediaType?: string }) => [
          part.type,
          part.mediaType,
        ],
      ),
    ).toEqual([
      ["file", "image/png"],
      ["file", "application/pdf"],
      ["file", "image"],
      ["text", undefined],
    ]);
    expect(options.tools).toEqual([
      expect.objectContaining({
        type: "function",
        name: "apply_operations",
        description: applyOperationsTool.description,
        inputSchema: applyOperationsTool.inputSchema,
      }),
    ]);
    expect(warnings).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ code: "AISDK_DEP_IMAGE_CONTENT_PART" }),
    );
  });

  it("replays its own state verbatim and rebuilds other assistant messages", async () => {
    const own = [
      {
        type: "reasoning",
        text: "",
        providerOptions: { anthropic: { signature: "sig" } },
      },
      {
        type: "tool-call",
        toolCallId: "tc_1",
        toolName: "apply_operations",
        input: { ops: "[]" },
      },
    ];
    const { model, calls } = fakeLanguageModel([{ parts: text("t1", "ok") }]);
    await collect(
      createVercelAdapter({ model: model as never }).stream({
        system: "S",
        messages: [
          user("One"),
          {
            role: "assistant",
            content: "Hi",
            state: { adapter: "anthropic", content: [] },
          },
          user("Two"),
          {
            role: "assistant",
            content: "",
            toolCalls: [
              { id: "tc_1", name: "apply_operations", input: { ops: "[]" } },
            ],
            state: { adapter: "vercel", content: own },
          },
          {
            role: "tool",
            toolCallId: "tc_1",
            name: "apply_operations",
            content: "Applied.",
          },
        ],
        tools: [applyOperationsTool],
      }),
    );

    const prompt = calls[0].prompt;
    expect(prompt[2]).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "Hi" }],
      providerOptions: undefined,
    });
    expect(prompt[4].content[0]).toMatchObject({
      type: "reasoning",
      text: "",
      providerOptions: { anthropic: { signature: "sig" } },
    });
    expect(prompt[4].content[1]).toMatchObject({
      type: "tool-call",
      toolCallId: "tc_1",
      toolName: "apply_operations",
    });
    expect(prompt[5]).toMatchObject({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "tc_1",
          toolName: "apply_operations",
          output: { type: "text", value: "Applied." },
        },
      ],
    });
  });

  it("throws the provider error on a content filter and ai_output_invalid on a cut-off tool call", async () => {
    const { model } = fakeLanguageModel([
      { parts: [], finishReason: "content-filter" },
      {
        parts: [
          {
            type: "tool-call",
            toolCallId: "tc_1",
            toolName: "apply_operations",
            input: '{"ops":"[]"}',
          },
        ],
        finishReason: "length",
      },
    ]);
    const adapter = createVercelAdapter({ model: model as never });
    await expect(
      collect(
        adapter.stream({ system: "S", messages: [user("Hi")], tools: [] }),
      ),
    ).rejects.toMatchObject({ code: "ai_provider_error", statusCode: 502 });
    await expect(
      collect(
        adapter.stream({
          system: "S",
          messages: [user("Hi")],
          tools: [applyOperationsTool],
        }),
      ),
    ).rejects.toMatchObject({ code: "ai_output_invalid" });
  });

  it("rejects truncated tool input without yielding state or tool calls", async () => {
    const { model } = fakeLanguageModel([
      {
        parts: [
          {
            type: "tool-input-start",
            id: "tc_1",
            toolName: "apply_operations",
          },
          { type: "tool-input-delta", id: "tc_1", delta: '{"ops":' },
        ],
        finishReason: "length",
      },
    ]);
    const seen: AiModelPart[] = [];
    const failure = (async () => {
      for await (const part of createVercelAdapter({ model }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [applyOperationsTool],
      }))
        seen.push(part);
    })();

    await expect(failure).rejects.toMatchObject({
      code: "ai_output_invalid",
      statusCode: 422,
    });
    expect(
      seen.filter((part) => part.type === "state" || part.type === "tool-call"),
    ).toEqual([]);
  });

  it("turns a 429 into a ThrottledError", async () => {
    const limited = Object.assign(new Error("rate"), {
      statusCode: 429,
      responseHeaders: { "retry-after": "5" },
      isRetryable: false,
    });
    const { model } = fakeLanguageModel([{ error: limited }]);
    const failure = collect(
      createVercelAdapter({
        model: model as never,
        params: { maxRetries: 0 },
      }).stream({ system: "S", messages: [user("Hi")], tools: [] }),
    );
    await expect(failure).rejects.toBeInstanceOf(ThrottledError);
    await expect(failure).rejects.toMatchObject({ retryAfterMs: 5000 });
  });

  it("rejects an abort before yielding buffered text deltas", async () => {
    const controller = new AbortController();
    const reason = new Error("Cancelled Vercel text");
    const { model } = fakeLanguageModel([
      {
        parts: [
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "First" },
          { type: "text-delta", id: "t1", delta: "Too late" },
          { type: "text-delta", id: "t1", delta: "Also too late" },
          { type: "text-end", id: "t1" },
        ],
      },
    ]);
    const parts: AiModelPart[] = [];
    const result = (async () => {
      for await (const part of createVercelAdapter({ model }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [],
        signal: controller.signal,
      })) {
        parts.push(part);
        if (parts.length === 1) controller.abort(reason);
      }
    })();

    await expect(result).rejects.toBe(reason);
    expect(parts).toEqual([{ type: "text", text: "First" }]);
  });

  it("rejects a normally finished stream aborted after a tool call without yielding calls or state", async () => {
    const controller = new AbortController();
    const reason = new Error("cancelled");
    const { model } = fakeLanguageModel([
      {
        parts: [
          {
            type: "tool-call",
            toolCallId: "tc_1",
            toolName: "apply_operations",
            input: '{"ops":"[]"}',
          },
        ],
        finishReason: "tool-calls",
      },
    ]);
    const doStream = model.doStream.bind(model);
    model.doStream = async (options) => {
      const result = await doStream(options);
      const reader = result.stream.getReader();
      return {
        ...result,
        stream: new ReadableStream({
          async pull(stream) {
            const next = await reader.read();
            if (next.done) {
              stream.close();
              return;
            }
            if (next.value.type === "finish") controller.abort(reason);
            stream.enqueue(next.value);
          },
        }),
      };
    };
    const seen: AiModelPart[] = [];
    const failure = (async () => {
      for await (const part of createVercelAdapter({ model }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [applyOperationsTool],
        signal: controller.signal,
      }))
        seen.push(part);
    })();
    await expect(failure).rejects.toBe(reason);
    expect(
      seen.filter((part) => part.type === "tool-call" || part.type === "state"),
    ).toEqual([]);
  });

  it("batches consecutive tool results, rebuilds a text-less tool turn and skips an empty assistant turn", async () => {
    const { model, calls } = fakeLanguageModel([{ parts: text("t1", "ok") }]);

    await collect(
      createVercelAdapter({ model }).stream({
        system: "S",
        messages: [
          user("One"),
          {
            role: "assistant",
            content: "",
            toolCalls: [
              { id: "tc_1", name: "apply_operations", input: { ops: "[]" } },
              { id: "tc_2", name: "apply_operations", input: '{"ops":"[]"}' },
            ],
          },
          {
            role: "tool",
            toolCallId: "tc_1",
            name: "apply_operations",
            content: "Applied.",
          },
          {
            role: "tool",
            toolCallId: "tc_2",
            name: "apply_operations",
            content: "Refused.",
          },
          { role: "assistant", content: "" },
          user("Two"),
        ],
        tools: [applyOperationsTool],
      }),
    );

    const prompt = calls[0].prompt as {
      role: string;
      content: { type: string; toolCallId?: string }[];
    }[];
    expect(prompt.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "tool",
      "user",
    ]);
    expect(
      prompt[2].content.map((part) => [part.type, part.toolCallId]),
    ).toEqual([
      ["tool-call", "tc_1"],
      ["tool-call", "tc_2"],
    ]);
    expect(prompt[3].content).toMatchObject([
      {
        type: "tool-result",
        toolCallId: "tc_1",
        output: { type: "text", value: "Applied." },
      },
      {
        type: "tool-result",
        toolCallId: "tc_2",
        output: { type: "text", value: "Refused." },
      },
    ]);
  });

  it("rejects a stream the AI SDK aborts itself (params.timeout) instead of finishing it", async () => {
    const model = new MockLanguageModelV4({
      async doStream(options) {
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] });
              controller.enqueue({ type: "text-start", id: "t1" });
              controller.enqueue({
                type: "text-delta",
                id: "t1",
                delta: "First",
              });
              options.abortSignal?.addEventListener("abort", () =>
                controller.error(options.abortSignal?.reason),
              );
            },
          }),
        };
      },
    });
    const parts: AiModelPart[] = [];

    const result = (async () => {
      for await (const part of createVercelAdapter({
        model,
        params: { timeout: 50, maxRetries: 0 },
      }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [applyOperationsTool],
      }))
        parts.push(part);
    })();

    await expect(result).rejects.toBeInstanceOf(Error);
    expect(parts).toEqual([{ type: "text", text: "First" }]);
  });
});
