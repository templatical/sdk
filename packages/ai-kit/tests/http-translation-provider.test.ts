import { describe, expect, it } from "vitest";
import { createHttpTranslationProvider as create } from "../src/client";
import {
  readTranslationRequest,
  translateFields,
  aiErrorResponse,
  aiJsonResponse,
} from "../src/server";
import type { TranslationRequest } from "@templatical/types";
import { scriptedModel } from "./helpers/scripted-model";

const request: TranslationRequest = {
  templateId: null,
  sourceLocale: "en",
  targetLocale: "de",
  fields: [{ id: "p/content", format: "text", text: 'Hi <x id="1"/>' }],
};

describe("HTTP translation", () => {
  it.each([null, "t/1"])(
    "posts JSON and auth headers to the translate route for %s",
    async (templateId) => {
      const seen: Request[] = [];
      let headersRead = 0;
      const provider = create({
        url: "https://api.test/base/",
        headers: async () => ({ Authorization: `Bearer ${++headersRead}` }),
        fetch: async (input, init) => {
          const req = new Request(input, init);
          seen.push(req);
          return Response.json({
            fields: [{ id: "p/content", text: 'Hallo <x id="1"/>' }],
          });
        },
      });
      for (let i = 0; i < 2; i++)
        expect(
          await provider.translate(
            { ...request, templateId },
            new AbortController().signal,
          ),
        ).toEqual({ fields: [{ id: "p/content", text: 'Hallo <x id="1"/>' }] });
      expect(seen[0].url).toBe(
        `https://api.test/base/templates/${templateId ? "t%2F1" : "_"}/translate`,
      );
      expect(seen[0].method).toBe("POST");
      expect(await seen[0].json()).toEqual({ ...request, templateId });
      expect(seen[0].headers.get("Content-Type")).toBe("application/json");
      expect(seen[0].headers.get("Accept")).toBe("application/json");
      expect(seen[0].headers.get("Templatical-AI-Wire")).toBe("1");
      expect(seen[1].headers.get("Authorization")).toBe("Bearer 2");
    },
  );
  it("runs the HTTP reader and streaming server together", async () => {
    const model = scriptedModel([
      [
        {
          type: "text",
          text: JSON.stringify({
            fields: [{ id: "p/content", text: 'Hallo <x id="1"/>' }],
          }),
        },
      ],
    ]);
    const provider = create({
      url: "https://api.test",
      fetch: async (input, init) => {
        try {
          return aiJsonResponse(
            await translateFields({
              request: await readTranslationRequest(new Request(input, init)),
              model,
            }),
          );
        } catch (error) {
          return aiErrorResponse(error);
        }
      },
    });
    expect(
      await provider.translate(request, new AbortController().signal),
    ).toEqual({ fields: [{ id: "p/content", text: 'Hallo <x id="1"/>' }] });
  });
  it.each([
    [429, "rate_limited"],
    [403, "limit_reached"],
    [413, "content_too_large"],
    [502, "translation_failed"],
  ] as const)("keeps wire error %s %s", async (status, code) => {
    const provider = create({
      url: "https://api.test",
      fetch: async () =>
        Response.json(
          { code, message: "Try later", limit: "translation" },
          { status, headers: { "Retry-After": "2" } },
        ),
    });
    await expect(
      provider.translate(request, new AbortController().signal),
    ).rejects.toMatchObject({
      code,
      statusCode: status,
      message: "Try later",
      details: { limit: "translation" },
    });
  });
  it.each([
    null,
    {},
    { fields: null },
    { fields: [{ id: 4, text: "x" }] },
    { fields: [{ id: "x", text: 4 }] },
  ])("rejects malformed success %#", async (body) => {
    const provider = create({
      url: "https://api.test",
      fetch: async () => Response.json(body),
    });
    await expect(
      provider.translate(request, new AbortController().signal),
    ).rejects.toMatchObject({ code: "translation_failed", statusCode: 502 });
  });
  it("accepts a partial response", async () => {
    const provider = create({
      url: "https://api.test",
      fetch: async () => Response.json({ fields: [] }),
    });
    expect(
      await provider.translate(request, new AbortController().signal),
    ).toEqual({ fields: [] });
  });
  it("maps broken JSON and network errors to translation_failed", async () => {
    for (const fetch of [
      async () => new Response("{"),
      async () => {
        throw new TypeError("offline");
      },
    ]) {
      await expect(
        create({ url: "https://api.test", fetch }).translate(
          request,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: "translation_failed", statusCode: 502 });
    }
  });
  it("aborts before transport and during auth setup", async () => {
    const stop = new AbortController();
    const provider = create({
      url: "https://api.test",
      headers: async () => {
        stop.abort();
        return {};
      },
      fetch: async () => {
        throw new Error("must not fetch");
      },
    });
    await expect(
      provider.translate(request, stop.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    await expect(
      provider.translate(request, stop.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("passes a live abort to fetch", async () => {
    const stop = new AbortController();
    const provider = create({
      url: "https://api.test",
      fetch: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
          stop.abort();
        }),
    });
    await expect(
      provider.translate(request, stop.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

it("keeps a plain model error inside the translation error contract over HTTP", async () => {
  const { createReferenceHandler } = await import("./helpers/reference-server");
  const handle = createReferenceHandler({
    async *stream() {
      throw new Error("Model unavailable");
      yield { type: "text", text: "" };
    },
  });
  const provider = create({
    url: "https://api.test",
    fetch: (input, init) => handle(new Request(input, init)),
  });
  await expect(
    provider.translate(request, new AbortController().signal),
  ).rejects.toMatchObject({
    name: "SdkError",
    code: "translation_failed",
    statusCode: 502,
  });
});
