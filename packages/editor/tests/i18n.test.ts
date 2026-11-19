import "./dom-stubs";

import { describe, expect, it } from "vitest";
import { createApp, defineComponent, h, ref, type InjectionKey } from "vue";
import en from "../src/i18n/locales/en";
import de from "../src/i18n/locales/de";
import ptBR from "../src/i18n/locales/pt-BR";

import {
  getBaseLocale,
  loadTranslations,
  isLocaleSupported,
  getSupportedLocales,
} from "../src/i18n";
import { useI18n } from "../src/composables/useI18n";
import { TRANSLATIONS_KEY } from "../src/keys";

function withProvide<T>(
  setup: () => T,
  provides: Record<string | symbol, unknown> = {},
): T {
  let result: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h("div");
      },
    }),
  );
  for (const [key, value] of Object.entries(provides)) {
    app.provide(key, value);
  }
  for (const sym of Object.getOwnPropertySymbols(provides)) {
    app.provide(sym as InjectionKey<unknown>, provides[sym]);
  }
  app.mount(document.createElement("div"));
  app.unmount();
  return result!;
}

function getNestedEntries(
  obj: Record<string, unknown>,
  prefix = "",
): Array<[string, string | { one: string; other: string }]> {
  const entries: Array<[string, string | { one: string; other: string }]> = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (
      typeof value === "object" &&
      value !== null &&
      "one" in value &&
      "other" in value
    ) {
      entries.push([fullKey, value as { one: string; other: string }]);
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      entries.push(
        ...getNestedEntries(value as Record<string, unknown>, fullKey),
      );
    } else if (typeof value === "string") {
      entries.push([fullKey, value]);
    }
  }
  return entries;
}

function getPlaceholders(
  value: string | { one: string; other: string },
): string[] {
  if (typeof value !== "string") {
    const one = getPlaceholders(value.one);
    expect(getPlaceholders(value.other)).toEqual(one);
    return one;
  }
  return (value.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).slice().sort();
}

function localeFromPath(path: string): string {
  return path.match(/\/([^/]+)\.ts$/)![1];
}

describe("getBaseLocale", () => {
  it("extracts base from locale with region", () => {
    expect(getBaseLocale("en-US")).toBe("en");
    expect(getBaseLocale("de-DE")).toBe("de");
    expect(getBaseLocale("en-GB")).toBe("en");
  });

  it("lowercases the result", () => {
    expect(getBaseLocale("EN-US")).toBe("en");
    expect(getBaseLocale("DE")).toBe("de");
  });

  it("handles simple locale", () => {
    expect(getBaseLocale("en")).toBe("en");
    expect(getBaseLocale("de")).toBe("de");
    expect(getBaseLocale("pt-BR")).toBe("pt");
  });

  it("handles empty string", () => {
    expect(getBaseLocale("")).toBe("");
  });
});

describe("isLocaleSupported", () => {
  it("returns true for supported locales", () => {
    expect(isLocaleSupported("en")).toBe(true);
    expect(isLocaleSupported("de")).toBe(true);
    expect(isLocaleSupported("pt-BR")).toBe(true);
    expect(isLocaleSupported("fr")).toBe(true);
    expect(isLocaleSupported("nl")).toBe(true);
    expect(isLocaleSupported("ja")).toBe(true);
    expect(isLocaleSupported("da")).toBe(true);
  });

  it("returns true for locale with region if base is supported", () => {
    expect(isLocaleSupported("en-US")).toBe(true);
    expect(isLocaleSupported("de-AT")).toBe(true);
    expect(isLocaleSupported("pt-br")).toBe(true);
    expect(isLocaleSupported("fr-BE")).toBe(true);
    expect(isLocaleSupported("nl-BE")).toBe(true);
    expect(isLocaleSupported("ja-JP")).toBe(true);
    expect(isLocaleSupported("da-DK")).toBe(true);
  });

  it("returns false for unsupported locales", () => {
    expect(isLocaleSupported("it")).toBe(false);
    expect(isLocaleSupported("ko")).toBe(false);
    expect(isLocaleSupported("pt")).toBe(false);
    expect(isLocaleSupported("pt-PT")).toBe(false);
  });
});

