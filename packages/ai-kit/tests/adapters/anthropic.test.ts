import { describe, expect, it } from "vitest";
import { SdkError, ThrottledError } from "@templatical/types";
import { createAnthropicAdapter } from "../../src/adapters/anthropic";
import type { AiModelMessage, AiModelPart } from "../../src/server";
import { applyOperationsTool } from "../../src/server";
import { fakeAnthropic } from "../helpers/fake-providers";

async function collect(
  parts: AsyncIterable<AiModelPart>,
): Promise<AiModelPart[]> {
  const out: AiModelPart[] = [];
  for await (const part of parts) out.push(part);
  return out;
}

const user = (content: string): AiModelMessage => ({ role: "user", content });
const call = {
  type: "tool_use",
  id: "tu_1",
  name: "apply_operations",
  input: { ops: "[]" },
};

describe("createAnthropicAdapter", () => {
  it("streams text, then state, the tool calls and usage", async () => {
    const content = [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: "On it.", citations: null },
      call,
    ];
    const { client } = fakeAnthropic([
      { text: ["On ", "it."], content, stopReason: "tool_use" },
    ]);
    const model = createAnthropicAdapter({ client, model: "claude-test" });

    const parts = await collect(
      model.stream({
        system: "S",
        messages: [user("Hi")],
        tools: [applyOperationsTool],
      }),
    );

    expect(parts).toEqual([
      { type: "text", text: "On " },
      { type: "text", text: "it." },
      { type: "state", state: { adapter: "anthropic", content } },
      {
        type: "tool-call",
        id: "tu_1",
        name: "apply_operations",
        input: { ops: "[]" },
      },
      { type: "usage", inputTokens: 10, outputTokens: 5 },
    ]);
  });

  it("sends the model, the default max_tokens, cached system and tools, and merges params", async () => {
    const { client, requests } = fakeAnthropic([{ text: ["ok"] }]);
    const model = createAnthropicAdapter({
      client,
      model: "claude-test",
      params: { metadata: { user_id: "u1" } },
    });

    await collect(
      model.stream({
        system: "S",
        messages: [user("Hi")],
        tools: [applyOperationsTool],
      }),
    );

    expect(requests[0].body).toMatchObject({
      model: "claude-test",
      max_tokens: 16_000,
      metadata: { user_id: "u1" },
      system: [
        { type: "text", text: "S", cache_control: { type: "ephemeral" } },
      ],
      cache_control: { type: "ephemeral" },
      tools: [
        {
          name: "apply_operations",
          description: applyOperationsTool.description,
          input_schema: applyOperationsTool.inputSchema,
        },
      ],
      messages: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
    });
  });

  it("leaves caching off with cache: false, and omits tools when none are offered", async () => {
    const { client, requests } = fakeAnthropic([{ text: ["ok"] }]);
    const model = createAnthropicAdapter({
      client,
      model: "claude-test",
      cache: false,
      maxTokens: 900,
    });

    await collect(
      model.stream({ system: "S", messages: [user("Hi")], tools: [] }),
    );

    expect(requests[0].body.max_tokens).toBe(900);
    expect(requests[0].body.system).toEqual([{ type: "text", text: "S" }]);
    expect(requests[0].body).not.toHaveProperty("cache_control");
    expect(requests[0].body).not.toHaveProperty("tools");
  });

  it("sends files before the text: an image and a PDF as base64, an image URL as a url source", async () => {
    const { client, requests } = fakeAnthropic([{ text: ["ok"] }]);
    const model = createAnthropicAdapter({ client, model: "claude-test" });
    const png = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    const pdf = new Blob([new Uint8Array([4, 5])], { type: "application/pdf" });

    await collect(
      model.stream({
        system: "S",
        messages: [
          {
            role: "user",
            content: "Build this",
            attachments: [
              { kind: "image", mediaType: "image/png", data: png },
              { kind: "pdf", mediaType: "application/pdf", data: pdf },
              { kind: "image-url", url: "https://example.com/a.png" },
            ],
          },
        ],
        tools: [],
      }),
    );

    expect(requests[0].body.messages[0].content).toEqual([
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: btoa("\x01\x02\x03"),
        },
      },
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: btoa("\x04\x05"),
        },
      },
      {
        type: "image",
        source: { type: "url", url: "https://example.com/a.png" },
      },
      { type: "text", text: "Build this" },
    ]);
  });

  it("replays its own state verbatim, rebuilds other assistant messages, and batches tool results", async () => {
    const own = [{ type: "thinking", thinking: "", signature: "sig" }, call];
    const { client, requests } = fakeAnthropic([{ text: ["ok"] }]);
    const model = createAnthropicAdapter({ client, model: "claude-test" });

    await collect(
      model.stream({
        system: "S",
        messages: [
          user("One"),
          {
            role: "assistant",
            content: "Hi",
            toolCalls: [
              { id: "a", name: "apply_operations", input: '{"ops":"[]"}' },
            ],
            state: { adapter: "vercel", content: [] },
          },
          {
            role: "tool",
            toolCallId: "a",
            name: "apply_operations",
            content: "Applied.",
          },
          {
            role: "assistant",
            content: "",
            toolCalls: [
              { id: "tu_1", name: "apply_operations", input: { ops: "[]" } },
              { id: "tu_2", name: "apply_operations", input: { ops: "[]" } },
            ],
            state: { adapter: "anthropic", content: own },
          },
          {
            role: "tool",
            toolCallId: "tu_1",
            name: "apply_operations",
            content: "Applied.",
          },
          {
            role: "tool",
            toolCallId: "tu_2",
            name: "apply_operations",
            content: "Refused.",
          },
          { role: "assistant", content: "" },
          user("Two"),
        ],
        tools: [],
      }),
    );

    expect(requests[0].body.messages).toEqual([
      { role: "user", content: [{ type: "text", text: "One" }] },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Hi" },
          {
            type: "tool_use",
            id: "a",
            name: "apply_operations",
            input: { ops: "[]" },
          },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "a", content: "Applied." },
        ],
      },
      { role: "assistant", content: own },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "tu_1", content: "Applied." },
          { type: "tool_result", tool_use_id: "tu_2", content: "Refused." },
        ],
      },
      { role: "user", content: [{ type: "text", text: "Two" }] },
    ]);
  });

  it("reports cache reads and writes when the API does", async () => {
    const { client } = fakeAnthropic([
      {
        text: ["ok"],
        usage: {
          input_tokens: 4,
          output_tokens: 2,
          cache_read_input_tokens: 900,
          cache_creation_input_tokens: 30,
        },
      },
    ]);
    const parts = await collect(
      createAnthropicAdapter({ client, model: "m" }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [],
      }),
    );
    expect(parts.at(-1)).toEqual({
      type: "usage",
      inputTokens: 4,
      outputTokens: 2,
      cacheReadInputTokens: 900,
      cacheWriteInputTokens: 30,
    });
  });

  it("throws the provider error for a refusal", async () => {
    const { client } = fakeAnthropic([{ stopReason: "refusal", content: [] }]);
    const failure = collect(
      createAnthropicAdapter({ client, model: "m" }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [],
      }),
    );
    await expect(failure).rejects.toBeInstanceOf(SdkError);
    await expect(failure).rejects.toMatchObject({
      code: "ai_provider_error",
      statusCode: 502,
    });
  });

  it.each(["max_tokens", "model_context_window_exceeded"])(
    "throws ai_output_invalid when %s cut a tool call off",
    async (stopReason) => {
      const { client } = fakeAnthropic([{ stopReason, content: [call] }]);
      await expect(
        collect(
          createAnthropicAdapter({ client, model: "m" }).stream({
            system: "S",
            messages: [user("Hi")],
            tools: [applyOperationsTool],
          }),
        ),
      ).rejects.toMatchObject({ code: "ai_output_invalid", statusCode: 422 });
    },
  );

  it("keeps cut-off text without a tool call", async () => {
    const { client } = fakeAnthropic([
      { text: ["Partial"], stopReason: "max_tokens" },
    ]);
    const parts = await collect(
      createAnthropicAdapter({ client, model: "m" }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [],
      }),
    );
    expect(parts[0]).toEqual({ type: "text", text: "Partial" });
  });

  it("turns a 429 into a ThrottledError and rethrows other errors unchanged", async () => {
    const limited = Object.assign(new Error("rate"), {
      status: 429,
      headers: new Headers({ "retry-after": "2" }),
    });
    const broken = Object.assign(new Error("boom"), { status: 500 });
    const { client } = fakeAnthropic([{ error: limited }, { error: broken }]);
    const model = createAnthropicAdapter({ client, model: "m" });

    const first = collect(
      model.stream({ system: "S", messages: [user("Hi")], tools: [] }),
    );
    await expect(first).rejects.toBeInstanceOf(ThrottledError);
    await expect(first).rejects.toMatchObject({ retryAfterMs: 2000 });
    await expect(
      collect(model.stream({ system: "S", messages: [user("Hi")], tools: [] })),
    ).rejects.toBe(broken);
  });

  it("rejects an abort during finalMessage without yielding state or tool calls", async () => {
    const controller = new AbortController();
    const reason = new Error("Cancelled Anthropic turn");
    const { client } = fakeAnthropic([
      {
        text: ["On it."],
        content: [call],
        stopReason: "tool_use",
        onFinal: () => controller.abort(reason),
      },
    ]);
    const parts: AiModelPart[] = [];
    const result = (async () => {
      for await (const part of createAnthropicAdapter({
        client,
        model: "m",
      }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [applyOperationsTool],
        signal: controller.signal,
      })) {
        parts.push(part);
      }
    })();

    await expect(result).rejects.toBe(reason);
    expect(
      parts.filter(
        (part) => part.type === "tool-call" || part.type === "state",
      ),
    ).toEqual([]);
    expect(parts).toEqual([{ type: "text", text: "On it." }]);
  });

  it("rejects an abort before yielding buffered text deltas", async () => {
    const controller = new AbortController();
    const reason = new Error("Cancelled Anthropic text");
    const { client } = fakeAnthropic([
      { text: ["First", "Too late", "Also too late"], checkSignal: false },
    ]);
    const parts: AiModelPart[] = [];
    const result = (async () => {
      for await (const part of createAnthropicAdapter({
        client,
        model: "m",
      }).stream({
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

  it("passes the signal to the client", async () => {
    const { client, requests } = fakeAnthropic([{ text: ["ok"] }]);
    const controller = new AbortController();
    await collect(
      createAnthropicAdapter({ client, model: "m" }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [],
        signal: controller.signal,
      }),
    );
    expect(requests[0].signal).toBe(controller.signal);
  });
});
