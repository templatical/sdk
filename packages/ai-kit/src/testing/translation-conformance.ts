import type {
  TranslationField,
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from "@templatical/types";
import { maskTags, SYNTAX_PRESETS, unmaskTags } from "@templatical/types";
import {
  evaluateConformanceCheck,
  withConformanceDeadline,
} from "./conformance";

/** Probe the translation contract without a DOM or a model-specific dependency. */
export async function runTranslationConformance(
  provider: TranslationProvider,
  options: { locale?: string } = {},
): Promise<{ name: string; ok: boolean; detail?: string }[]> {
  const checks: { name: string; ok: boolean; detail?: string }[] = [];
  const source = [
    {
      id: "html",
      format: "html" as const,
      text: '<p>Hello <span data-merge-tag="{{name}}">Name</span> <a href="{{url}}">Shop</a></p>',
    },
    { id: "text", format: "text" as const, text: "Hello {{name}}" },
  ];
  const masked = source.map((field) =>
    maskTags(field.text, SYNTAX_PRESETS.liquid, field.format),
  );
  const fields = source.map((field, i) => ({ ...field, text: masked[i].text }));
  const request = (fields: TranslationField[]): TranslationRequest => ({
    templateId: null,
    sourceLocale: "en",
    targetLocale: options.locale ?? "de",
    fields,
  });
  const call = (fields: TranslationField[]) =>
    withConformanceDeadline("translation", 5000, (signal) =>
      provider.translate(request(fields), signal),
    );
  const shape = (
    result: TranslationResult,
    input: TranslationField[],
  ): boolean =>
    result !== null &&
    typeof result === "object" &&
    Array.isArray(result.fields) &&
    result.fields.every(
      (field) =>
        field !== null &&
        typeof field === "object" &&
        typeof field.id === "string" &&
        typeof field.text === "string" &&
        input.some(({ id }) => id === field.id),
    ) &&
    new Set(result.fields.map(({ id }) => id)).size === result.fields.length;
  const add = async (
    name: string,
    evaluate: () => Promise<{ ok: boolean }>,
  ) => {
    checks.push(await evaluateConformanceCheck(name, evaluate));
  };
  await add("placeholders round-trip", async () => {
    const result = await call(fields);
    return {
      ok:
        shape(result, fields) &&
        result.fields.length === fields.length &&
        fields.every((field, i) => {
          const text = result.fields.find(({ id }) => id === field.id)?.text;
          return (
            typeof text === "string" &&
            unmaskTags(text, masked[i].tokens) !== null
          );
        }),
    };
  });
  await add("HTML stays within the allow-list", async () => {
    const result = await call([fields[0]]);
    const allowed = new Set([
      "p",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "a",
      "br",
      "span",
    ]);
    const text = result?.fields?.[0]?.text;
    if (!shape(result, [fields[0]]) || typeof text !== "string")
      return { ok: false };
    const clean = unmaskTags(
      text,
      masked[0].tokens.map(() => ""),
    );
    return {
      ok:
        clean !== null &&
        [...clean.matchAll(/<\/?([a-z][\w:-]*)\b/gi)].every((match) =>
          allowed.has(match[1].toLowerCase()),
        ),
    };
  });
  await add("a partial result is accepted", async () => {
    const input: TranslationField[] = [
      { id: "partial-a", format: "text", text: "Hello" },
      { id: "partial-b", format: "text", text: "Shop" },
    ];
    return { ok: shape(await call(input), input) };
  });
  await add("51 fields are rejected or translated in full", async () => {
    const input: TranslationField[] = Array.from({ length: 51 }, (_, i) => ({
      id: `limit-${i}`,
      format: "text",
      text: "Hello",
    }));
    try {
      const result = await call(input);
      return {
        ok: shape(result, input) && result.fields.length === input.length,
      };
    } catch (error) {
      return {
        ok:
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "content_too_large",
      };
    }
  });
  await add("an aborted signal rejects with AbortError", async () => {
    const controller = new AbortController();
    controller.abort();
    try {
      await withConformanceDeadline(
        "translation abort",
        5000,
        (signal) => provider.translate(request(fields), signal),
        controller,
      );
      return { ok: false };
    } catch (error) {
      return { ok: error instanceof Error && error.name === "AbortError" };
    }
  });
  return checks;
}
