import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../src/cli/args";
import { setJsonMode } from "../src/cli/output";
import { runValidate } from "../src/cli/commands/validate";
import { runQualityLint, validateTemplate } from "../src/index";
import { requireMjml } from "../src/cli/mjml";
import { renderToMjml } from "@templatical/renderer";
import { lintCompiledHtml } from "@templatical/quality";

vi.mock("../src/index", () => ({
  validateTemplate: vi.fn(),
  runQualityLint: vi.fn(),
}));
vi.mock("../src/cli/mjml", () => ({ requireMjml: vi.fn() }));
vi.mock("@templatical/renderer", () => ({ renderToMjml: vi.fn() }));
vi.mock("@templatical/quality", () => ({ lintCompiledHtml: vi.fn() }));

let file: string;
let output: string[];
let diagnostics: string[];

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "tt-validate-coverage-"));
  file = join(dir, "template.json");
  writeFileSync(file, '{"blocks":[],"settings":{}}');
  output = [];
  diagnostics = [];
  vi.spyOn(process.stdout, "write").mockImplementation((text) => {
    output.push(String(text));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((text) => {
    diagnostics.push(String(text));
    return true;
  });
  vi.mocked(validateTemplate).mockReturnValue({ valid: true, errors: [] });
  vi.mocked(runQualityLint).mockReturnValue({ issues: [] });
});

afterEach(() => {
  setJsonMode(false);
  vi.restoreAllMocks();
});

describe("validate command output paths", () => {
  it("prints structural errors in human output", async () => {
    vi.mocked(validateTemplate).mockReturnValue({
      valid: false,
      errors: ["blocks[0] is invalid"],
    });
    expect(await runValidate(parseArgs(["validate", file]))).toBe(1);
    expect(output.join("")).toBe(
      "✗ Structural validation failed (1):\n  - blocks[0] is invalid\n",
    );
    expect(runQualityLint).not.toHaveBeenCalled();
  });

  it("prints a success message with no quality issues", async () => {
    expect(await runValidate(parseArgs(["validate", file]))).toBe(0);
    expect(output.join("")).toBe("✓ Valid — no quality issues\n");
  });

  it("reports compiled HTML byte size and clipping issues under --html", async () => {
    const compile = vi.fn(async () => ({ html: "é", errors: [] }));
    vi.mocked(requireMjml).mockResolvedValue(compile);
    vi.mocked(renderToMjml).mockResolvedValue("<mjml/>");
    vi.mocked(lintCompiledHtml).mockReturnValue([
      {
        blockId: null,
        ruleId: "compat.gmail-clipping",
        severity: "warning",
        message: "Gmail clips this HTML.",
        suggestion: "Shorten it.",
        reference: "https://docs.templatical.com/quality/compatibility/",
      },
    ]);
    setJsonMode(true);

    expect(
      await runValidate(parseArgs(["validate", file, "--html", "--json"])),
    ).toBe(0);
    expect(requireMjml).toHaveBeenCalledWith(
      process.cwd(),
      "Validating HTML size",
    );
    expect(compile).toHaveBeenCalledWith("<mjml/>", {
      validationLevel: "soft",
    });
    expect(lintCompiledHtml).toHaveBeenCalledWith("é");
    expect(JSON.parse(output.join(""))).toMatchObject({
      valid: true,
      htmlBytes: 2,
      issues: [{ ruleId: "compat.gmail-clipping", severity: "warning" }],
    });
  });

  it("reports a lint failure and exits 1 for an error-severity issue", async () => {
    vi.mocked(runQualityLint).mockReturnValue({
      error: "rule engine failed",
      issues: [
        {
          blockId: "bad",
          ruleId: "structure.empty-section",
          severity: "error",
          message: "Empty section.",
          suggestion: "Add content.",
          reference: "https://docs.templatical.com/quality/structure/",
        },
      ],
    });

    expect(await runValidate(parseArgs(["validate", file]))).toBe(1);
    expect(diagnostics.join("")).toContain(
      "Quality lint could not run: rule engine failed",
    );
    expect(output.join("")).toContain(
      "[error] structure.empty-section: Empty section.",
    );
    expect(output.join("")).toContain("→ Add content.");
  });
});
