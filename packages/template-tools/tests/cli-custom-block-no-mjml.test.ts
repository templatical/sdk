import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../src/cli/args";
import { setJsonMode } from "../src/cli/output";

vi.mock("../src/cli/mjml", () => ({
  loadMjml: async () => null,
  requireMjml: async () => {
    throw new Error("unused");
  },
}));

const { runCustomBlock } = await import("../src/cli/commands/custom-block");

let stderr: string[];
beforeEach(() => {
  stderr = [];
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation((c) => {
    stderr.push(String(c));
    return true;
  });
});
afterEach(() => {
  setJsonMode(false);
  vi.restoreAllMocks();
});

it("validate notes that the HTML compile check was skipped when mjml is missing", async () => {
  const p = join(mkdtempSync(join(tmpdir(), "tt-cb-nomjml-")), "q.json");
  writeFileSync(
    p,
    JSON.stringify({
      type: "quote",
      name: "Quote",
      fields: [{ key: "text", label: "Text", type: "text", default: "Hi" }],
      template: '<table role="presentation"><tr><td>{{ text }}</td></tr></table>',
    }),
  );
  const code = await runCustomBlock(parseArgs(["custom-block", "validate", p]));
  expect(code).toBe(0);
  expect(stderr.join("")).toBe(
    "`mjml` isn't installed, so the HTML compile check was skipped.\n",
  );
});
