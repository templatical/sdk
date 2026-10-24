import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { AI_ERROR_MESSAGES } from "../../../packages/ai-kit/src";
import * as server from "../../../packages/ai-kit/src/server";
import { scriptedModel } from "../../../packages/ai-kit/tests/helpers/scripted-model";

function serverFence(locale: string): string {
  const page = readFileSync(
    join(import.meta.dirname, `../${locale}guide/bring-your-own-ai.md`),
    "utf8",
  );
  const fence = page.match(/```ts\n([\s\S]*?)```/);
  if (!fence) throw new Error("Missing guide server example");
  return fence[1];
}

function guideHandler(model: server.AiModelAdapter) {
  const js = ts.transpileModule(serverFence(""), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const exports: { handle?: (request: Request) => Promise<Response> } = {};
  new Function("require", "exports", js)((name: string) => {
    if (name === "@templatical/ai-kit") return { AI_ERROR_MESSAGES };
    if (name === "@templatical/ai-kit/server") return server;
    if (name === "./model") return { model };
    throw new Error(`Unexpected guide import: ${name}`);
  }, exports);
  if (!exports.handle) throw new Error("Missing guide handler");
  return exports.handle;
}

const request = () =>
  new Request("https://example.com/templates/t/ai/alt-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blockId: "hero",
      image: { url: "https://example.com/hero.png" },
      currentAlt: null,
      linkHref: null,
      nearbyText: "Shop mugs",
      locale: "en",
      maxLength: 60,
    }),
  });

describe("the guide's alt-text server", () => {
  it("keeps the English and German server fences byte-identical", () => {
    expect(serverFence("de/")).toBe(serverFence(""));
  });

  it("repairs a self-correcting answer and returns only the second draft", async () => {
    const answer =
      "First draft\nWait, I need to output only the final alt text…\nShop mugs";
    const model = scriptedModel([
      [{ type: "text", text: answer }],
      [{ type: "text", text: '"Image of Shop mugs"' }],
    ]);
    const response = await guideHandler(model)(request());
    expect(await response.text()).toBe(
      'data: {"type":"done","alt":"Shop mugs"}\n\n',
    );
    expect(model.calls).toHaveLength(2);
    expect(model.calls[1]).toEqual({
      system: model.calls[0].system,
      messages: [
        ...model.calls[0].messages,
        { role: "assistant", content: answer },
        {
          role: "user",
          content:
            "Your answer had several lines. Reply again with only the alt text: one line of plain text, at most 60 characters.",
        },
      ],
      tools: [],
    });
  });

  it("ends a second invalid draft with ai_output_invalid without a third call", async () => {
    const model = scriptedModel([
      [{ type: "text", text: "First draft\nCorrected draft" }],
      [{ type: "text", text: "<b>Shop mugs</b>" }],
      [{ type: "text", text: "Shop mugs" }],
    ]);
    const response = await guideHandler(model)(request());
    expect(await response.text()).toBe(
      'data: {"type":"error","code":"ai_output_invalid","message":"The AI couldn\'t produce a valid result. Try again."}\n\n',
    );
    expect(model.calls).toHaveLength(2);
  });
});
