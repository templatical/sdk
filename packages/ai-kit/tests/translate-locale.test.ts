import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpAiProvider } from "../src/client";
import {
  buildAltTextRequest,
  buildEditingPrompt,
  buildRewritePrompt,
  readAiRequest,
  runEditingTurn,
} from "../src/server";
import { runAiWireConformance } from "../src/testing";
import { createReferenceHandler } from "./helpers/reference-server";
import { scriptedModel } from "./helpers/scripted-model";
import { serve } from "./helpers/serve";

const content = { blocks: [], settings: { width: 600, locale: "de" } } as never;
const mergeTags = { syntax: "liquid" as const, tags: [] };
const finding = {
  ruleId: "a11y.button-vague-label",
  message: "m",
  suggestion: "s",
  reference: "https://example.com",
  blockId: null,
};
const bodies = {
  generate: {
    message: "Hi",
    selectedBlockId: null,
    attachments: [],
    mergeTags,
    content,
    revision: null,
  },
  "fix-finding": { finding, mergeTags, content, revision: null },
  "rewrite-text": {
    html: "<p>Hi</p>",
    preset: "shorten",
    language: null,
    instruction: null,
    mergeTags,
  },
};
const post = (route: string, body: unknown) =>
  new Request(`https://x.test/templates/t/ai/${route}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
afterEach(() => vi.unstubAllGlobals());

describe.each(Object.entries(bodies))("locale reader: %s", (route, body) => {
  it.each(["de", "pt-BR", null])("parses locale %s", async (locale) => {
    expect(await readAiRequest(post(route, { ...body, locale }))).toMatchObject(
      { body: { locale } },
    );
  });
  it.each(["en_US", "x", 7])("rejects malformed locale %s", async (locale) => {
    await expect(
      readAiRequest(post(route, { ...body, locale })),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
  it("accepts the editor's language tags beyond 35 characters", async () => {
    const locale = "en-Latn-US-variant1-variant2-variant3";
    expect(await readAiRequest(post(route, { ...body, locale }))).toMatchObject(
      { body: { locale } },
    );
  });
  it("normalizes an older editor's absent locale to null", async () => {
    expect(await readAiRequest(post(route, body))).toMatchObject({
      body: { locale: null },
    });
  });
});
it.each(["de", null])(
  "carries locale %s from every HTTP route through the reader",
  async (locale) => {
    const seen: unknown[] = [];
    vi.stubGlobal("fetch", async (input: string, init: RequestInit) => {
      const read = await readAiRequest(new Request(input, init));
      seen.push(read && "body" in read ? read.body : null);
      const done =
        read?.route === "rewriteText"
          ? { html: "<p>Hallo</p>" }
          : read?.route === "altText"
            ? { alt: "Hallo" }
            : { messageId: null };
      return new Response(
        `data: ${JSON.stringify({ type: "done", ...done })}\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      );
    });
    const provider = createHttpAiProvider({ baseUrl: "https://x.test" });
    const base = {
      templateId: "t",
      sessionId: "s",
      locale,
      content,
      mergeTags,
      revision: null,
    };
    const handlers = {
      onText: () => {},
      onApplied: () => {},
      onOperations: async () => ({ applied: true as const, inverse: [] }),
    };
    for (const attachments of [
      [],
      [
        {
          file: new Blob(["png"], { type: "image/png" }),
          kind: "image" as const,
          name: "x.png",
        },
      ],
    ])
      await (provider.chat as Function)(
        { ...base, ...bodies.generate, attachments },
        handlers,
        new AbortController().signal,
      );
    await (provider.fixFinding as Function)(
      { ...base, finding },
      handlers,
      new AbortController().signal,
    );
    await (provider.rewrite as Function)(
      { ...base, ...bodies["rewrite-text"] },
      handlers,
      new AbortController().signal,
    );
    // Alt text already requires a concrete content language, including in the default view.
    await (provider.altText as Function)(
      {
        templateId: "t",
        sessionId: "s",
        blockId: "i",
        image: { url: "https://x.test/a.png" },
        currentAlt: null,
        linkHref: null,
        nearbyText: "Hi",
        locale: locale ?? "en",
        maxLength: 125,
      },
      new AbortController().signal,
    );
    expect(seen).toHaveLength(5);
    for (const body of seen.slice(0, 4)) expect(body).toMatchObject({ locale });
    expect(seen[4]).toMatchObject({ locale: locale ?? "en" });
  },
);
it("parses multipart locale and refuses malformed JSON or tag", async () => {
  for (const locale of ['"de"', "null", '"en_US"', "{"]) {
    const form = new FormData();
    form.set("message", "Hi");
    form.set("content", JSON.stringify(content));
    form.set("mergeTags", JSON.stringify(mergeTags));
    form.set("locale", locale);
    const read = readAiRequest(
      new Request("https://x.test/templates/t/ai/generate", {
        method: "POST",
        body: form,
      }),
    );
    if (locale === '"de"' || locale === "null")
      await expect(read).resolves.toMatchObject({
        body: { locale: JSON.parse(locale) },
      });
    else await expect(read).rejects.toMatchObject({ statusCode: 422 });
  }
});
it("names the active language in editing, rewrite and alt-text prompts", () => {
  const input = {
    content,
    mergeTags,
    selectedBlockId: null,
    request: "Change title",
    locale: "de",
  };
  expect(buildEditingPrompt(input)).toContain("German (de)");
  expect(
    buildRewritePrompt({
      html: "Hi",
      preset: "shorten",
      language: null,
      instruction: null,
      locale: "de",
    } as never),
  ).toContain("German (de)");
  expect(
    buildAltTextRequest({
      templateId: "t",
      sessionId: "s",
      blockId: "i",
      image: { url: "https://x.test/a.png" },
      currentAlt: null,
      linkHref: null,
      nearbyText: "Hi",
      locale: "de",
      maxLength: 125,
    }).system,
  ).toContain("German (de)");
});
it("carries the language into runEditingTurn's model prompt", async () => {
  const model = scriptedModel([[{ type: "text", text: "Done" }]]);
  await runEditingTurn({
    request: {
      content,
      mergeTags,
      selectedBlockId: null,
      request: "Change title",
      locale: "de",
    } as never,
    model,
    write: () => {},
  });
  expect(model.calls[0].messages[0].content).toContain("German (de)");
});
it.each(["pt-BR", null])(
  "wire conformance sends locale %s through JSON, multipart, Fix, Rewrite and alt text",
  async (locale) => {
    const seen: { route: string; locale: unknown; multipart: boolean }[] = [];
    const reference = createReferenceHandler();
    const server = await serve(async (request) => {
      const read = await readAiRequest(request.clone()).catch(() => null);
      if (read && "body" in read && "locale" in read.body)
        seen.push({
          route: read.route,
          locale: read.body.locale,
          multipart:
            request.headers
              .get("Content-Type")
              ?.startsWith("multipart/form-data") ?? false,
        });
      return reference(request);
    });
    try {
      const report = await runAiWireConformance({
        baseUrl: server.baseUrl,
        locale,
      } as never);
      expect(report.ok).toBe(true);
      for (const route of ["generate", "fixFinding", "rewriteText", "altText"])
        expect(seen).toContainEqual(
          expect.objectContaining({
            route,
            locale: route === "altText" ? (locale ?? "en") : locale,
          }),
        );
      expect(seen).toContainEqual({
        route: "generate",
        locale,
        multipart: true,
      });
    } finally {
      await server.close();
    }
  },
);

