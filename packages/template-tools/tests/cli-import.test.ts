import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

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
import { resolveOptional } from "../src/cli/resolve-optional";
import { validateTemplate } from "../src/validate";

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

const REPO_ROOT = resolve(import.meta.dirname, "../../..");

describe("import command — real fixtures convert to valid Templatical JSON", () => {
  const cases = [
    {
      format: "unlayer",
      fixture: "packages/import-unlayer/src/__tests__/fixtures/example-1.json",
    },
    {
      format: "beefree",
      fixture: "packages/import-beefree/src/__tests__/fixtures/example-1.json",
    },
    {
      format: "html",
      fixture: "packages/import-html/src/__tests__/fixtures/multi-column.html",
    },
  ] as const;

  // Each converter package is optional (install-on-demand) and resolved from
  // node_modules at runtime — resolveOptional throws rather than resolving to
  // null when a package.json is found but its dist hasn't been built, so a
  // pre-check with .catch(() => null) treats "not installed" and "not built
  // yet" the same way: skip. CI builds every package before running tests, so
  // the real assertions run there. Mirrors the graceful skip in the "real
  // fixtures" fixture-based groups elsewhere in this repo (e.g. the
  // e2e-consumer suites).
  it.each(cases)(
    "imports a $format fixture end-to-end",
    async ({ format, fixture }) => {
      const spec = FORMATS[format];
      const available = await resolveOptional(spec.pkg, dir).catch(() => null);
      if (!available) return;

      const src = join(dir, basename(fixture));
      writeFileSync(src, readFileSync(resolve(REPO_ROOT, fixture), "utf8"), "utf8");
      setJsonMode(true);
      expect(
        await runImport(
          parseArgs(["import", src, "--format", format, "--cwd", dir, "--json"]),
        ),
      ).toBe(0);
      const out = JSON.parse(stdout.join(""));
      const written = JSON.parse(readFileSync(out.file, "utf8"));
      const { valid, errors } = validateTemplate(written);
      expect(errors).toEqual([]);
      expect(valid).toBe(true);
      expect(out.report.total).toBeGreaterThan(0);
    },
  );
});
