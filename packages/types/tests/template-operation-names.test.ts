import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(import.meta.dirname, "../src");
const read = (f: string) => readFileSync(resolve(SRC, f), "utf8");

describe("operation vocabulary naming", () => {
  it("exports the v2 vocabulary and its engine", () => {
    const index = read("index.ts");
    for (const name of [
      "Operation,",
      "BlockParent,",
      "OperationBatch,",
      "RevisionedBatch,",
      "applyOperations,",
      "OperationError,",
    ]) {
      expect(index).toContain(name);
    }
  });

  it("no longer exports the v1 vocabulary or the peer-to-peer collaboration types", () => {
    // v1 positioned blocks by index and broadcast between peers with no
    // server order; nothing reads these names any more.
    const index = read("index.ts");
    const cloud = read("cloud.ts");
    for (const name of [
      "TemplateOperation",
      "TemplateOperationPayload",
      "McpConfig",
      "CollaborationConfig",
      "Collaborator",
    ]) {
      expect(index).not.toMatch(new RegExp(`\\b${name}\\b`));
      expect(cloud).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
  });
});