it("round-trips an older attachment request with locale omitted", async () => {
  let received: Awaited<ReturnType<typeof readAiRequest>> = null;
  vi.stubGlobal("fetch", async (input: string, init: RequestInit) => {
    received = await readAiRequest(new Request(input, init));
    return new Response('data: {"type":"done","messageId":null}\n\n', {
      headers: { "Content-Type": "text/event-stream" },
    });
  });
  const provider = createHttpAiProvider({ baseUrl: "https://x.test" });
  await expect(
    (provider.chat as Function)(
      {
        ...bodies.generate,
        templateId: "t",
        sessionId: "s",
        attachments: [
          {
            file: new Blob(["png"], { type: "image/png" }),
            kind: "image",
            name: "x.png",
          },
        ],
      },
      {
        onText: () => {},
        onApplied: () => {},
        onOperations: async () => ({ applied: true, inverse: [] }),
      },
      new AbortController().signal,
    ),
  ).resolves.toEqual({ messageId: null, text: "" });
  expect(received).toMatchObject({ route: "generate", body: { locale: null } });
  if (received?.route !== "generate") throw new Error("Expected generate");
  expect(received.body.attachments[0]).toMatchObject({
    kind: "image",
    name: "x.png",
  });
  expect(await received.body.attachments[0].file.text()).toBe("png");
});

it("uses the Translate target as the output language while retaining the German view as context", () => {
  expect(
    buildRewritePrompt({
      html: "<p>Hallo</p>",
      preset: "translate",
      language: "fr",
      instruction: null,
      locale: "de",
    }),
  ).toBe(
    'Active language: German (de).\n\nInstruction: Translate it into the language with the BCP 47 tag "fr".\n\nText:\n<p>Hallo</p>',
  );
});
