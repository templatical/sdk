import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isEntryPoint, main } from "../src/bin";
import { setJsonMode } from "../src/cli/output";

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

describe("bin dispatch", () => {
  it("the `help` command exits 0 and prints usage", async () => {
    expect(await main(["help"])).toBe(0);
    expect(stderr.join("")).toContain("templatical <command>");
  });

  // parseArgs strips leading dashes into flags, so this never reaches a
  // case "--help" — regression coverage for that dead-code trap.
  it("--help exits 0 and prints usage", async () => {
    expect(await main(["--help"])).toBe(0);
    expect(stderr.join("")).toContain("templatical <command>");
  });

  it("-h exits 0 and prints usage", async () => {
    expect(await main(["-h"])).toBe(0);
    expect(stderr.join("")).toContain("templatical <command>");
  });

  it("a bare invocation still exits 2", async () => {
    expect(await main([])).toBe(2);
    expect(stderr.join("")).toContain("templatical <command>");
  });

  it("an unknown command exits 2", async () => {
    expect(await main(["frobnicate"])).toBe(2);
    expect(stderr.join("")).toContain('Unknown command "frobnicate"');
  });
});

// isEntryPoint is what decides whether main() self-invokes. It can't be
// exercised end-to-end without a real subprocess (import.meta.url is fixed
// per-process), so these cover its two testable contracts in isolation: the
// realpath resolution the fix adds, and that a bad argv[1] fails closed
// instead of throwing at module load.
describe("isEntryPoint", () => {
  const originalArgv1 = process.argv[1];
  let dir: string | undefined;

  afterEach(() => {
    process.argv[1] = originalArgv1;
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("returns false for an empty argv[1] without calling realpathSync", () => {
    process.argv[1] = "";
    expect(isEntryPoint()).toBe(false);
  });

  it("returns false instead of throwing when argv[1] doesn't exist on disk", () => {
    process.argv[1] = join(tmpdir(), "templatical-argv1-does-not-exist-9f2c1a");
    expect(isEntryPoint()).toBe(false);
  });

  it("resolves a symlinked argv[1] to its realpath before comparing", () => {
    // Reproduces npm's `bin` layout: a symlink whose path differs from the
    // realpath import.meta.url reports, the exact case the fix targets.
    dir = mkdtempSync(join(tmpdir(), "tt-bin-symlink-"));
    const linkPath = join(dir, "templatical");
    const realBinPath = fileURLToPath(
      new URL("../src/bin.ts", import.meta.url),
    );
    symlinkSync(realBinPath, linkPath);
    process.argv[1] = linkPath;
    expect(isEntryPoint()).toBe(true);
  });
});
