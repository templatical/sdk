import type {
  TranslationProvider,
  TranslationResult,
} from "@templatical/types";
import { SdkError } from "@templatical/types";
import {
  AI_ROUTES,
  AI_WIRE_HEADER,
  AI_WIRE_VERSION,
  aiRoutePath,
} from "../wire";
import { errorFromResponse } from "./errors";

function failed(): SdkError {
  return new SdkError(
    "The translation couldn't produce a valid result. Try again.",
    502,
    "translation_failed",
  );
}

/** A TranslationProvider over the AI wire's JSON translate route. */
export function createHttpTranslationProvider(options: {
  url: string;
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  fetch?: typeof fetch;
}): TranslationProvider {
  const base = options.url.replace(/\/+$/, "");
  return {
    async translate(request, signal) {
      try {
        signal.throwIfAborted();
        const headers = new Headers(await options.headers?.());
        headers.set(AI_WIRE_HEADER, AI_WIRE_VERSION);
        headers.set("Accept", "application/json");
        headers.set("Content-Type", "application/json");
        signal.throwIfAborted();
        const response = await (options.fetch ?? fetch)(
          `${base}${aiRoutePath("translate", { template: request.templateId ?? "_" })}`,
          {
            method: AI_ROUTES.translate.method,
            headers,
            body: JSON.stringify(request),
            signal,
          },
        );
        if (!response.ok) throw await errorFromResponse(response);
        const result: unknown = await response.json();
        signal.throwIfAborted();
        if (
          typeof result !== "object" ||
          result === null ||
          !Array.isArray((result as TranslationResult).fields) ||
          !(result as TranslationResult).fields.every(
            (field) =>
              typeof field === "object" &&
              field !== null &&
              typeof field.id === "string" &&
              typeof field.text === "string",
          )
        )
          throw failed();
        return result as TranslationResult;
      } catch (error) {
        if (signal.aborted) {
          if (
            signal.reason instanceof Error &&
            signal.reason.name === "AbortError"
          )
            throw signal.reason;
          throw new DOMException("The translation was stopped.", "AbortError");
        }
        if (
          error instanceof SdkError ||
          (error instanceof Error && error.name === "AbortError")
        )
          throw error;
        throw failed();
      }
    },
  };
}
