import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/bin";
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
