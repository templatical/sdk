import { describe, expect, it } from "vitest";
import { createHttpAiProvider } from "@templatical/ai-kit/client";
import { getScene } from "../src/scenes";

// Execute the displayed JavaScript with only its host boundaries supplied.
// The live scene uses local storage, so exercising it would miss this adapter.
async function templatesFromSnippet(fetch: typeof globalThis.fetch) {
  const snippet = getScene("ai")!
    .snippet.replace(/^import .*;\n/gm, "")
    .replace(/await editor.load\("tpl_123"\);/, "");
  const run = new Function(
    "fetch",
    "init",
    "document",
    "getToken",
    "createHttpAiProvider",
    `return (async () => { ${snippet}\nreturn editor; })();`,
  );
  return (
    await run(
      fetch,
      async (config: unknown) => config,
      { getElementById: () => ({}) },
      async () => "test-token",
      createHttpAiProvider,
    )
  ).templates;
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
