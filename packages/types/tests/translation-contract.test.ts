import { expect, it } from "vitest";
import ts from "typescript";
import { resolve } from "node:path";

it("type-checks the public translation contract and nullable AI locale fields", () => {
  const file = resolve(import.meta.dirname, "translation-contract.fixture.ts");
  const source = `
    import type { TranslationProvider, TranslationRequest, TranslationField,
      TranslationResult, TranslationErrorCode, AiRequestBase, AiRewriteRequest,
      AiChatMessage } from "../src";
    import { TRANSLATION_MAX_FIELDS, TRANSLATION_MAX_CHARS } from "../src";
    const provider = { translate: async () => ({ fields: [] }) } satisfies TranslationProvider;
    const field: TranslationField = { id: "p/content", text: "Hi", format: "html" };
    const request: TranslationRequest = { templateId: null, sourceLocale: "en", targetLocale: "de", fields: [field] };
    const result: Promise<TranslationResult> = (provider as TranslationProvider).translate(request, new AbortController().signal);
    type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
    type Assert<T extends true> = T;
    type Codes = Assert<Equal<TranslationErrorCode, "rate_limited" | "limit_reached" | "content_too_large" | "translation_failed">>;
    type BaseLocale = Assert<Equal<AiRequestBase["locale"], string | null>>;
    type RewriteLocale = Assert<Equal<AiRewriteRequest["locale"], string | null>>;
    type MessageLocale = Assert<Equal<AiChatMessage["locale"], string | null | undefined>>;
    type FieldsLimit = Assert<Equal<typeof TRANSLATION_MAX_FIELDS, 50>>;
    type CharsLimit = Assert<Equal<typeof TRANSLATION_MAX_CHARS, 20000>>;
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
});
