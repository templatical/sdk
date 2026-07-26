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

  it("source does NOT exist at src/cloud/components/TplModal.vue", () => {
    expect(existsSync(resolve(SRC, "cloud/components/TplModal.vue"))).toBe(
      false,
    );
  });

  // The saved-blocks dialogs live in `src/components/` alongside TplModal, so
  // for them the canonical import is the sibling path — the inverse of the
  // cloud-resident importers below.
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

  it("the saved-blocks dialogs no longer live under src/cloud/", () => {
    expect(
      existsSync(resolve(SRC, "cloud/components/SaveModuleDialog.vue")),
    ).toBe(false);
    expect(
      existsSync(resolve(SRC, "cloud/components/ModuleBrowserModal.vue")),
    ).toBe(false);
    expect(
      existsSync(resolve(SRC, "cloud/components/ModulePreviewCanvas.vue")),
    ).toBe(false);
  });

  it("TestEmailModal imports the new shared path", () => {
    const content = read("cloud/components/TestEmailModal.vue");
    expect(content).toContain(
      'import TplModal from "../../components/TplModal.vue"',
    );
    expect(content).not.toContain('import TplModal from "./TplModal.vue"');
  });

  it("no file under src/ imports from cloud/components/TplModal", () => {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const stdout = execSync(
      `grep -rln "cloud/components/TplModal" "${SRC}" || true`,
      { encoding: "utf-8" },
    );
    const matches = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    expect(matches).toEqual([]);
  });
});
