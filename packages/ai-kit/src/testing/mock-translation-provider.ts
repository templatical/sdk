import type { TranslationProvider } from "@templatical/types";
import { findOpenTagEnd } from "@templatical/types";

function prefixHtml(text: string, prefix: string): string {
  let cursor = 0;
  while (cursor < text.length) {
    if (text[cursor] === "<") {
      const end = findOpenTagEnd(text, cursor + 1);
      if (end < 0) break;
      cursor = end + 1;
    } else {
      const end = text.indexOf("<", cursor);
      const segment = text.slice(cursor, end < 0 ? text.length : end);
      if (segment.trim())
        return text.slice(0, cursor) + prefix + text.slice(cursor);
      cursor = end < 0 ? text.length : end;
    }
  }
  return text + prefix;
}

/** Deterministic recorded translations, or a language prefix with placeholders intact. */
export function createMockTranslationProvider(
  options: {
    translations?: Record<string, Record<string, string>>;
    delayMs?: number;
  } = {},
): TranslationProvider {
  return {
    async translate(request, signal) {
      signal.throwIfAborted();
      if ((options.delayMs ?? 0) > 0) {
        await new Promise<void>((resolve, reject) => {
          const stop = () => {
            clearTimeout(timer);
            reject(
              new DOMException("The translation was stopped.", "AbortError"),
            );
          };
          const timer = setTimeout(() => {
            signal.removeEventListener("abort", stop);
            resolve();
          }, options.delayMs);
          signal.addEventListener("abort", stop, { once: true });
        });
      }
      signal.throwIfAborted();
      return {
        fields: request.fields.map(({ id, text, format }) => ({
          id,
          text:
            options.translations?.[request.targetLocale]?.[id] ??
            (format === "html"
              ? prefixHtml(text, `[${request.targetLocale}] `)
              : `[${request.targetLocale}] ${text}`),
        })),
      };
    },
  };
}
