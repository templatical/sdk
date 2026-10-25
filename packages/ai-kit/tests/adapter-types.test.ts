import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { beforeAll, expect, it } from "vitest";

const PKG = resolve(import.meta.dirname, "..");
const ROOT = resolve(PKG, "../..");
const pkgDir = (name: string) => resolve(PKG, "node_modules", name);

const FIXTURE = resolve(import.meta.dirname, "adapter-types.fixture.ts");
const SNIPPETS = [
  "adapter-options.ts",
  "model-anthropic.ts",
  "model-openai.ts",
  "model-vercel.ts",
  "evaluate-model.ts",
].map((name) => resolve(ROOT, "apps/docs/snippets", name));

function compile(files: string[]): { file: string; message: string }[] {
  const program = ts.createProgram(files, {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    allowImportingTsExtensions: true,
    types: ["node"],
    typeRoots: [resolve(PKG, "node_modules/@types")],
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.Preserve,
    target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    paths: {
      "@templatical/types": [resolve(ROOT, "packages/types/src/index.ts")],
      "@templatical/quality": [
        resolve(import.meta.dirname, "helpers/quality-api.d.ts"),
      ],
      "@templatical/ai-kit/adapters/*": [resolve(PKG, "src/adapters/*.ts")],
      "@templatical/ai-kit/testing": [resolve(PKG, "src/testing/index.ts")],
      "@anthropic-ai/sdk": [pkgDir("@anthropic-ai/sdk")],
      "@anthropic-ai/sdk/*": [`${pkgDir("@anthropic-ai/sdk")}/*`],
      openai: [pkgDir("openai")],
      "openai/*": [`${pkgDir("openai")}/*`],
      ai: [pkgDir("ai")],
    },
  });
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
    file: diagnostic.file?.fileName ?? "",
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  }));
}

const format = ({ file, message }: { file: string; message: string }) =>
  `${file}: ${message}`;

let diagnostics: { file: string; message: string }[] = [];

// One program for the fixture and the docs examples: parsing the three SDKs'
// declarations is most of the work, so it happens once. It took 25 s on a CI
// runner with coverage on, past the suite's 20 s test timeout.
beforeAll(() => {
  diagnostics = compile([FIXTURE, ...SNIPPETS]);
}, 120_000);

it("accepts the listed clients and models, and refuses params the adapter owns", () => {
  expect(
    diagnostics
      .filter(({ file }) => !SNIPPETS.includes(resolve(file)))
      .map(format),
  ).toEqual([]);
});

it("compiles the docs' adapter and evaluation examples", () => {
  expect(
    diagnostics.filter(({ file }) => resolve(file) !== FIXTURE).map(format),
  ).toEqual([]);
});

it("keeps the quality declaration's lintTemplate signature in sync with source", () => {
  const signature = (file: string) => {
    const match = readFileSync(file, "utf8").match(
      /export function lintTemplate\([\s\S]*?\): [^{;]+/,
    );
    if (!match) throw new Error(`Missing lintTemplate signature in ${file}`);
    return match[0]
      .replace("options: LintOptions = {}", "options?: LintOptions")
      .replace(/\s/g, "");
  };
  expect(
    signature(resolve(import.meta.dirname, "helpers/quality-api.d.ts")),
  ).toBe(signature(resolve(ROOT, "packages/quality/src/lint-template.ts")));
});
