import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REWRITE_PRESETS } from "../src/generated/assets";
// @ts-expect-error -- .mjs generator script, no type declarations by design
import { buildAssetsModule, ASSETS_MODULE_PATH } from "../scripts/generate-assets.mjs";

const PKG = resolve(import.meta.dirname, "..");
const REPO = resolve(PKG, "../..");
const read = (path: string) => readFileSync(path, "utf8");

describe("the package's copied and generated assets", () => {
  it("ships the six rewrite instructions in the preset contract", () => {
    const presets = {
      shorten: "Make it shorter, keeping the meaning.",
      expand: "Make it a little longer and more detailed, without inventing facts.",
      friendlier: "Make the tone warmer and friendlier.",
      formal: "Make the tone more formal and professional.",
      fixGrammar: "Fix spelling, grammar and punctuation; change nothing else.",
      translate: 'Translate it into the language with the BCP 47 tag "{language}".',
    };
    expect(JSON.parse(read(resolve(PKG, "prompts/rewrite-presets.json")))).toEqual(
      presets,
    );
    expect(REWRITE_PRESETS).toEqual(presets);
  });

  it("ships the operations guide exactly as the docs publish it", () => {
    expect(read(resolve(PKG, "prompts/operations.md"))).toBe(
      read(resolve(REPO, "apps/docs/api/operations.md")),
    );
  });

  it("ships the template schema exactly as template-tools generates it", () => {
    expect(read(resolve(PKG, "schema/template-content.schema.json"))).toBe(
      read(resolve(REPO, "packages/template-tools/schema.json")),
    );
  });

  it("holds every prompt and schema file as a string constant", async () => {
    expect(read(ASSETS_MODULE_PATH)).toBe(await buildAssetsModule());
  });
});
