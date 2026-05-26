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

  it("ModuleBrowserModal imports the new shared path", () => {
    const content = read("cloud/components/ModuleBrowserModal.vue");
    expect(content).toContain(
      'import TplModal from "../../components/TplModal.vue"',
    );
    expect(content).not.toContain('import TplModal from "./TplModal.vue"');
  });

  it("SaveModuleDialog imports the new shared path", () => {
    const content = read("cloud/components/SaveModuleDialog.vue");
    expect(content).toContain(
      'import TplModal from "../../components/TplModal.vue"',
    );
    expect(content).not.toContain('import TplModal from "./TplModal.vue"');
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
