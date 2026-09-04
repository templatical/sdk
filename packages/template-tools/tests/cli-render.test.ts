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
      optionalAvailable ? actual.resolveOptional(spec, cwd) : Promise.resolve(null),
  };
});

import { parseArgs } from "../src/cli/args";
import { setJsonMode } from "../src/cli/output";
import { runRender } from "../src/cli/commands/render";
import { MissingDependencyError } from "../src/cli/io";

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

let dir: string;
let stdout: string[];
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tt-render-"));
  file = join(dir, "t.json");
  writeFileSync(file, JSON.stringify(VALID), "utf8");
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

describe("render command", () => {
  it("renders MJML with no optional dependency installed", async () => {
    expect(await runRender(parseArgs(["render", file, "--format", "mjml"]))).toBe(0);
    expect(stdout.join("")).toContain("<mj-text");
  });

  it("defaults to mjml when --format is omitted", async () => {
    expect(await runRender(parseArgs(["render", file]))).toBe(0);
    // The renderer always stamps `settings.locale` onto the root tag, so the
    // fixture's `locale: "en"` makes this the exact opening tag — a bare
    // `<mjml>` never appears in real output.
    expect(stdout.join("")).toContain('<mjml lang="en">');
  });

  it("writes to -o and keeps stdout clean", async () => {
    const out = join(dir, "out.mjml");
    expect(
      await runRender(parseArgs(["render", file, "--format", "mjml", "-o", out])),
    ).toBe(0);
    expect(stdout.join("")).toBe("");
    expect(readFileSync(out, "utf8")).toContain('<mjml lang="en">');
  });

  it("wraps the MJML in a json envelope under --json", async () => {
    setJsonMode(true);
    await runRender(parseArgs(["render", file, "--format", "mjml", "--json"]));
    const out = JSON.parse(stdout.join(""));
    expect(out.format).toBe("mjml");
    expect(out.output).toContain('<mjml lang="en">');
  });

  it("rejects an unknown format with a usage error", async () => {
    await expect(
      runRender(parseArgs(["render", file, "--format", "pdf"])),
    ).rejects.toThrow(/mjml/);
  });

  it("compiles HTML when mjml resolves", async () => {
    // mjml is a devDependency of this package, so it resolves here. On a bare
    // npx it would not, which is the branch the next case covers.
    expect(await runRender(parseArgs(["render", file, "--format", "html"]))).toBe(0);
    expect(stdout.join("").toLowerCase()).toContain("<!doctype html");
  });

  it("exits 3 and names the install command when mjml is missing", async () => {
    optionalAvailable = false;

    await expect(
      runRender(parseArgs(["render", file, "--format", "html"])),
    ).rejects.toThrow(MissingDependencyError);
    await expect(
      runRender(parseArgs(["render", file, "--format", "html"])),
    ).rejects.toThrow(/npm install mjml/);
  });
});
