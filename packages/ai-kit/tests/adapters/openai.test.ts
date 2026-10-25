import { describe, expect, it } from "vitest";
import { ThrottledError } from "@templatical/types";
import { createOpenAiAdapter } from "../../src/adapters/openai";
import type { AiModelMessage, AiModelPart } from "../../src/server";
import { applyOperationsTool } from "../../src/server";
import { fakeOpenAi } from "../helpers/fake-providers";

async function collect(
  parts: AsyncIterable<AiModelPart>,
): Promise<AiModelPart[]> {
  const out: AiModelPart[] = [];
  for await (const part of parts) out.push(part);
  return out;
}

const user = (content: string): AiModelMessage => ({ role: "user", content });

describe("createOpenAiAdapter", () => {
  it("streams text, accumulates tool calls by index, and reports usage with cached tokens", async () => {
    const { client } = fakeOpenAi([
      {
        deltas: [
          { delta: { content: "On " } },
          { delta: { content: "it." } },
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  type: "function",
                  function: { name: "apply_operations", arguments: '{"ops":' },
                },
              ],
            },
          },
          {
            delta: {
              tool_calls: [
                {
                  index: 1,
                  id: "call_2",
                  type: "function",
                  function: {
                    name: "apply_operations",
                    arguments: '{"ops":"[]"}',
                  },
                },
              ],
            },
          },
          {
            delta: {
              tool_calls: [{ index: 0, function: { arguments: '"[]"}' } }],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 9,
          total_tokens: 109,
          prompt_tokens_details: { cached_tokens: 80 },
        },
      },
    ]);

    const parts = await collect(
      createOpenAiAdapter({ client, model: "gpt-test" }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [applyOperationsTool],
      }),
    );

    expect(parts).toEqual([
      { type: "text", text: "On " },
      { type: "text", text: "it." },
      {
        type: "tool-call",
        id: "call_1",
        name: "apply_operations",
        input: '{"ops":"[]"}',
      },
      {
        type: "tool-call",
        id: "call_2",
        name: "apply_operations",
        input: '{"ops":"[]"}',
      },
      {
        type: "usage",
        inputTokens: 20,
        outputTokens: 9,
        cacheReadInputTokens: 80,
      },
    ]);
  });

  it("reads only choice 0 across interleaved completions and keeps final usage", async () => {
    const { client } = fakeOpenAi([
      {
        deltas: [
          { choiceIndex: 0, delta: { content: "Only " } },
          { choiceIndex: 1, delta: { content: "Ignore " } },
          {
            choiceIndex: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_0",
                  type: "function",
                  function: { name: "apply_operations", arguments: '{"ops":' },
                },
              ],
            },
          },
          {
            choiceIndex: 1,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  type: "function",
                  function: { name: "other_tool", arguments: '{"other":true}' },
                },
              ],
            },
          },
          { choiceIndex: 0, delta: { content: "this." } },
          {
            choiceIndex: 0,
            delta: {
              tool_calls: [{ index: 0, function: { arguments: '"[]"}' } }],
            },
            finish_reason: "tool_calls",
          },
          {
            choiceIndex: 1,
            delta: { content: "that." },
            finish_reason: "stop",
          },
        ],
      },
    ]);

    const parts = await collect(
      createOpenAiAdapter({ client, model: "m" }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [applyOperationsTool],
      }),
    );

    expect(parts).toEqual([
      { type: "text", text: "Only " },
      { type: "text", text: "this." },
      {
        type: "tool-call",
        id: "call_0",
        name: "apply_operations",
        input: '{"ops":"[]"}',
      },
      { type: "usage", inputTokens: 12, outputTokens: 4 },
    ]);
  });

  it("sends the system message first, tools, usage streaming, maxTokens and params", async () => {
    const { client, requests } = fakeOpenAi([
      { deltas: [{ delta: { content: "ok" }, finish_reason: "stop" }] },
    ]);
    await collect(
      createOpenAiAdapter({
        client,
        model: "gpt-test",
        maxTokens: 700,
        params: { reasoning_effort: "low" },
      }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [applyOperationsTool],
      }),
    );

    expect(requests[0].body).toEqual({
      reasoning_effort: "low",
      model: "gpt-test",
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: 700,
      messages: [
        { role: "system", content: "S" },
        { role: "user", content: [{ type: "text", text: "Hi" }] },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "apply_operations",
            description: applyOperationsTool.description,
            parameters: applyOperationsTool.inputSchema,
          },
        },
      ],
    });
  });

  it("omits max_completion_tokens and tools when not given, and reports usage without cache fields", async () => {
    const { client, requests } = fakeOpenAi([
      { deltas: [{ delta: { content: "ok" }, finish_reason: "stop" }] },
    ]);
    const parts = await collect(
      createOpenAiAdapter({ client, model: "gpt-test" }).stream({
        system: "S",
        messages: [user("Hi")],
        tools: [],
      }),
    );
    expect(requests[0].body).not.toHaveProperty("max_completion_tokens");
    expect(requests[0].body).not.toHaveProperty("tools");
    expect(parts.at(-1)).toEqual({
      type: "usage",
      inputTokens: 12,
      outputTokens: 4,
    });
  });

  it("sends files before the text: images as image_url data URLs, a PDF as a file part", async () => {
    const { client, requests } = fakeOpenAi([
      { deltas: [{ delta: { content: "ok" }, finish_reason: "stop" }] },
    ]);
    await collect(
      createOpenAiAdapter({ client, model: "m" }).stream({
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
        tools: [],
      }),
    );

    expect(requests[0].body.messages[1].content).toEqual([
      {
        type: "image_url",
        image_url: { url: `data:image/png;base64,${btoa("\x01\x02\x03")}` },
      },
      {
        type: "file",
        file: {
          filename: "attachment-2.pdf",
          file_data: `data:application/pdf;base64,${btoa("\x04\x05")}`,
        },
      },
      { type: "image_url", image_url: { url: "https://example.com/a.png" } },
      { type: "text", text: "Build this" },
    ]);
  });

  it("maps assistant tool calls and tool results, and ignores state", async () => {
    const { client, requests } = fakeOpenAi([
      { deltas: [{ delta: { content: "ok" }, finish_reason: "stop" }] },
    ]);
    await collect(
      createOpenAiAdapter({ client, model: "m" }).stream({
        system: "S",
        messages: [
          user("One"),
          {
            role: "assistant",
            content: "",
            toolCalls: [
              { id: "call_1", name: "apply_operations", input: { ops: "[]" } },
            ],
            state: { adapter: "anthropic", content: [] },
          },
          {
            role: "tool",
            toolCallId: "call_1",
            name: "apply_operations",
            content: "Applied.",
          },
        ],
        tools: [],
      }),
    );

    expect(requests[0].body.messages.slice(1)).toEqual([
      { role: "user", content: [{ type: "text", text: "One" }] },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "apply_operations", arguments: '{"ops":"[]"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: "Applied." },
    ]);
  });

  it.each([
    ["absent", undefined],
    [
      "foreign",
      { adapter: "anthropic", content: [{ type: "text", text: "Ignored" }] },
    ],
  ])("omits empty assistant messages with %s state", async (_label, state) => {
    const { client, requests } = fakeOpenAi([{}]);
    await collect(
      createOpenAiAdapter({ client, model: "m" }).stream({
        system: "S",
        messages: [
          user("One"),
          { role: "assistant", content: "", state },
          { role: "assistant", content: "", toolCalls: [], state },
          { role: "assistant", content: "Kept" },
          user("Two"),
        ],
        tools: [],
      }),
    );

    expect(requests[0].body.messages).toEqual([
      { role: "system", content: "S" },
      { role: "user", content: [{ type: "text", text: "One" }] },
      { role: "assistant", content: "Kept" },
      { role: "user", content: [{ type: "text", text: "Two" }] },
    ]);
  });

  it.each([
    [{ delta: { refusal: "I can't help with that." } }],
    [{ delta: {}, finish_reason: "content_filter" }],
  ])("throws the provider error for a refusal (%j)", async (chunk) => {
    const { client } = fakeOpenAi([{ deltas: [chunk] }]);
    await expect(
      collect(
        createOpenAiAdapter({ client, model: "m" }).stream({
          system: "S",
          messages: [user("Hi")],
          tools: [],
        }),
      ),
    ).rejects.toMatchObject({ code: "ai_provider_error", statusCode: 502 });
  });

  it("throws ai_output_invalid when the length limit cut a tool call off, and keeps cut-off text", async () => {
    const { client } = fakeOpenAi([
      {
        deltas: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  function: { name: "apply_operations", arguments: '{"op' },
                },
              ],
            },
            finish_reason: "length",
          },
        ],
      },
      { deltas: [{ delta: { content: "Partial" }, finish_reason: "length" }] },
    ]);
    const model = createOpenAiAdapter({ client, model: "m" });
    await expect(
      collect(
        model.stream({
          system: "S",
          messages: [user("Hi")],
          tools: [applyOperationsTool],
        }),
      ),
    ).rejects.toMatchObject({ code: "ai_output_invalid" });
    expect(
      (
        await collect(
          model.stream({ system: "S", messages: [user("Hi")], tools: [] }),
        )
      )[0],
    ).toEqual({ type: "text", text: "Partial" });
  });

  it.each(["normal end", "late chunk"])(
    "rejects an abort without yielding buffered tool calls (%s)",
    async (ending) => {
      const controller = new AbortController();
      const reason = new Error("Cancelled OpenAI turn");
      const { client } = fakeOpenAi([
        {
          deltas: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_1",
                    type: "function",
                    function: { name: "apply_operations", arguments: '{"op' },
                  },
                ],
              },
            },
          ],
          usage: null,
        },
      ]);
      const create = client.chat.completions.create;
      client.chat.completions.create = async (body, options) => {
        const stream = await create(body, options);
        return (async function* () {
          for await (const chunk of stream) {
            yield chunk;
            controller.abort(reason);
            if (ending === "late chunk")
              yield {
                ...chunk,
                choices: [
                  {
                    index: 0,
                    delta: { content: "Too late." },
                    finish_reason: null,
                  },
                ],
              };
          }
        })();
      };
      const parts: AiModelPart[] = [];
      const result = (async () => {
        for await (const part of createOpenAiAdapter({
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
      expect(parts.filter((part) => part.type === "tool-call")).toEqual([]);
      expect(parts).toEqual([]);
    },
  );

  it("turns a 429 into a ThrottledError and rethrows other errors unchanged, passing the signal", async () => {
    const limited = Object.assign(new Error("rate"), {
      status: 429,
      headers: new Headers({ "retry-after": "4" }),
    });
    const broken = Object.assign(new Error("boom"), { status: 500 });
    const { client, requests } = fakeOpenAi([
      { error: limited },
      { error: broken },
    ]);
    const model = createOpenAiAdapter({ client, model: "m" });
    const controller = new AbortController();

    const first = collect(
      model.stream({
        system: "S",
        messages: [user("Hi")],
        tools: [],
        signal: controller.signal,
      }),
    );
    await expect(first).rejects.toBeInstanceOf(ThrottledError);
    await expect(first).rejects.toMatchObject({ retryAfterMs: 4000 });
    expect(requests[0].signal).toBe(controller.signal);
    await expect(
      collect(model.stream({ system: "S", messages: [user("Hi")], tools: [] })),
    ).rejects.toBe(broken);
  });
});
