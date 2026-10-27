import { describe, expect, it } from "vitest";
import { translateFields, SdkError } from "../src/server";
import type { TranslationRequest, TranslationResult } from "@templatical/types";
import type { AiModelAdapter } from "../src/server";
import { rejectingStream, scriptedModel } from "./helpers/scripted-model";

const request: TranslationRequest = {
  templateId: null,
  sourceLocale: "en",
  targetLocale: "de",
  fields: [
    {
      id: "p/content",
      format: "html",
      text: '<p>Hi <x id="1"/> <a href="__x2__">Shop</a></p>',
    },
    { id: "i/alt", format: "text", text: 'Hello <x id="1"/>' },
  ],
};
const answer = (fields: TranslationResult["fields"]) => [
  { type: "text" as const, text: JSON.stringify({ fields }) },
];
const good = {
  id: "p/content",
  text: '<p>Hallo <x id="1"/> <a href="__x2__">Kaufen</a></p>',
};

describe("translateFields", () => {
  it("collects streaming JSON with no tools and prompts with languages and field formats", async () => {
    const text = JSON.stringify({
      fields: [good, { id: "i/alt", text: 'Hallo <x id="1"/>' }],
    });
    const model = scriptedModel([
      [
        { type: "text", text: text.slice(0, 12) },
        { type: "usage", inputTokens: 1, outputTokens: 2 },
        { type: "text", text: text.slice(12) },
      ],
    ]);
    expect(await translateFields({ request, model })).toEqual({
      fields: [good, { id: "i/alt", text: 'Hallo <x id="1"/>' }],
    });
    expect(model.calls).toHaveLength(1);
    expect(model.calls[0].tools).toEqual([]);
    const prompt = model.calls[0].messages[0].content;
    expect(model.calls[0].system).toContain('<x id="n"/>');
    expect(prompt).toContain("English");
    expect(prompt).toContain("German");
    expect(prompt).toContain(JSON.stringify(request.fields));
  });
  it.each([
    "Hallo",
    'Hallo <x id="1"/><x id="1"/>',
    'Hallo <x id="2"/>',
    "Hallo __x1____x2__",
  ])("repairs a bad placeholder multiset: %s", async (text) => {
    const model = scriptedModel([
      answer([good, { id: "i/alt", text }]),
      answer([{ id: "i/alt", text: 'Hallo <x id="1"/>' }]),
    ]);
    expect(await translateFields({ request, model })).toEqual({
      fields: [good, { id: "i/alt", text: 'Hallo <x id="1"/>' }],
    });
    expect(model.calls).toHaveLength(2);
    expect(model.calls[1].messages.at(-1)?.content).toContain("i/alt");
    expect(model.calls[1].messages.at(-1)?.content).not.toContain("p/content");
  });
  it("keeps valid fields across one repair, ignores unknown and rejects duplicate ids", async () => {
    const model = scriptedModel([
      answer([
        good,
        { id: "i/alt", text: 'A <x id="1"/>' },
        { id: "i/alt", text: 'B <x id="1"/>' },
        { id: "unknown", text: "x" },
      ]),
      answer([{ id: "i/alt", text: "lost tag" }]),
    ]);
    expect(await translateFields({ request, model })).toEqual({
      fields: [good],
    });
    expect(model.calls).toHaveLength(2);
  });
  it("repairs missing fields and accepts a partial result", async () => {
    const model = scriptedModel([answer([good]), answer([])]);
    expect(await translateFields({ request, model })).toEqual({
      fields: [good],
    });
    expect(model.calls[1].messages.at(-1)?.content).toContain("i/alt");
  });
  it.each([
    '{"fields":[',
    "I cannot translate this.",
    "garbage",
    '{"fields":null}',
  ])("repairs incomplete or unusable JSON: %s", async (text) => {
    const model = scriptedModel([
      [{ type: "text", text }],
      answer([good, { id: "i/alt", text: 'Hallo <x id="1"/>' }]),
    ]);
    expect((await translateFields({ request, model })).fields).toHaveLength(2);
    expect(model.calls).toHaveLength(2);
  });
  it.each(['{"fields":[', "I refuse.", '{"fields":[]}'])(
    "rejects after one unusable repair: %s",
    async (text) => {
      const model = scriptedModel([
        [{ type: "text", text }],
        [{ type: "text", text }],
      ]);
      await expect(translateFields({ request, model })).rejects.toMatchObject({
        code: "translation_failed",
        statusCode: 502,
      });
      expect(model.calls).toHaveLength(2);
    },
  );
  it("preserves prior valid fields when repair is cut off", async () => {
    expect(
      await translateFields({
        request,
        model: scriptedModel([answer([good]), [{ type: "text", text: "{" }]]),
      }),
    ).toEqual({ fields: [good] });
  });
  it("propagates AbortError unchanged without repair", async () => {
    const error = new DOMException("Stopped", "AbortError");
    const model: AiModelAdapter = {
      stream: () => rejectingStream(error),
    };
    await expect(translateFields({ request, model })).rejects.toBe(error);
  });
  it("checks an aborted signal before invoking the model", async () => {
    const stop = new AbortController();
    stop.abort();
    const model = scriptedModel([]);
    await expect(
      translateFields({ request, model, signal: stop.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(model.calls).toHaveLength(0);
  });
  it("checks abort while collecting model text", async () => {
    const stop = new AbortController();
    const model: AiModelAdapter = {
      async *stream() {
        yield { type: "text", text: "{" };
        stop.abort();
        yield { type: "text", text: "}" };
      },
    };
    await expect(
      translateFields({ request, model, signal: stop.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("rejects oversized direct requests before calling the model", async () => {
    const model = scriptedModel([]);
    await expect(
      translateFields({
        request: {
          ...request,
          fields: [{ id: "a", format: "text", text: "x".repeat(20_001) }],
        },
        model,
      }),
    ).rejects.toMatchObject({ code: "content_too_large" });
    expect(model.calls).toHaveLength(0);
  });
});

it.each(["ai_provider_error", "ai_output_invalid"])(
  "repairs adapter refusal or cut-off %s and rejects with translation_failed",
  async (code) => {
    let calls = 0;
    const model: AiModelAdapter = {
      stream() {
        calls++;
        return rejectingStream(new SdkError("Unusable response", 502, code));
      },
    };
    await expect(translateFields({ request, model })).rejects.toMatchObject({
      code: "translation_failed",
      statusCode: 502,
    });
    expect(calls).toBe(2);
  },
);

it("normalizes a plain model error and preserves recognized translation errors", async () => {
  const rejectingModel = (error: unknown): AiModelAdapter => ({
    stream: () => rejectingStream(error),
  });
  await expect(
    translateFields({
      request,
      model: rejectingModel(new Error("Model unavailable")),
    }),
  ).rejects.toMatchObject({
    name: "SdkError",
    code: "translation_failed",
    statusCode: 502,
  });
  for (const error of [
    new SdkError("Rate limited", 429, "rate_limited"),
    new SdkError("Allowance used", 403, "limit_reached"),
    new SdkError("Smaller batch", 413, "content_too_large"),
    new SdkError("Translation failed", 502, "translation_failed"),
    Object.assign(new Error("Provider limit"), { code: "rate_limited" }),
  ]) {
    await expect(
      translateFields({ request, model: rejectingModel(error) }),
    ).rejects.toBe(error);
  }
});
