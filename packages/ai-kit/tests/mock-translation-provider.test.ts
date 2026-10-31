import { describe, expect, it } from "vitest";
import { createMockTranslationProvider as create } from "../src/testing";
import type { TranslationRequest } from "@templatical/types";

const request: TranslationRequest = {
  templateId: null,
  sourceLocale: "en",
  targetLocale: "de",
  fields: [
    {
      id: "p/content",
      format: "html",
      text: '<p><x id="1"/>Hello <a href="__x2__">shop</a></p>',
    },
    { id: "i/alt", format: "text", text: 'Hello <x id="1"/>' },
  ],
};

describe("mock translation", () => {
  it("prefixes deterministically inside the first HTML text node and leaves both token forms untouched", async () => {
    const provider = create();
    const expected = {
      fields: [
        {
          id: "p/content",
          text: '<p><x id="1"/>[de] Hello <a href="__x2__">shop</a></p>',
        },
        { id: "i/alt", text: '[de] Hello <x id="1"/>' },
      ],
    };
    expect(
      await provider.translate(request, new AbortController().signal),
    ).toEqual(expected);
    expect(
      await provider.translate(request, new AbortController().signal),
    ).toEqual(expected);
    expect(request.fields[0].text).toBe(
      '<p><x id="1"/>Hello <a href="__x2__">shop</a></p>',
    );
  });
  it("uses recorded translations by target and id, including an empty string", async () => {
    const provider = create({
      translations: {
        de: { "i/alt": "", "p/content": "Aufgezeichnet" },
        fr: { "i/alt": "Bonjour" },
      },
    });
    expect(
      await provider.translate(request, new AbortController().signal),
    ).toEqual({
      fields: [
        { id: "p/content", text: "Aufgezeichnet" },
        { id: "i/alt", text: "" },
      ],
    });
    expect(
      (
        await provider.translate(
          { ...request, targetLocale: "fr" },
          new AbortController().signal,
        )
      ).fields[1].text,
    ).toBe("Bonjour");
  });
  it("handles a text node after an attribute containing >", async () => {
    const provider = create();
    expect(
      await provider.translate(
        {
          ...request,
          fields: [
            {
              id: "a",
              format: "html",
              text: '<a title="a > b" href="__x1__">Hi</a>',
            },
          ],
        },
        new AbortController().signal,
      ),
    ).toEqual({
      fields: [{ id: "a", text: '<a title="a > b" href="__x1__">[de] Hi</a>' }],
    });
  });
  it("rejects an already aborted call and interrupts a delayed call", async () => {
    const provider = create({ delayMs: 500 });
    const stop = new AbortController();
    const pending = provider.translate(request, stop.signal);
    stop.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await expect(
      provider.translate(request, stop.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("honours the delay", async () => {
    let settled = false;
    const pending = create({ delayMs: 30 })
      .translate(request, new AbortController().signal)
      .then(() => {
        settled = true;
      });
    await Promise.resolve();
    expect(settled).toBe(false);
    await pending;
    expect(settled).toBe(true);
  });
});
