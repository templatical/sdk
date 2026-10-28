import {
  computed,
  onScopeDispose,
  shallowReadonly,
  shallowRef,
  toRaw,
  watch,
  type ComputedRef,
  type Ref,
} from "vue";
import type { UseEditorReturn, UseHistoryReturn } from "@templatical/core";
import {
  applyLocaleStrings,
  applyOperationsInPlace,
  defaultLocaleOf,
  invertOperations,
  localeStrings,
  safeClone,
  SdkError,
  TRANSLATION_MAX_CHARS,
  TRANSLATION_MAX_FIELDS,
  unmaskTags,
  type Block,
  type CustomBlockDefinition,
  type LocaleString,
  type Operation,
  type SyntaxPreset,
  type TranslationErrorCode,
  type TranslationProvider,
  type TranslationResult,
} from "@templatical/types";
import type { UseCollaborationFeatureReturn } from "./useCollaborationFeature";
import { sanitizeRichTextHtml } from "../utils/sanitizeRichTextHtml";

export interface TranslationRunResult {
  translated: number;
  tagsChanged: string[];
  skippedLocked: string[];
  missing: string[];
  error: { code: string; message: string } | null;
  cancelled: boolean;
}

export interface UseTranslationFeatureReturn {
  isAvailable: ComputedRef<boolean>;
  counts: ComputedRef<{ gaps: number; all: number }>;
  running: Readonly<Ref<{ done: number; total: number } | null>>;
  lastResult: Readonly<Ref<TranslationRunResult | null>>;
  translate(scope: {
    only: "gaps" | "all";
    blockId?: string;
  }): Promise<TranslationRunResult>;
  cancel(): void;
  dismissResult(): void;
}

interface UseTranslationFeatureOptions {
  provider: TranslationProvider;
  editor: Pick<
    UseEditorReturn,
    "content" | "activeLocale" | "loadVersion" | "state" | "markDirty"
  >;
  localization?: { locales: string[] };
  definitions: () => readonly CustomBlockDefinition[];
  syntax: () => SyntaxPreset;
  history: () => Pick<UseHistoryReturn, "record">;
  collaboration?: Pick<UseCollaborationFeatureReturn, "core"> | null;
}

/** Provider errors cross bundles and may be plain objects. */
function translationError(error: unknown): {
  code: TranslationErrorCode;
  message?: string;
  statusCode?: number;
} | null {
  if (typeof error !== "object" || error === null) return null;
  const shaped = error as {
    code?: unknown;
    message?: unknown;
    statusCode?: unknown;
  };
  if (
    (shaped.code !== "rate_limited" &&
      shaped.code !== "limit_reached" &&
      shaped.code !== "content_too_large" &&
      shaped.code !== "translation_failed") ||
    (shaped.statusCode !== undefined && typeof shaped.statusCode !== "number")
  )
    return null;
  return {
    code: shaped.code,
    ...(typeof shaped.message === "string" ? { message: shaped.message } : {}),
    ...(shaped.statusCode === undefined
      ? {}
      : { statusCode: shaped.statusCode }),
  };
}

/** Keep placeholder bytes out of the DOM parser, including in attributes. */
function sanitizeTranslation(text: string): string {
  const prefix = `tpl-translation-${crypto.randomUUID()}-`;
  const placeholders: string[] = [];
  const protectedText = text.replace(
    /<x id="\d+"\s*\/>|<x id="\d+"><\/x>|__x\d+__/g,
    (token) => `${prefix}${placeholders.push(token)}-end`,
  );
  let clean = sanitizeRichTextHtml(protectedText);
  placeholders.forEach((token, index) => {
    clean = clean.replaceAll(`${prefix}${index + 1}-end`, token);
  });
  return clean;
}

