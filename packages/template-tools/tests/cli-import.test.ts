import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Spying on an ES module's export (`vi.spyOn(await import("..."), "resolveOptional")`)
// is unreliable — depending on how Vite transforms the module the property is
// non-configurable and the spy throws. A `vi.mock` factory gated by a mutable
// flag works regardless, so the missing-dependency case flips this instead.
let optionalAvailable = true;
vi.mock("../src/cli/resolve-optional", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/cli/resolve-optional")>();
  return {
    resolveOptional: (spec: string, cwd?: string) =>
      optionalAvailable
        ? actual.resolveOptional(spec, cwd)
        : Promise.resolve(null),
  };
});

import { parseArgs } from "../src/cli/args";
import { setJsonMode } from "../src/cli/output";
import {
  detectFormat,
  FORMATS,
  runImport,
  summarizeReport,
} from "../src/cli/commands/import";
import { UsageError } from "../src/cli/io";

let dir: string;
let stdout: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tt-import-"));
  stdout = [];
  vi.spyOn(process.stdout, "write").mockImplementation((c) => {
    stdout.push(String(c));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  setJsonMode(false);
  optionalAvailable = true;
  vi.restoreAllMocks();
});

describe("detectFormat", () => {
  it("reads html from the extension", () => {
    expect(detectFormat("a.html", "<table></table>")).toBe("html");
    expect(detectFormat("a.htm", "<table></table>")).toBe("html");
  });

  it("reads html from a leading angle bracket", () => {
    expect(detectFormat("a.txt", "  <div>hi</div>")).toBe("html");
  });

  it("distinguishes unlayer from beefree by their root key", () => {
    expect(detectFormat("a.json", JSON.stringify({ body: { rows: [] } }))).toBe(
      "unlayer",
    );
    expect(detectFormat("a.json", JSON.stringify({ page: { rows: [] } }))).toBe(
      "beefree",
    );
  });

  it("returns null when it cannot tell", () => {
    expect(detectFormat("a.json", JSON.stringify({ whatever: 1 }))).toBeNull();
    expect(detectFormat("a.bin", " binary")).toBeNull();
  });
});

describe("summarizeReport", () => {
  it("counts entries by status", () => {
    expect(
      summarizeReport({
        entries: [
          { status: "converted" },
          { status: "converted" },
          { status: "approximated" },
          { status: "html-fallback" },
          { status: "skipped" },
        ],
        warnings: ["one warning"],
      }),
    ).toEqual({
      total: 5,
      converted: 2,
      approximated: 1,
      htmlFallback: 1,
      skipped: 1,
      warnings: ["one warning"],
    });
  });

  it("survives a report with no entries", () => {
    expect(summarizeReport(undefined).total).toBe(0);
  });
});

describe("import command", () => {
  it("reports every known format with whether its converter resolves", async () => {
    setJsonMode(true);
    expect(
      await runImport(parseArgs(["import", "--list-formats", "--json"])),
    ).toBe(0);
    const out = JSON.parse(stdout.join(""));
    // Every registry entry is reported, each with an availability flag, so a
    // caller never guesses and a new converter appears here for free.
    expect(out.formats.map((f: { format: string }) => f.format).sort()).toEqual(
      Object.keys(FORMATS).sort(),
    );
    for (const f of out.formats) expect(typeof f.available).toBe("boolean");
  });

  it("converts an unlayer design and writes a working file", async () => {
    const src = join(dir, "design.json");
    writeFileSync(src, JSON.stringify({ body: { rows: [] } }), "utf8");
    setJsonMode(true);
    expect(
      await runImport(parseArgs(["import", src, "--cwd", dir, "--json"])),
    ).toBe(0);
    const out = JSON.parse(stdout.join(""));
    expect(out.format).toBe("unlayer");
    expect(readFileSync(out.file, "utf8")).toContain('"blocks"');
  });

  it("refuses an undetectable source and asks for --format", async () => {
    const src = join(dir, "mystery.json");
    writeFileSync(src, JSON.stringify({ nope: true }), "utf8");
    await expect(
      runImport(parseArgs(["import", src, "--cwd", dir])),
    ).rejects.toThrow(/--format/);
  });

  it("rejects an unknown --format naming the known ones", async () => {
    const src = join(dir, "x.json");
    writeFileSync(src, "{}", "utf8");
    await expect(
      runImport(
        parseArgs(["import", src, "--format", "mailchimp", "--cwd", dir]),
      ),
    ).rejects.toThrow(UsageError);
  });

  it("names the install command when a converter is missing", async () => {
    optionalAvailable = false;
    const src = join(dir, "design.json");
    writeFileSync(src, JSON.stringify({ body: { rows: [] } }), "utf8");
    await expect(
      runImport(parseArgs(["import", src, "--cwd", dir])),
    ).rejects.toThrow(/npm install @templatical.import-unlayer/);
  });
});
