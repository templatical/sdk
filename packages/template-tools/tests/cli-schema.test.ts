import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../src/cli/args";
import { setJsonMode } from "../src/cli/output";
import { runSchema } from "../src/cli/commands/schema";
import { schema } from "../src/index";

describe("schema command", () => {
  afterEach(() => {
    setJsonMode(false);
    vi.restoreAllMocks();
  });

  it("prints the schema and exits 0", () => {
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((c) => {
      writes.push(String(c));
      return true;
    });
    expect(runSchema(parseArgs(["schema"]))).toBe(0);
    expect(JSON.parse(writes.join("")).definitions.TemplateSettings).toBeTruthy();
  });

  it("writes to --out and reports the path on stderr, keeping stdout clean", () => {
    const dir = mkdtempSync(join(tmpdir(), "tt-schema-"));
    const out = join(dir, "schema.json");
    const stdout: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((c) => {
      stdout.push(String(c));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    expect(runSchema(parseArgs(["schema", "--out", out]))).toBe(0);
    expect(stdout.join("")).toBe("");
    expect(JSON.parse(readFileSync(out, "utf8"))).toEqual(schema);
  });
});
