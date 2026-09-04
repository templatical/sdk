import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve(import.meta.dirname, "../src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("stdout discipline", () => {
  it("only cli/output.ts writes to stdout", () => {
    // @templatical/mcp imports this library and reserves stdout for JSON-RPC,
    // and `--json` promises exactly one parseable document on stdout. A second
    // writer breaks both, silently.
    const offenders = walk(SRC)
      .filter((f) => /process\.stdout|console\.log/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(SRC.length + 1));
    expect(offenders).toEqual(["cli/output.ts"]);
  });
});
