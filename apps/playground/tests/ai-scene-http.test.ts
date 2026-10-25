import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpAiProvider } from "@templatical/ai-kit/client";
import { getScene } from "../src/scenes";

// Execute the displayed JavaScript with only its host boundaries supplied.
// The live scene uses local storage, so exercising it would miss this adapter.
async function editorFromSnippet(fetch: typeof globalThis.fetch) {
  const snippet = getScene("ai")!
    .snippet.replace(/^import .*;\n/gm, "")
    .replace(/await editor.load\("tpl_123"\);/, "");
  const run = new Function(
    "fetch",
    "init",
    "document",
    "createHttpAiProvider",
    `return (async () => { ${snippet}\nreturn editor; })();`,
  );
  return (
    await run(
      fetch,
      async (config: unknown) => config,
      { getElementById: () => ({}) },
      createHttpAiProvider,
    )
  );
}

afterEach(() => vi.unstubAllGlobals());
async function templatesFromSnippet(fetch: typeof globalThis.fetch) {
  return (await editorFromSnippet(fetch)).templates;
}

describe("displayed AI scene HTTP persistence", () => {
  it("labels a save as JSON and preserves the patch and response", async () => {
    let request: RequestInit | undefined;
    const templates = await templatesFromSnippet(async (_input, init) => {
      request = init;
      return Response.json({ id: "tpl_123", name: "Saved" });
    });
    const patch = { name: "Saved" };
    expect(await templates.save("tpl_123", patch)).toEqual({
      id: "tpl_123",
      name: "Saved",
    });
    expect(request?.method).toBe("PATCH");
    expect(new Headers(request?.headers).get("Content-Type")).toBe(
      "application/json",
    );
    expect(JSON.parse(request?.body as string)).toEqual(patch);
  });

  it.each(["load", "save"])(
    "rejects a failed %s with its HTTP status and refusal fields",
    async (method) => {
      const templates = await templatesFromSnippet(async () =>
        Response.json(
          { message: "Forbidden", code: "feature_unavailable" },
          { status: 403 },
        ),
      );
      await expect(
        templates[method]("tpl_123", { name: "Test" }),
      ).rejects.toMatchObject({
        message: "Forbidden",
        statusCode: 403,
        code: "feature_unavailable",
      });
    },
  );
});

it("authenticates the displayed AI request with the app session cookie without injected helpers", async () => {
  const fetchRequest = vi.fn<typeof fetch>(async () => new Response('data: {"type":"done","messageId":null}\n\n', { headers: { "Content-Type": "text/event-stream", "Templatical-AI-Wire": "1" } }));
  vi.stubGlobal("fetch", fetchRequest);
  const config = await editorFromSnippet(fetchRequest);
  await config.ai.chat({ templateId: "tpl_123", sessionId: "session", content: { blocks: [], settings: { width: 600 } }, revision: null, mergeTags: { syntax: "liquid", tags: [] }, message: "Hi", selectedBlockId: null, attachments: [] }, { onText: () => {}, onApplied: () => {}, onOperations: async () => ({ applied: true, inverse: [] }) }, new AbortController().signal);
  expect(fetchRequest).toHaveBeenCalledExactlyOnceWith("/api/ai/templates/tpl_123/ai/generate", expect.objectContaining({ credentials: "include" }));
  expect(new Headers(fetchRequest.mock.calls[0][1]?.headers).has("Authorization")).toBe(false);
});
