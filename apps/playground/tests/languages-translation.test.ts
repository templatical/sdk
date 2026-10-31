import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyLocaleStrings,
  applyOperations,
  localeCoverage,
  localeStrings,
  resolveLocale,
  SYNTAX_PRESETS,
  type AiRewriteRequest,
} from "@templatical/types";
import { languages } from "../src/scenes/author/languages";

const context = (query = "") => ({ search: new URLSearchParams(query) });
const signal = () => new AbortController().signal;
const syntax = SYNTAX_PRESETS.liquid;

afterEach(() => vi.useRealTimers());

describe.each(["", "collaboration=1&user=Ada"])(
  "Languages translation providers (%s)",
  (branch) => {
    it.each(["de", "fr"])(
      "records every %s field and fills its gaps",
      async (locale) => {
        const ctx = context(branch);
        const config = languages.config(ctx);
        expect(config.translation?.translate).toBeTypeOf("function");
        expect(config.localization?.doNotTranslate).toEqual(["Sable"]);
        const content = languages.content!(ctx);
        if (locale === "fr") content.settings.locales!.push("fr");
        const extraction = localeStrings(content, locale, {
          syntax,
          only: "gaps",
          doNotTranslate: config.localization?.doNotTranslate,
        });
        const result = await config.translation!.translate(
          {
            templateId: "languages",
            sourceLocale: "en",
            targetLocale: locale,
            fields: extraction.strings.map(({ id, source, format }) => ({
              id,
              text: source,
              format,
            })),
          },
          signal(),
        );
        expect(result.fields).toHaveLength(locale === "de" ? 2 : 5);
        expect(
          result.fields.every(({ text }) => !text.includes(`[${locale}]`)),
        ).toBe(true);
        expect(result.fields).toContainEqual({
          id: "languages-stale/content",
          text:
            locale === "de"
              ? '<p>Das Angebot von <x id="1"/> endet am Freitag.</p>'
              : '<p>L’offre de <x id="1"/> se termine vendredi.</p>',
        });
        const applied = applyLocaleStrings(
          content,
          locale,
          result.fields.map((field) => ({
            ...field,
            sourceHash: extraction.strings.find(({ id }) => id === field.id)!
              .sourceHash,
          })),
          {
            syntax,
            tokens: extraction.tokens,
            doNotTranslate: config.localization?.doNotTranslate,
          },
        );
        expect(applied.rejected).toEqual([]);
        const translated = applyOperations(content, applied.operations);
        expect(localeCoverage(translated, locale).missing).toEqual([]);
        expect(localeCoverage(translated, locale).stale).toEqual([]);
        expect(
          translated.blocks.find(({ id }) => id === "languages-stale")?.l10n?.[
            locale
          ].text?.content.value,
        ).toContain("Sable");
        expect(resolveLocale(translated, "en")).toEqual(
          resolveLocale(content, "en"),
        );
      },
    );

    it("records a German Rewrite and retains the ordinary English recording", async () => {
      const config = languages.config(context(branch));
      expect(config.ai?.rewrite).toBeTypeOf("function");
      if (!config.ai?.rewrite) throw new Error("Rewrite is required");
      const content = languages.content!(context(branch));
      const request: AiRewriteRequest = {
        templateId: "languages",
        sessionId: "test-session",
        revision: null,
        content: resolveLocale(content, "de"),
        mergeTags: { syntax: "liquid", tags: [] },
        html: "<p>Entdecken Sie unsere neue Kollektion.</p>",
        preset: "shorten",
        language: null,
        instruction: null,
        locale: "de",
      };
      const result = await config.ai.rewrite(
        request,
        { onText: () => {} },
        signal(),
      );
      expect(result.html).toBe(
        "<p>Entdecken Sie die Highlights unserer Herbstkollektion.</p>",
      );
      const english = await config.ai.rewrite(
        {
          ...request,
          content: resolveLocale(content, "en"),
          locale: null,
          html: "<p>Discover our new collection.</p>",
        },
        { onText: () => {} },
        signal(),
      );
      expect(english.html).toBe("<p>✨ Discover our new collection.</p>");
    });

    it("exposes a tagged variant that rejects just its corrupted recording", async () => {
      expect(languages.variants).toContainEqual({
        name: "With a changed tag",
        query: { translation: "tags-changed" },
      });
      const ctx = context(`${branch}&translation=tags-changed`);
      const config = languages.config(ctx);
      const content = languages.content!(ctx);
      const extraction = localeStrings(content, "de", {
        syntax,
        only: "gaps",
        doNotTranslate: config.localization?.doNotTranslate,
      });
      expect(extraction.tokens["languages-tagged/content"]).toEqual([
        "{{first_name}}",
      ]);
      const result = await languages.config(ctx).translation!.translate(
        {
          templateId: "languages",
          sourceLocale: "en",
          targetLocale: "de",
          fields: extraction.strings.map(({ id, source, format }) => ({
            id,
            text: source,
            format,
          })),
        },
        signal(),
      );
      const applied = applyLocaleStrings(
        content,
        "de",
        result.fields.map((field) => ({
          ...field,
          sourceHash: extraction.strings.find(({ id }) => id === field.id)!
            .sourceHash,
        })),
        {
          syntax,
          tokens: extraction.tokens,
          doNotTranslate: config.localization?.doNotTranslate,
        },
      );
      expect(applied.rejected).toEqual([
        { id: "languages-tagged/content", reason: "tags_changed" },
      ]);
      const translated = applyOperations(content, applied.operations);
      expect(localeCoverage(translated, "de").missing).toEqual([
        "languages-tagged/content",
      ]);
      expect(
        translated.blocks.find(({ id }) => id === "languages-tagged")?.l10n,
      ).toBeUndefined();
    });

    it("forces small batches, returns the first immediately and aborts the delayed call", async () => {
      vi.useFakeTimers();
      expect(languages.variants).toContainEqual({
        name: "Cancel a partial translation",
        query: { translation: "cancel" },
      });
      const ctx = context(`${branch}&translation=cancel`);
      const config = languages.config(ctx);
      const content = languages.content!(ctx);
      content.settings.locales!.push("fr");
      const extraction = localeStrings(content, "fr", {
        syntax,
        only: "gaps",
        doNotTranslate: config.localization?.doNotTranslate,
      });
      const request = {
        templateId: "languages",
        sourceLocale: "en",
        targetLocale: "fr",
        fields: extraction.strings.map(({ id, source, format }) => ({
          id,
          text: source,
          format,
        })),
      };
      await expect(
        config.translation!.translate(request, signal()),
      ).rejects.toMatchObject({ name: "SdkError", code: "content_too_large" });
      const first = await config.translation!.translate(
        { ...request, fields: request.fields.slice(0, 2) },
        signal(),
      );
      expect(first.fields.map(({ id }) => id)).toEqual([
        "languages-title/content",
        "languages-hero/alt",
      ]);
      const controller = new AbortController();
      const later = config.translation!.translate(
        { ...request, fields: request.fields.slice(2, 4) },
        controller.signal,
      );
      const stopped = expect(later).rejects.toMatchObject({
        name: "AbortError",
      });
      expect(vi.getTimerCount()).toBe(1);
      controller.abort();
      await stopped;
      expect(vi.getTimerCount()).toBe(0);
      const retry = config.translation!.translate(
        { ...request, fields: request.fields.slice(2, 4) },
        signal(),
      );
      await vi.advanceTimersByTimeAsync(10_000);
      expect((await retry).fields).toHaveLength(2);
    });
  },
);
