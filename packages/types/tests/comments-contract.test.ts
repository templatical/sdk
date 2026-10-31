import { expect, it } from "vitest";
import ts from "typescript";
import { resolve } from "node:path";

it("type-checks explicit comment languages and legacy absent or null tags", () => {
  const file = resolve(import.meta.dirname, "comments-contract.fixture.ts");
  const source = `
    import type { Comment, CommentInput } from "../src";
    type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
    type Assert<T extends true> = T;
    type StoredLocale = Assert<Equal<Comment["locale"], string | null | undefined>>;
    type InputLocale = Assert<Equal<CommentInput["locale"], string | undefined>>;
    const input: CommentInput = { body: "Hallo", locale: "de" };
    const root: Comment = {
      id: "c-1", body: input.body, locale: input.locale,
      author: { id: "u-1", name: "Ada" }, createdAt: "2026-10-28T10:00:00Z",
    };
    const legacy: Comment = { ...root, locale: null };
    const untagged: Comment = {
      id: "c-old", body: "Hello", author: root.author, createdAt: root.createdAt,
    };
    const headlessInput: CommentInput = { body: "Hello" };
  `;
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (
    name,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) =>
    name === file
      ? ts.createSourceFile(file, source, languageVersion, true)
      : original(name, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([file], options, host);
  expect(
    ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
  ).toEqual([]);
}, 120_000);
