import { afterEach, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createDefaultTemplateContent } from "@templatical/types";
import { parseArgs } from "../src/cli/args";
import { runValidate } from "../src/cli/commands/validate";
import { setJsonMode } from "../src/cli/output";

const lintFailure = vi.hoisted(() => ({
  value: new Error("Linter failed unexpectedly") as unknown,
}));

vi.mock("@templatical/quality", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@templatical/quality")>()),
  lintTemplate: () => {
    throw lintFailure.value;
  },
}));
afterEach(() => {
  setJsonMode(false);
  vi.restoreAllMocks();
});
it.each([
  [
    "Error",
    new Error("Linter failed unexpectedly"),
    "Linter failed unexpectedly",
  ],
  ["empty Error", new Error(""), "Quality lint failed."],
  ["string", "plain failure", "plain failure"],
  ["empty string", "", "Quality lint failed."],
] as const)(
  "returns tool failure exit 2 with a message when lint throws %s",
  async (_label, failure, message) => {
    lintFailure.value = failure;
    mkdirSync(join(process.cwd(), "node_modules/.cache"), { recursive: true });
    const dir = mkdtempSync(
      join(process.cwd(), "node_modules/.cache/lint-failure-"),
    );
    try {
      writeFileSync(
        join(dir, "template.json"),
        JSON.stringify(createDefaultTemplateContent()),
      );
      const stderr = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const stdout = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      setJsonMode(true);
      const result = await runValidate(
        parseArgs(["validate", "template.json", "--cwd", dir, "--json"]),
      );
      expect(result).toBe(2);
      expect(stdout).not.toHaveBeenCalled();
      expect(
        [...stderr.mock.calls, ...stdout.mock.calls].flat().join(""),
      ).toContain(message);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
