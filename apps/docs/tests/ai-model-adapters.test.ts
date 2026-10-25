import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs generator, no types
import {
  inlineSnippetIncludes,
  snippetIncludes,
} from "../scripts/build-agent-surface.mjs";

const docs = resolve(import.meta.dirname, "..");
const root = resolve(docs, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const factories = [
  "createAnthropicAdapter",
  "createOpenAiAdapter",
  "createVercelAdapter",
];

describe("first-party model adapter documentation", () => {
  it.each(["", "de/"])(
    "%sguide gives agents the checked adapter and evaluation snippets",
    (locale) => {
      const page = `${locale}guide/bring-your-own-ai.md`;
      const source = read(`apps/docs/${page}`);
      expect(snippetIncludes(source)).toEqual(
        expect.arrayContaining([
          "@/snippets/model-anthropic.ts",
          "@/snippets/model-openai.ts",
          "@/snippets/model-vercel.ts",
          "@/snippets/evaluate-model.ts",
        ]),
      );
      const expanded = inlineSnippetIncludes(source, page, docs);
      for (const factory of factories) {
        expect(expanded).toContain(`export const model = ${factory}(`);
      }
      expect(expanded).toContain('import { model } from "./model.ts"');
      expect(source).toContain(
        locale
          ? "`evaluate.ts` neben Ihrer `model.ts`"
          : "`evaluate.ts` next to your `model.ts`",
      );
      expect(snippetIncludes(source)).not.toContain("@/snippets/model.ts");
      expect(source).toContain("features: { conversation: false }");
      expect(source).not.toContain("chatAttachments: false");
      expect(source).toContain(
        locale
          ? "Die Flags passen zum zustandslosen Server oben, mit Chat-Anhängen."
          : "Its flags match the stateless server above, with chat attachments on.",
      );
      expect(source).toContain(
        locale
          ? "Der Multipart-Chat muss bei einem PNG-Anhang nicht leeren Text liefern; bei fünf Anhängen muss das Backend eine JSON-Antwort mit Status 422 und `message` zurückgeben."
          : "The backend must answer multipart chat with a PNG attachment with non-empty text and reject five attachments with a JSON 422 response containing `message`.",
      );
      for (const field of [
        "maxTokens",
        "cacheReadInputTokens",
        "cacheWriteInputTokens",
        "retryAfterMs",
        "ai_output_invalid",
        "ai_provider_error",
      ])
        expect(source).toContain(`\`${field}\``);
    },
  );

  it.each(["", "de/"])(
    "%sAPI reference exposes factories, option types and entry points",
    (locale) => {
      const source = read(`apps/docs/${locale}api/ai-kit.md`);
      expect(source).toContain("<<< @/snippets/model-contract.ts");
      for (const factory of factories)
        expect(source).toContain(`\`${factory}\``);
      for (const options of [
        "AnthropicAdapterOptions",
        "OpenAiAdapterOptions",
        "VercelAdapterOptions",
      ])
        expect(source).toContain(`\`${options}\``);
      const files = source.split(locale ? "## Dateien\n" : "## Files\n")[1];
      for (const adapter of ["anthropic", "openai", "vercel"]) {
        expect(files).toContain(`@templatical/ai-kit/adapters/${adapter}`);
      }
      expect(source).toContain("cacheReadInputTokens");
      expect(source).toContain("cacheWriteInputTokens");
      expect(source).toContain(
        locale
          ? "deaktiviert den Verlauf und aktiviert Chat-Anhänge"
          : "turns off history and enables chat attachments",
      );
    },
  );

  it("README routes server integrators to optional SDK adapters", () => {
    const source = read("packages/ai-kit/README.md").split(
      "## On your server\n",
    )[1];
    for (const factory of factories) expect(source).toContain(`${factory}({`);
    expect(source).toContain("optional peers");
  });

  it("skill routes model integrations to first-party adapters with files enabled", () => {
    const source = read("skills/templatical/reference/providers.md");
    expect(source).toContain("@templatical/ai-kit/adapters/anthropic");
    expect(source).toContain("`/openai` or `/vercel`");
    expect(source).toContain(
      "The three first-party adapters accept these files",
    );
    expect(source).not.toContain("Text-only adapters set");
  });

  it("changeset releases the adapters and additive state and cache contract", () => {
    const path = ".changeset/ai-kit-model-adapters.md";
    expect(existsSync(resolve(root, path))).toBe(true);
    const source = read(path);
    expect(source).toContain('"@templatical/ai-kit": minor');
    for (const factory of factories) expect(source).toContain(`\`${factory}\``);
    expect(source).toContain('AiModelPart` gains `{ type: "state", state }');
    expect(source).toContain(
      "`cacheReadInputTokens` and `cacheWriteInputTokens`",
    );
  });
});
