import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(
    __dirname,
    "..",
    "src",
    "components",
    "blocks",
    "RichTextLinkDialog.vue",
  ),
  "utf-8",
);

describe("RichTextLinkDialog structure", () => {
  it("associates the URL label with the input via for/id", () => {
    expect(src).toContain('for="tpl-link-dialog-url"');
    expect(src).toContain('id="tpl-link-dialog-url"');
  });

  it("renders the dialog with role=dialog and aria-modal", () => {
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
  });

  it("labels the dialog via aria-labelledby pointing at the title id", () => {
    expect(src).toContain('aria-labelledby="tpl-link-dialog-title"');
    expect(src).toContain('id="tpl-link-dialog-title"');
  });
});
