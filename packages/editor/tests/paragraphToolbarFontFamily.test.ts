// Source-level, like paragraphToolbarMergeTag.test.ts: mounting the toolbar
// pulls in TipTap and every formatting child. The inline font select must list
// the selection's own font when the options don't include it, or an imported
// stack shows as "Default font".
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../src/components/blocks/ParagraphToolbar.vue"),
  "utf-8",
);

describe("ParagraphToolbar font select", () => {
  it("passes the selection's font through withCurrentFont", () => {
    expect(SRC).toMatch(
      /:options="\s*withCurrentFont\(\s*fontFamilies,\s*textStyleAttr\(['"]fontFamily['"]\)\s*\)\s*"/,
    );
  });
});
