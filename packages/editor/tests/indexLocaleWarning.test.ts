import "./dom-stubs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The entry pulls in Vue, Editor.vue and the fonts manager; none of them matter
// here, so they are stubbed exactly as `index-init.test.ts` stubs them. The i18n
// module is the one under observation, so its real resolution is preserved and
// only the bundle loaders are faked.
function mockEntryDeps(): void {
  vi.doMock("vue", async () => {
    const actual = await vi.importActual<typeof import("vue")>("vue");
    return {
      ...actual,
      createApp: vi.fn(() => ({ mount: vi.fn(), unmount: vi.fn() })),
      h: vi.fn(() => ({})),
    };
  });
  vi.doMock("../src/Editor.vue", () => ({ default: { name: "Editor" } }));
  vi.doMock("../src/composables", () => ({
    useFonts: vi.fn(() => ({ fonts: { value: [] } })),
  }));
  vi.doMock("../src/utils/toMjml", () => ({ toMjmlForInstance: vi.fn() }));
}

async function initWithLocale(locale?: string): Promise<string[]> {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const container = document.createElement("div");
  document.body.appendChild(container);

  const { init } = await import("../src/index");
  await init({
    container,
    // Light DOM: `dom-stubs` has no `attachShadow`, and the mount mode is
    // irrelevant to which locale bundle the entry picks.
    shadowDom: false,
    ...(locale === undefined ? {} : { locale }),
  });

  const messages = warn.mock.calls.map((call) => call.join(" "));
  warn.mockRestore();
  // No teardown: `dom-stubs`' minimal element has no `remove()`, and each case
  // mounts onto its own fresh container, so nothing leaks between them.
  return messages.filter((m) => m.includes("config.locale"));
}

describe("init() warns about an unusable locale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockEntryDeps();
    // Real resolution, fake bundles: the point is which locale the resolver
    // *would* pick, not what the bundle contains.
    vi.doMock("../src/i18n", async () => {
      const actual =
        await vi.importActual<typeof import("../src/i18n")>("../src/i18n");
      return {
        ...actual,
        loadTranslations: vi.fn(async () => ({}) as never),
        loadCloudTranslations: vi.fn(async () => ({}) as never),
      };
    });
  });

  // `paletteBlocks` and `colors` both warn on unusable input; the locale
  // silently fell back to English, so a typo — "gr" for Greek (country code,
  // not the language code "el") — looked exactly like the editor ignoring the
  // option. Regions and whitespace are covered below as the NON-typo case.
  it("names the locale and what it fell back to", async () => {
    const [message] = await initWithLocale("ja");
    expect(message).toContain("config.locale");
    expect(message).toContain("ja");
    expect(message).toContain("English");
  });

  it("lists the locales that would have worked", async () => {
    const [message] = await initWithLocale("ja");
    for (const locale of ["ca", "de", "en", "es", "fr", "nl", "pt-BR"]) {
      expect(message).toContain(locale);
    }
  });

  it("warns once, not once per lookup", async () => {
    expect(await initWithLocale("ja")).toHaveLength(1);
  });

  it.each(["de", "en", "pt-BR"])("stays silent for %s", async (locale) => {
    expect(await initWithLocale(locale)).toEqual([]);
  });

  // Region stripping is documented, supported behaviour — not a fallback.
  it.each(["de-AT", "de_DE", "  de  ", "PT-br"])(
    "stays silent when the base language resolves: %s",
    async (locale) => {
      expect(await initWithLocale(locale)).toEqual([]);
    },
  );

  it("stays silent when no locale is configured at all", async () => {
    expect(await initWithLocale(undefined)).toEqual([]);
  });

  // The cloud chunk deliberately ships fewer locales than the OSS one and falls
  // back to English on its own — `guide/i18n.md` tells contributors not to
  // translate it. Warning about that would fire for every `fr`/`es`/`nl`/`ca`
  // consumer, who did nothing wrong.
  it("says nothing about the cloud chunk's narrower coverage", async () => {
    const { getSupportedLocales, getSupportedCloudLocales } = await import(
      "../src/i18n"
    );
    const ossOnly = getSupportedLocales().filter(
      (l) => !getSupportedCloudLocales().includes(l),
    );
    expect(ossOnly.length).toBeGreaterThan(0);

    for (const locale of ossOnly) {
      expect(await initWithLocale(locale)).toEqual([]);
    }
  });
});
