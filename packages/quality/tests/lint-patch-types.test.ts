import { expect, it } from "vitest";
import ts from "typescript";
import { resolve } from "node:path";

// Compiling the fixture against the package's declarations took 7 s on a CI
// runner with coverage on, past Vitest's default 5 s test timeout.
it("keeps LintPatch extendable and legacy removal callbacks assignable", () => {
  const configPath = resolve(import.meta.dirname, "../tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    resolve(import.meta.dirname, ".."),
  );
  const program = ts.createProgram(
    [resolve(import.meta.dirname, "fixtures/lint-patch-compat.ts")],
    { ...parsed.options, noEmit: true },
  );
  expect(
    ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      ),
  ).toEqual([]);
}, 120_000);
