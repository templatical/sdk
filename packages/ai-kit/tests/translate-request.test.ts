import { describe, expect, it } from "vitest";
import * as server from "../src/server";
import { aiRoutePath, matchAiRoute } from "../src";
import type { TranslationRequest } from "@templatical/types";

const body: TranslationRequest = {
  templateId: null,
  sourceLocale: "en",
  targetLocale: "de",
  fields: [
    { id: "p/content", format: "html", text: '<p>Hello <x id="1"/></p>' },
  ],
};
const post = (value: unknown, template = "_") =>
  new Request(`https://x.test/templates/${template}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });

it("routes translation without a template and URI-encodes template ids", () => {
  expect(aiRoutePath("translate", { template: "_" })).toBe(
    "/templates/_/translate",
  );
  expect(aiRoutePath("translate", { template: "t/1" })).toBe(
    "/templates/t%2F1/translate",
  );
  expect(matchAiRoute("POST", "/api/templates/_/translate")).toEqual({
    route: "translate",
    template: "_",
    message: null,
  });
});

describe.each(["readTranslationRequest", "readAiRequest"] as const)(
  "%s translation",
  (reader) => {
    const read = (request: Request) =>
      (server as unknown as Record<string, (r: Request) => Promise<unknown>>)[
        reader
      ](request);
    it("reads the body on /templates/_/translate", async () => {
      expect(await read(post(body))).toEqual(
        reader === "readAiRequest"
          ? { route: "translate", template: "_", sessionId: null, body }
          : body,
      );
    });
    it.each([
      null,
      {},
      { ...body, fields: [] },
      { ...body, sourceLocale: "en_US" },
      { ...body, targetLocale: "x" },
      { ...body, templateId: 7 },
      { ...body, fields: [{ id: "a", format: "markdown", text: "Hi" }] },
      { ...body, fields: [{ id: "", format: "text", text: "Hi" }] },
      { ...body, fields: [{ id: "a", format: "text", text: 7 }] },
      {
        ...body,
        fields: [
          { id: "a", format: "text", text: "Hi" },
          { id: "a", format: "text", text: "Hi" },
        ],
      },
    ])("rejects malformed body %#", async (value) => {
      await expect(read(post(value))).rejects.toMatchObject({
        name: "SdkError",
        statusCode: 422,
      });
    });
    it("accepts the editor's language tags beyond 35 characters", async () => {
      const targetLocale = "en-Latn-US-variant1-variant2-variant3";
      expect(await read(post({ ...body, targetLocale }))).toMatchObject(
        reader === "readAiRequest"
          ? { body: { targetLocale } }
          : { targetLocale },
      );
    });
    it("rejects malformed JSON", async () => {
      await expect(
        read(
          new Request("https://x.test/templates/_/translate", {
            method: "POST",
            body: "{",
          }),
        ),
      ).rejects.toMatchObject({ statusCode: 422 });
    });
    it.each(
      [
        Array.from({ length: 51 }, (_, i) => ({
          id: String(i),
          format: "text",
          text: "Hi",
        })),
        [{ id: "a", format: "text", text: "x".repeat(20_001) }],
      ].map((fields) => ({ fields })),
    )("rejects oversized input %# with the wire error", async ({ fields }) => {
      await expect(read(post({ ...body, fields }))).rejects.toMatchObject({
        code: "content_too_large",
        statusCode: 413,
      });
    });
    it("accepts both inclusive limits", async () => {
      const fields = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        format: "text",
        text: "x".repeat(400),
      }));
      expect(await read(post({ ...body, fields }))).toMatchObject(
        reader === "readAiRequest" ? { body: { fields } } : { fields },
      );
    });
  },
);
