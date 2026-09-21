import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../src/cloud/components/CloudSaveGateModal.vue"),
  "utf8",
);

describe("CloudSaveGateModal", () => {
  it("goes through TplModal for trap, Escape, and overlay tokens", () => {
    expect(SRC).toContain(
      'import TplModal from "../../components/TplModal.vue"',
    );
    expect(SRC).toContain(
      '<TplModal :visible="open" @close="emit(\'cancel\')">',
    );
    expect(SRC).not.toContain("tpl:bg-black/");
    expect(SRC).not.toContain("tpl:fixed tpl:inset-0");
  });

  it("uses the outlined danger recipe, not a filled danger surface", () => {
    expect(SRC).toContain("dangerBtnClass");
    expect(SRC).toContain("secondaryBtnClass");
    expect(SRC).not.toContain("tpl:bg-[var(--tpl-danger)]");
    expect(SRC).not.toContain("hover:opacity-90");
  });

  it("is an alertdialog labelled from the title and body", () => {
    expect(SRC).toContain('role="alertdialog"');
    expect(SRC).toContain('aria-labelledby="tpl-save-gate-title"');
    expect(SRC).toContain('aria-describedby="tpl-save-gate-body"');
    expect(SRC).toContain("tpl:max-h-[80%]");
  });
});
