import { expect, it } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";

it("requires a route result on done events, including explicit messageId for turns", () => {
  const program = ts.createProgram([resolve(import.meta.dirname, "done-contract.fixture.ts")], {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    types: [],
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.Preserve,
    target: ts.ScriptTarget.ES2022,
  });
  expect(ts.getPreEmitDiagnostics(program).map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))).toEqual([]);
});
