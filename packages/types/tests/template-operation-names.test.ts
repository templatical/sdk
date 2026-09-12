import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(import.meta.dirname, "../src");
const read = (f: string) => readFileSync(resolve(SRC, f), "utf8");

describe("operation type naming", () => {
  it("exports the transport-neutral names", () => {
    const index = read("index.ts");
    expect(index).toContain("TemplateOperation");
    expect(index).toContain("TemplateOperationPayload");
  });

  it("no longer exports the Mcp-prefixed operation names", () => {
    // The CLI's `edit --op` documents this vocabulary; naming it after a
    // transport that is not involved confuses every reader of --help.
    const index = read("index.ts");
    expect(index).not.toContain("McpOperation");
    expect(index).not.toContain("McpOperationPayload");
  });

  it("keeps McpConfig, which really is about MCP", () => {
    expect(read("index.ts")).toContain("McpConfig");
    expect(read("cloud.ts")).toContain("export interface McpConfig");
  });
});
