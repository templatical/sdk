import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOCS = join(import.meta.dirname, "..");

/**
 * The editor and the renderer pass an HTML block's markup through unchanged,
 * so the block's docs say so in both locales: a consumer with untrusted
 * authors has to sanitize on their own backend.
 */
describe("the HTML block's sanitization note", () => {
  it.each([
    ["guide/blocks.md", "neither sanitizes it"],
    ["de/guide/blocks.md", "keiner von beiden bereinigt es"],
  ])("%s says the markup is not sanitized", (page, phrase) => {
    expect(readFileSync(join(DOCS, page), "utf8")).toContain(phrase);
  });

  it.each([
    ["guide/blocks.md", "](/api/renderer-typescript)"],
    ["de/guide/blocks.md", "](/de/api/renderer-typescript)"],
  ])("%s points at the renderer's option to drop HTML blocks", (page, link) => {
    const src = readFileSync(join(DOCS, page), "utf8");
    expect(src).toContain("`allowHtmlBlocks: false`");
    expect(src).toContain(link);
  });
});