async function abortable<T>(promise: Promise<T>, signal: AbortSignal) {
  signal.throwIfAborted();
  let abort!: () => void;
  const stopped = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([promise, stopped]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

export function useTranslationFeature(
  options: UseTranslationFeatureOptions,
): UseTranslationFeatureReturn {
  const { editor } = options;
  const running = shallowRef<{ done: number; total: number } | null>(null);
  const lastResult = shallowRef<TranslationRunResult | null>(null);
  let active: { controller: AbortController; discarded: boolean } | null = null;
  const disposed = shallowRef(false);
  const isAvailable = computed(() => {
    const locale = editor.activeLocale.value;
    return (
      !disposed.value &&
      !!locale &&
      locale !== defaultLocaleOf(editor.content.value) &&
      !!options.localization?.locales.includes(locale) &&
      !!editor.content.value.settings.locales?.includes(locale)
    );
  });
  const counts = computed(() => {
    if (!isAvailable.value) return { gaps: 0, all: 0 };
    const extract = (only: "gaps" | "all") =>
      localeStrings(editor.content.value, editor.activeLocale.value!, {
        definitions: options.definitions(),
        syntax: options.syntax(),
        only,
      }).strings.length;
    return { gaps: extract("gaps"), all: extract("all") };
  });
  function cancel() {
    active?.controller.abort();
  }
  function discard() {
    if (active) active.discarded = true;
    cancel();
    lastResult.value = null;
  }
  watch(editor.activeLocale, cancel, { flush: "sync" });
  watch(
    [editor.content, editor.loadVersion, () => editor.state.template?.id],
    discard,
    { flush: "sync" },
  );
  onScopeDispose(() => {
    disposed.value = true;
    discard();
  });

  async function translate(scope: {
    only: "gaps" | "all";
    blockId?: string;
  }): Promise<TranslationRunResult> {
    if (active)
      throw new SdkError(
        "A translation is already running.",
        409,
        "translation_running",
      );
    if (!isAvailable.value)
      throw new SdkError(
        "Translation isn't available in this language.",
        403,
        "feature_unavailable",
      );
    const core = options.collaboration?.core;
    core?.flush();
    const locale = editor.activeLocale.value!;
    const templateId = editor.state.template?.id ?? null;
    const sourceLocale = defaultLocaleOf(editor.content.value);
    const definitions = safeClone(toRaw([...options.definitions()]));
    const syntax = options.syntax();
    const extraction = localeStrings(editor.content.value, locale, {
      ...scope,
      definitions,
      syntax,
    });
    const result: TranslationRunResult = {
      translated: 0,
      tagsChanged: [],
      skippedLocked: [],
      missing: [],
      error: null,
      cancelled: false,
    };
    const job = { controller: new AbortController(), discarded: false };
    active = job;
    lastResult.value = null;
    running.value = { done: 0, total: extraction.strings.length };
    const values: { id: string; text: string; sourceHash: string }[] = [];
    let offset = 0;
    let limit = TRANSLATION_MAX_FIELDS;
    try {
      while (offset < extraction.strings.length) {
        job.controller.signal.throwIfAborted();
        const chunk: LocaleString[] = [];
        let chars = 0;
        for (const field of extraction.strings.slice(offset, offset + limit)) {
          if (chars + field.source.length > TRANSLATION_MAX_CHARS) break;
          chunk.push(field);
          chars += field.source.length;
        }
        if (chunk.length === 0)
          throw new SdkError(
            "A field is too large to translate.",
            413,
            "content_too_large",
          );
        let answer: TranslationResult;
        try {
          answer = await abortable(
            options.provider.translate(
              {
                templateId,
                sourceLocale,
                targetLocale: locale,
                fields: chunk.map(({ id, source, format }) => ({
                  id,
                  text: source,
                  format,
                })),
              },
              job.controller.signal,
            ),
            job.controller.signal,
          );
          job.controller.signal.throwIfAborted();
        } catch (error) {
          if (
            !job.controller.signal.aborted &&
            translationError(error)?.code === "content_too_large" &&
            chunk.length > 1
          ) {
            limit = Math.floor(chunk.length / 2);
            continue;
          }
          throw error;
        }
        for (const field of chunk) {
          const returned = answer.fields.find((value) => value.id === field.id);
          if (!returned) {
            result.missing.push(field.id);
            continue;
          }
          if (unmaskTags(returned.text, extraction.tokens[field.id]) === null) {
            result.tagsChanged.push(field.id);
            continue;
          }
          values.push({
            id: field.id,
            text:
              field.format === "html"
                ? sanitizeTranslation(returned.text)
                : returned.text,
            sourceHash: field.sourceHash,
          });
        }
        offset += chunk.length;
        running.value = { done: offset, total: extraction.strings.length };
      }
    } catch (error) {
      if (
        job.controller.signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      )
        result.cancelled = true;
      else
        result.error = {
          code: translationError(error)?.code ?? "translation_failed",
          message:
            translationError(error)?.message ??
            (error instanceof Error ? error.message : String(error)),
        };
    }
    try {
      if (!job.discarded) {
        core?.flush();
        const applied = applyLocaleStrings(
          editor.content.value,
          locale,
          values,
          {
            definitions,
            syntax,
            tokens: extraction.tokens,
          },
        );
        for (const rejection of applied.rejected)
          if (rejection.reason === "tags_changed")
            result.tagsChanged.push(rejection.id);
        const blocks = new Map<string, Block>();
        const collect = (items: Block[]) => {
          for (const block of items) {
            blocks.set(block.id, block);
            if (block.type === "section")
              for (const column of block.children) collect(column);
          }
        };
        collect(editor.content.value.blocks);
        const changed = applied.operations
          .map((operation): Operation | null => {
            if (
              operation.op !== "updateBlockLocale" &&
              operation.op !== "updateSettingsLocale"
            )
              return operation;
            const stored =
              operation.op === "updateSettingsLocale"
                ? editor.content.value.settings.l10n?.[locale]?.text
                : blocks.get(operation.blockId)?.l10n?.[locale]?.text;
            const text = Object.fromEntries(
              Object.entries(operation.text ?? {}).filter(
                ([path, value]) =>
                  value.value !== stored?.[path]?.value ||
                  value.sourceHash !== stored?.[path]?.sourceHash,
              ),
            );
            return Object.keys(text).length ? { ...operation, text } : null;
          })
          .filter((operation): operation is Operation => operation !== null);
        const operations = changed.filter((operation) => {
          if (operation.op !== "updateBlockLocale" || !core) return true;
          const locked = core
            .locksOf(operation.blockId)
            .some(
              (lock) =>
                lock.holder.sessionId !== core.sessionId &&
                (lock.locale == null || lock.locale === locale),
            );
          if (locked)
            result.skippedLocked.push(
              ...Object.keys(operation.text ?? {}).map(
                (path) => `${operation.blockId}/${path}`,
              ),
            );
          return !locked;
        });
        if (operations.length) {
          // Validate before recording; the controller captures this ordinary
          // local mutation by diffing, with no new collaboration origin.
          invertOperations(toRaw(editor.content.value), operations);
          options.history().record();
          applyOperationsInPlace(editor.content.value, operations);
          editor.markDirty();
          core?.flush();
          result.translated = operations.reduce(
            (count, operation) =>
              count +
              (operation.op === "updateBlockLocale" ||
              operation.op === "updateSettingsLocale"
                ? Object.keys(operation.text ?? {}).length
                : 0),
            0,
          );
        }
        lastResult.value = result;
      }
    } finally {
      active = null;
      running.value = null;
    }
    return result;
  }

  return {
    isAvailable,
    counts,
    running: shallowReadonly(running),
    lastResult: shallowReadonly(lastResult),
    translate,
    cancel,
    dismissResult: () => {
      lastResult.value = null;
    },
  };
}
