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

// console.log/info/debug/dir/table all write to stdout in Node; console.trace
// is deliberately excluded — unlike the other five, it writes to stderr
// (Node docs: "Prints to stderr the string 'Trace: '"), so it is not a stdout
// leak and does not belong in this pattern.
const STDOUT_WRITE_RE = /process\.stdout|console\.(log|info|debug|dir|table)/;

describe("stdout discipline", () => {
  it("only cli/output.ts writes to stdout", () => {
    // A future stdio-based MCP server would reserve stdout for JSON-RPC, and
    // `--json` promises exactly one parseable document on stdout today. A
    // second writer would break both, silently.
    const offenders = walk(SRC)
      .filter((f) => STDOUT_WRITE_RE.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(SRC.length + 1));
    expect(offenders).toEqual(["cli/output.ts"]);
  });
});
