import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../src/cli/args";
import { setJsonMode } from "../src/cli/output";
import { runValidate } from "../src/cli/commands/validate";

let dir: string;
let stdout: string[];

function fixture(name: string, content: unknown): string {
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify(content), "utf8");
  return p;
}

const VALID = {
  blocks: [
    {
      id: "title_1",
      type: "title",
      content: "Hello",
      level: 1,
      textAlign: "left",
      styles: { padding: { top: 24, right: 24, bottom: 8, left: 24 } },
    },
  ],
  settings: {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#111111",
    fontFamily: "Arial, sans-serif",
    linkUnderline: true,
    locale: "en",
  },
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tt-validate-"));
  stdout = [];
  vi.spyOn(process.stdout, "write").mockImplementation((c) => {
    stdout.push(String(c));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  setJsonMode(false);
  vi.restoreAllMocks();
});

describe("validate command", () => {
  it("exits 0 on a structurally valid template", () => {
    const f = fixture("ok.json", VALID);
    expect(runValidate(parseArgs(["validate", f]))).toBe(0);
  });

  it("exits 1 and names the block path on a structural error", () => {
    const f = fixture("bad.json", {
      ...VALID,
      blocks: [{ id: "button_1", type: "button", styles: { padding: {} } }],
    });
    setJsonMode(true);
    expect(runValidate(parseArgs(["validate", f, "--json"]))).toBe(1);
    const out = JSON.parse(stdout.join(""));
    expect(out.valid).toBe(false);
    expect(out.errors.join(" ")).toContain("blocks[0] (button)");
  });

  it("emits only parseable JSON on stdout under --json", () => {
    const f = fixture("ok.json", VALID);
    setJsonMode(true);
    runValidate(parseArgs(["validate", f, "--json"]));
    const out = JSON.parse(stdout.join(""));
    expect(out).toMatchObject({ valid: true });
    expect(Array.isArray(out.issues)).toBe(true);
  });

  it("exits 2 with no file argument", () => {
    expect(() => runValidate(parseArgs(["validate"]))).toThrow(
      /needs a template file/i,
    );
  });

  it("exits 2 on unparseable JSON", () => {
    const p = join(dir, "broken.json");
    writeFileSync(p, "{ not json", "utf8");
    expect(() => runValidate(parseArgs(["validate", p]))).toThrow(
      /not valid JSON/,
    );
  });

  it("reports lint warnings but still exits 0", () => {
    // A button with vague text is a warning-level accessibility issue, not a
    // structural one — advisory, so the command must not fail on it.
    const f = fixture("warn.json", {
      ...VALID,
      blocks: [
        {
          id: "button_1",
          type: "button",
          text: "Click here",
          url: "https://example.com",
          backgroundColor: "#1d4ed8",
          textColor: "#ffffff",
          borderRadius: 6,
          fontSize: 16,
          buttonPadding: { top: 14, right: 28, bottom: 14, left: 28 },
          align: "center",
          styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
        },
      ],
    });
    setJsonMode(true);
    expect(runValidate(parseArgs(["validate", f, "--json"]))).toBe(0);
    const out = JSON.parse(stdout.join(""));
    expect(out.valid).toBe(true);
    expect(out.issues.length).toBeGreaterThan(0);
  });
});