describe("getSupportedLocales", () => {
  it("returns supported locales", () => {
    const locales = getSupportedLocales();
    expect(locales).toContain("en");
    expect(locales).toContain("de");
    expect(locales).toContain("pt-BR");
  });

  it("returns a new array (not a reference)", () => {
    const a = getSupportedLocales();
    const b = getSupportedLocales();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("loadTranslations", () => {
  it("loads English OSS translations", async () => {
    const t = await loadTranslations("en");
    expect(t.footer.poweredBy).toBe("Powered by");
  });

  it("loads German OSS translations", async () => {
    const t = await loadTranslations("de");
    expect(t.history.undo).toBe("Rückgängig");
  });

  it("normalizes locale with region", async () => {
    const t = await loadTranslations("en-US");
    expect(t.footer.poweredBy).toBe("Powered by");
  });

  it("loads pt-BR translations", async () => {
    const t = await loadTranslations("pt-BR");
    expect(t.footer.poweredBy).toBe("Desenvolvido por");
  });

  it("loads pt-BR translations with case-insensitive locale", async () => {
    const t = await loadTranslations("pt-br");
    expect(t.footer.poweredBy).toBe("Desenvolvido por");
  });

  it("accepts underscore separator (pt_BR)", async () => {
    const t = await loadTranslations("pt_BR");
    expect(t.footer.poweredBy).toBe("Desenvolvido por");
  });

  it("does not map pt or pt-PT to pt-BR", async () => {
    const pt = await loadTranslations("pt");
    const ptPT = await loadTranslations("pt-PT");
    expect(pt.footer.poweredBy).toBe("Powered by");
    expect(ptPT.footer.poweredBy).toBe("Powered by");
  });

  it("loads French translations", async () => {
    const t = await loadTranslations("fr");
    expect(t.history.undo).toBe("Annuler");
  });

  it("loads Dutch translations", async () => {
    const t = await loadTranslations("nl");
    expect(t.history.undo).toBe("Ongedaan maken");
  });

  it("loads Japanese translations including merge tag controls", async () => {
    const t = await loadTranslations("ja-JP");
    expect(t.history.undo).toBe("元に戻す");
    expect(t.mergeTag.picker.title).toBe("差し込み項目を挿入");
  });

  it("loads Danish translations including merge tag controls", async () => {
    const t = await loadTranslations("da-DK");
    expect(t.history.undo).toBe("Fortryd");
    expect(t.mergeTag.picker.title).toBe("Indsæt flettefelt");
  });

  it("falls back to English for unsupported locale", async () => {
    const t = await loadTranslations("it");
    expect(t.footer.poweredBy).toBe("Powered by");
  });
});

describe("plural locale entries", () => {
  it("provides plural pairs for every migrated counted string", () => {
    for (const key of [
      "missingCount",
      "staleCount",
      "hiddenBeforeDefault",
      "defaultGaps",
      "defaultRemaining",
    ]) {
      expect((en.localization as Record<string, unknown>)[key]).toEqual({
        one: expect.any(String),
        other: expect.any(String),
      });
    }
  });
});

describe("OSS locale parity", () => {
  // Discover every OSS locale file at test time (mirrors the loader's glob).
  // Adding a locale automatically registers it in this test.
  const ossLocales = import.meta.glob<{ default: typeof en }>(
    "../src/i18n/locales/*.ts",
    { eager: true },
  );
  const enEntries = getNestedEntries(en).sort(([a], [b]) => a.localeCompare(b));

  for (const [path, mod] of Object.entries(ossLocales)) {
    const locale = localeFromPath(path);
    if (locale === "en") continue;

    describe(`locale ${locale}`, () => {
      const localeEntries = getNestedEntries(mod.default).sort(([a], [b]) =>
        a.localeCompare(b),
      );

      it("has the same nested keys as en", () => {
        expect(localeEntries.map(([k, value]) => [k, typeof value])).toEqual(
          enEntries.map(([k, value]) => [k, typeof value]),
        );
      });

      it("preserves placeholder tokens for every key", () => {
        const localeMap = new Map(localeEntries);
        const mismatches: Array<{
          key: string;
          en: string[];
          locale: string[];
        }> = [];
        for (const [key, enValue] of enEntries) {
          const localeValue = localeMap.get(key);
          if (localeValue === undefined) continue;
          const enPh = getPlaceholders(enValue);
          const localePh = getPlaceholders(localeValue);
          if (enPh.join(",") !== localePh.join(",")) {
            mismatches.push({ key, en: enPh, locale: localePh });
          }
        }
        expect(mismatches).toEqual([]);
      });
    });
  }
});

describe("useI18n", () => {
  it("uses override translations", () => {
    const { t } = useI18n(en);
    expect(t.footer.poweredBy).toBe("Powered by");
  });

  describe("format", () => {
    const { format } = useI18n(en);

    it("replaces single placeholder", () => {
      expect(format("{count} items", { count: 5 })).toBe("5 items");
    });

    it("replaces multiple placeholders", () => {
      expect(format("{a} and {b}", { a: "foo", b: "bar" })).toBe("foo and bar");
    });

    it("leaves missing placeholders unchanged", () => {
      expect(format("{name} - {missing}", { name: "test" })).toBe(
        "test - {missing}",
      );
    });

    it("converts numbers to strings", () => {
      expect(format("Page {n}", { n: 42 })).toBe("Page 42");
    });

    it("handles empty string", () => {
      expect(format("", { key: "val" })).toBe("");
    });

    it("formats actual translation strings", () => {
      expect(format(en.footer.poweredBy, {})).toBe("Powered by");
    });
  });

  describe("injection path", () => {
    it("injects plain translations from context when no override", () => {
      const { t } = withProvide(() => useI18n(), {
        [TRANSLATIONS_KEY as symbol]: en,
      });
      expect(t.footer.poweredBy).toBe("Powered by");
    });

    it("unwraps Ref<Translations> from inject", () => {
      const translationsRef = ref(en);
      const { t } = withProvide(() => useI18n(), {
        [TRANSLATIONS_KEY as symbol]: translationsRef,
      });
      expect(t.footer.poweredBy).toBe("Powered by");
    });

    it("injects German translations from context", () => {
      const { t } = withProvide(() => useI18n(), {
        [TRANSLATIONS_KEY as symbol]: de,
      });
      expect(t.history.undo).toBe("Rückgängig");
    });

    it("injects pt-BR translations from context", () => {
      const { t } = withProvide(() => useI18n(), {
        [TRANSLATIONS_KEY as symbol]: ptBR,
      });
      expect(t.footer.poweredBy).toBe("Desenvolvido por");
    });

    it("override takes precedence over injected", () => {
      const { t } = withProvide(() => useI18n(de), {
        [TRANSLATIONS_KEY as symbol]: en,
      });
      expect(t.history.undo).toBe("Rückgängig");
    });

    it("format works with injected translations", () => {
      const { format } = withProvide(() => useI18n(), {
        [TRANSLATIONS_KEY as symbol]: en,
      });
      expect(format("{a} + {b}", { a: "1", b: "2" })).toBe("1 + 2");
    });

    // Full message, not a prefix: the guidance sentence names a file, and a
    // prefix assertion would let that name go stale unnoticed.
    it("throws when no translations injected and no override", () => {
      expect(() => {
        withProvide(() => useI18n(), {});
      }).toThrow(
        "useI18n() requires a translations provider. Ensure the component renders inside the editor, below Editor.vue.",
      );
    });
  });
});
