import "./dom-stubs";

import { describe, expect, it } from "vitest";
import { createApp, defineComponent, h, ref, type InjectionKey } from "vue";
import en from "../src/i18n/locales/en";
import de from "../src/i18n/locales/de";
import ptBR from "../src/i18n/locales/pt-BR";

import cloudEn from "../src/i18n/locales/cloud/en";
import cloudDe from "../src/i18n/locales/cloud/de";

import {
  getBaseLocale,
  loadTranslations,
  loadCloudTranslations,
  isLocaleSupported,
  isCloudLocaleSupported,
  getSupportedLocales,
  getSupportedCloudLocales,
} from "../src/i18n";
import { useI18n } from "../src/composables/useI18n";
import {
  useCloudI18n,
  useCloudI18nStrict,
} from "../src/composables/useCloudI18n";
import { TRANSLATIONS_KEY, CLOUD_TRANSLATIONS_KEY } from "../src/keys";

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
): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      entries.push(
        ...getNestedEntries(value as Record<string, unknown>, fullKey),
      );
    } else if (typeof value === "string") {
      entries.push([fullKey, value]);
    }
  }
  return entries;
}

function getPlaceholders(value: string): string[] {
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
  });

  it("returns true for locale with region if base is supported", () => {
    expect(isLocaleSupported("en-US")).toBe(true);
    expect(isLocaleSupported("de-AT")).toBe(true);
    expect(isLocaleSupported("pt-br")).toBe(true);
  });

  it("returns false for unsupported locales", () => {
    expect(isLocaleSupported("fr")).toBe(false);
    expect(isLocaleSupported("ja")).toBe(false);
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

describe("getSupportedCloudLocales", () => {
  it("returns cloud-supported locales", () => {
    const locales = getSupportedCloudLocales();
    expect(locales).toContain("en");
    expect(locales).toContain("de");
  });
});

describe("isCloudLocaleSupported", () => {
  it("returns true for supported cloud locales", () => {
    expect(isCloudLocaleSupported("en")).toBe(true);
    expect(isCloudLocaleSupported("de")).toBe(true);
    expect(isCloudLocaleSupported("pt-BR")).toBe(true);
  });

  it("returns true for region variants of supported cloud locales", () => {
    expect(isCloudLocaleSupported("en-US")).toBe(true);
    expect(isCloudLocaleSupported("de-AT")).toBe(true);
    expect(isCloudLocaleSupported("pt-br")).toBe(true);
  });

  it("returns false for unsupported cloud locales", () => {
    expect(isCloudLocaleSupported("fr")).toBe(false);
    expect(isCloudLocaleSupported("pt")).toBe(false);
    expect(isCloudLocaleSupported("pt-PT")).toBe(false);
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

  it("does not map pt or pt-PT to pt-BR", async () => {
    const pt = await loadTranslations("pt");
    const ptPT = await loadTranslations("pt-PT");
    expect(pt.footer.poweredBy).toBe("Powered by");
    expect(ptPT.footer.poweredBy).toBe("Powered by");
  });

  it("falls back to English for unsupported locale", async () => {
    const t = await loadTranslations("fr");
    expect(t.footer.poweredBy).toBe("Powered by");
  });
});

describe("loadCloudTranslations", () => {
  it("loads English cloud translations", async () => {
    const t = await loadCloudTranslations("en");
    expect(t.header.title).toBe("Templatical");
  });

  it("loads German cloud translations", async () => {
    const t = await loadCloudTranslations("de");
    expect(t.loading.initializing).toBe("Initialisieren...");
  });

  it("loads pt-BR cloud translations", async () => {
    const t = await loadCloudTranslations("pt-BR");
    expect(t.loading.initializing).toBe("Inicializando...");
  });

  it("does not map pt or pt-PT to pt-BR cloud translations", async () => {
    const pt = await loadCloudTranslations("pt");
    const ptPT = await loadCloudTranslations("pt-PT");
    expect(pt.loading.initializing).toBe("Initializing...");
    expect(ptPT.loading.initializing).toBe("Initializing...");
  });

  it("normalizes locale with region", async () => {
    const t = await loadCloudTranslations("en-US");
    expect(t.header.title).toBe("Templatical");
  });

  it("falls back to English for unsupported cloud locale", async () => {
    const t = await loadCloudTranslations("fr");
    expect(t.header.title).toBe("Templatical");
  });

  it("falls back to English when only OSS translation exists for the locale", async () => {
    // Simulates an OSS-only contributor: cloud locale not yet translated.
    // The fallback resolves cloud independently of OSS.
    const t = await loadCloudTranslations("xx");
    expect(t.header.title).toBe("Templatical");
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
        expect(localeEntries.map(([k]) => k)).toEqual(
          enEntries.map(([k]) => k),
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

describe("cloud locale parity", () => {
  // Skip-if-absent: only enforces parity for cloud locale files that exist.
  // An OSS-only contributor adding `locales/fr.ts` without `locales/cloud/fr.ts`
  // does not fail this test — the cloud chunk simply falls back to English.
  const cloudLocales = import.meta.glob<{ default: typeof cloudEn }>(
    "../src/i18n/locales/cloud/*.ts",
    { eager: true },
  );
  const cloudEnEntries = getNestedEntries(cloudEn).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [path, mod] of Object.entries(cloudLocales)) {
    const locale = localeFromPath(path);
    if (locale === "en") continue;

    describe(`cloud locale ${locale}`, () => {
      const localeEntries = getNestedEntries(mod.default).sort(([a], [b]) =>
        a.localeCompare(b),
      );

      it("has the same nested keys as cloud/en", () => {
        expect(localeEntries.map(([k]) => k)).toEqual(
          cloudEnEntries.map(([k]) => k),
        );
      });

      it("preserves placeholder tokens for every key", () => {
        const localeMap = new Map(localeEntries);
        const mismatches: Array<{
          key: string;
          en: string[];
          locale: string[];
        }> = [];
        for (const [key, enValue] of cloudEnEntries) {
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
      expect(format(cloudEn.header.templatesUsed, { used: 3, max: 10 })).toBe(
        "3/10 templates used",
      );
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

    it("throws when no translations injected and no override", () => {
      expect(() => {
        withProvide(() => useI18n(), {});
      }).toThrow("useI18n() requires a translations provider");
    });
  });
});

describe("useCloudI18n", () => {
  it("returns null when no cloud translations are provided", () => {
    const { t } = withProvide(() => useCloudI18n(), {});
    expect(t).toBeNull();
  });

  it("returns the injected cloud translations", () => {
    const { t } = withProvide(() => useCloudI18n(), {
      [CLOUD_TRANSLATIONS_KEY as symbol]: cloudEn,
    });
    expect(t?.header.title).toBe("Templatical");
  });

  it("unwraps Ref<CloudTranslations>", () => {
    const cloudRef = ref(cloudEn);
    const { t } = withProvide(() => useCloudI18n(), {
      [CLOUD_TRANSLATIONS_KEY as symbol]: cloudRef,
    });
    expect(t?.header.title).toBe("Templatical");
  });

  it("uses override over injected", () => {
    const { t } = withProvide(() => useCloudI18n(cloudDe), {
      [CLOUD_TRANSLATIONS_KEY as symbol]: cloudEn,
    });
    expect(t?.loading.initializing).toBe("Initialisieren...");
  });
});

describe("useCloudI18nStrict", () => {
  it("returns non-null cloud translations when provided", () => {
    const { t } = withProvide(() => useCloudI18nStrict(), {
      [CLOUD_TRANSLATIONS_KEY as symbol]: cloudEn,
    });
    expect(t.header.title).toBe("Templatical");
  });

  it("throws when no cloud translations are provided", () => {
    expect(() => {
      withProvide(() => useCloudI18nStrict(), {});
    }).toThrow("useCloudI18nStrict() requires a cloud translations provider");
  });
});
