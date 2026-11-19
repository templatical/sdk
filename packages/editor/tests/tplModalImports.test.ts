import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "../src");

function read(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf-8");
}

describe("TplModal location + importers", () => {
  it("source exists at src/components/TplModal.vue", () => {
    expect(existsSync(resolve(SRC, "components/TplModal.vue"))).toBe(true);
  });

  // The saved-blocks dialogs live in `src/components/` alongside TplModal, so
  // for them the canonical import is the sibling path.
  it("SavedBlocksBrowserModal imports TplModal as a sibling", () => {
    const content = read("components/SavedBlocksBrowserModal.vue");
    expect(content).toContain('import TplModal from "./TplModal.vue"');
    expect(content).not.toContain(
      'import TplModal from "../../components/TplModal.vue"',
    );
  });

  it("SaveBlockDialog imports TplModal as a sibling", () => {
    const content = read("components/SaveBlockDialog.vue");
    expect(content).toContain('import TplModal from "./TplModal.vue"');
    expect(content).not.toContain(
      'import TplModal from "../../components/TplModal.vue"',
    );
  });

  it("TestEmailModal imports TplModal from its own directory", () => {
    const content = read("components/TestEmailModal.vue");
    expect(content).toContain('import TplModal from "./TplModal.vue"');
    expect(content).not.toContain(
      'import TplModal from "../../components/TplModal.vue"',
    );
  });

});
