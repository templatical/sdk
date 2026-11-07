import type { TranslationRequest, TranslationResult } from "@templatical/types";
import { SdkError, unmaskTags } from "@templatical/types";
import { TRANSLATE_INSTRUCTIONS } from "../generated/assets";
import { stripFences } from "./checks";
import type { AiModelAdapter, AiModelMessage } from "./model";
import { fill } from "./fill";
import { languageName } from "./prompts";
import { checkTranslationRequest } from "./read-request";

type AliasedField = TranslationRequest["fields"][number] & { alias: string };

/** The fields that pass, found in the answer by their alias and returned under their real id. */
function passingFields(
  answer: string,
  sources: AliasedField[],
): TranslationResult["fields"] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(answer).trim());
  } catch {
    return [];
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as TranslationResult).fields)
  )
    return [];
  const fields = (parsed as { fields: unknown[] }).fields;
  return sources.flatMap((source) => {
    const matches = fields.filter(
      (field): field is { id: string; text?: unknown } =>
        typeof field === "object" &&
        field !== null &&
        "id" in field &&
        field.id === source.alias,
    );
    if (matches.length !== 1 || typeof matches[0].text !== "string") return [];
    const text = matches[0].text;
    const tokens = [
      ...source.text.matchAll(
        /<x id="(\d+)"\s*\/>|<x id="(\d+)"><\/x>|__x(\d+)__/g,
      ),
    ].map(() => "");
    if (
      unmaskTags(source.text, tokens) === null ||
      unmaskTags(text, tokens) === null
    )
      return [];
    return [{ id: source.id, text }];
  });
}

/** Translate masked fields, with one repair and a partial result for fields that pass. */
export async function translateFields(options: {
  request: TranslationRequest;
  model: AiModelAdapter;
  signal?: AbortSignal;
}): Promise<TranslationResult> {
  const { model, signal } = options;
  signal?.throwIfAborted();
  const request = checkTranslationRequest(options.request);
  const system = fill(TRANSLATE_INSTRUCTIONS, {
    source: `${languageName(request.sourceLocale)} (${request.sourceLocale})`,
    target: `${languageName(request.targetLocale)} (${request.targetLocale})`,
  });
  // The model echoes every id in its answer, so it gets short aliases (f1, f2, …) instead of long field ids.
  const fields: AliasedField[] = request.fields.map((field, index) => ({
    ...field,
    alias: `f${index + 1}`,
  }));
  const messages: AiModelMessage[] = [
    {
      role: "user",
      content: `Translate from ${languageName(request.sourceLocale)} (${request.sourceLocale}) to ${languageName(request.targetLocale)} (${request.targetLocale}).\n\nFields:\n${JSON.stringify(fields.map(({ alias, format, text }) => ({ id: alias, format, text })))}`,
    },
  ];
  const accepted = new Map<string, string>();
  for (let attempt = 0; attempt < 2; attempt++) {
    signal?.throwIfAborted();
    let answer = "";
    try {
      for await (const part of model.stream({
        system,
        messages,
        tools: [],
        signal,
      })) {
        signal?.throwIfAborted();
        if (part.type === "text") answer += part.text;
      }
    } catch (error) {
      signal?.throwIfAborted();
      if (
        (error instanceof Error && error.name === "AbortError") ||
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "string" &&
          [
            "rate_limited",
            "limit_reached",
            "content_too_large",
            "translation_failed",
          ].includes(error.code))
      )
        throw error;
      if (
        !(error instanceof SdkError) ||
        (error.code !== "ai_provider_error" &&
          error.code !== "ai_output_invalid")
      )
        throw new SdkError(
          "The translation couldn't produce a valid result. Try again.",
          502,
          "translation_failed",
        );
    }
    signal?.throwIfAborted();
    const pending = fields.filter((field) => !accepted.has(field.id));
    for (const field of passingFields(answer, pending))
      accepted.set(field.id, field.text);
    const failed = fields
      .filter((field) => !accepted.has(field.id))
      .map((field) => field.alias);
    if (failed.length === 0) break;
    messages.push(
      { role: "assistant", content: answer },
      {
        role: "user",
        content: `Return complete JSON {"fields":[{"id":"…","text":"…"}]} for these failed ids only: ${JSON.stringify(failed)}. Preserve every placeholder exactly once.`,
      },
    );
  }
  if (accepted.size === 0)
    throw new SdkError(
      "The translation couldn't produce a valid result. Try again.",
      502,
      "translation_failed",
    );
  return {
    fields: request.fields.flatMap(({ id }) =>
      accepted.has(id) ? [{ id, text: accepted.get(id)! }] : [],
    ),
  };
}
