// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import {
  createDefaultTemplateContent,
  type TemplateSettings,
} from "@templatical/types";
import Editor from "../src/Editor.vue";
import RightSidebar from "../src/components/RightSidebar.vue";
import TemplateSettingsPanel from "../src/components/TemplateSettings.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";
import { logger } from "../src/utils/logger";
import { FONTS_MANAGER_KEY, TEMPLATE_SETTINGS_FIELDS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";
import {
  ALL_TEMPLATE_SETTINGS_FIELDS,
  TEMPLATE_SETTINGS_FIELD_CARDS,
  type TemplateSettingsField,
  resolveTemplateSettingsFields,
} from "../src/utils/templateSettingsFields";

/**
 * `templateSettings.fields` — the allowlist that decides which template
 * settings the panel exposes (issue #674).
 *
 * The config only ever narrows: a consumer who set nothing keeps all eight
 * fields, which is why every "omitted" case below asserts the full set rather
 * than an empty one.
 */

function resolve(config?: Parameters<typeof resolveTemplateSettingsFields>[0]) {
  return resolveTemplateSettingsFields(config);
}

describe("resolveTemplateSettingsFields", () => {
  it("allows every field when no config is given", () => {
    expect([...resolve().fields].sort()).toEqual(
      [...ALL_TEMPLATE_SETTINGS_FIELDS].sort(),
    );
  });

  it("allows every field when the key is present but `fields` is not", () => {
    expect([...resolve({}).fields].sort()).toEqual(
      [...ALL_TEMPLATE_SETTINGS_FIELDS].sort(),
    );
  });

  it("allows every field for `fields: true`", () => {
    expect([...resolve({ fields: true }).fields].sort()).toEqual(
      [...ALL_TEMPLATE_SETTINGS_FIELDS].sort(),
    );
  });

  it("allows no field for `fields: false`", () => {
    expect([...resolve({ fields: false }).fields]).toEqual([]);
  });

  it("treats an empty array as a stated decision, not as unset", () => {
    expect([...resolve({ fields: [] }).fields]).toEqual([]);
  });

  it("keeps exactly the listed fields", () => {
    const resolved = resolve({ fields: ["width", "locale"] });
    expect([...resolved.fields].sort()).toEqual(["locale", "width"]);
  });

  it("narrows rather than reorders — the allowlist carries no order", () => {
    // Fields sit in fixed cards, so unlike `paletteBlocks` the list cannot
    // express an order. Asserted as a set, and the resolver returns a Set so
    // there is nothing for a consumer to read an order out of.
    const resolved = resolve({ fields: ["locale", "width"] });
    expect(resolved.fields).toBeInstanceOf(Set);
    expect([...resolved.fields].sort()).toEqual(["locale", "width"]);
  });

  it("skips an unknown entry and reports it", () => {
    const resolved = resolve({
      // A JS consumer can pass anything; TS callers get a compile error.
      fields: ["width", "colour" as never],
    });
    expect([...resolved.fields]).toEqual(["width"]);
    expect(resolved.unknown).toEqual(["colour"]);
  });

  it("does not restore the full set when every entry is unknown", () => {
    const resolved = resolve({ fields: ["nope" as never] });
    expect([...resolved.fields]).toEqual([]);
    expect(resolved.unknown).toEqual(["nope"]);
  });

  it("deduplicates a repeated entry", () => {
    const resolved = resolve({ fields: ["width", "width"] });
    expect([...resolved.fields]).toEqual(["width"]);
    expect(resolved.unknown).toEqual([]);
  });

  it("reports no unknown entries for a clean list", () => {
    expect(resolve({ fields: ["fontFamily"] }).unknown).toEqual([]);
  });
});

describe("TEMPLATE_SETTINGS_FIELD_CARDS", () => {
  it("assigns every TemplateSettings member to a card", () => {
    // The map is typed `Record<keyof TemplateSettings, TemplateSettingsCard>`,
    // so a new setting fails `vue-tsc` until someone decides which card it
    // belongs in. This case is the runtime half: it fails if that annotation
    // is ever loosened, which would let a field ship with no way to hide it.
    expect(Object.keys(TEMPLATE_SETTINGS_FIELD_CARDS).sort()).toEqual([
      "backgroundColor",
      "direction",
      "fontFamily",
      "linkColor",
      "linkUnderline",
      "locale",
      "preheaderText",
      "textColor",
      "width",
    ]);
  });

  it("groups the fields the way the panel renders them", () => {
    expect(TEMPLATE_SETTINGS_FIELD_CARDS).toEqual({
      width: "layout",
      backgroundColor: "appearance",
      textColor: "appearance",
      linkColor: "appearance",
      linkUnderline: "appearance",
      fontFamily: "appearance",
      locale: "language",
      direction: "language",
      preheaderText: "preheader",
    });
  });
});

// --- Panel gating -----------------------------------------------------------

const fontsManager = {
  fonts: ref([{ label: "Default", value: "Arial" }]),
  defaultFont: ref("Arial"),
  loadCustomFonts: async () => {},
  cleanupFontLinks: () => {},
  setCustomFontsEnabled: () => {},
};

function makeSettings(): TemplateSettings {
  return {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    linkColor: "#0066cc",
    linkUnderline: true,
    fontFamily: "Arial",
    locale: "en",
    preheaderText: "A preheader",
  };
}

/** Mount the panel. `fields` omitted means "no provide at all" — the default. */
function mountPanel(fields?: TemplateSettingsField[]) {
  return mountEditor(TemplateSettingsPanel, {
    props: { settings: makeSettings() },
    provides: {
      [FONTS_MANAGER_KEY]: fontsManager,
      ...(fields === undefined
        ? {}
        : { [TEMPLATE_SETTINGS_FIELDS_KEY]: new Set(fields) }),
    },
  });
}

const CARDS = [
  "layout",
  "appearance",
  "language",
  "preheader",
  "tips",
] as const;

function visibleCards(wrapper: ReturnType<typeof mountPanel>): string[] {
  return CARDS.filter((card) =>
    wrapper.find(`[data-testid="template-settings-card-${card}"]`).exists(),
  );
}

function has(wrapper: ReturnType<typeof mountPanel>, testid: string): boolean {
  return wrapper.find(`[data-testid="${testid}"]`).exists();
}

describe("TemplateSettings panel visibility", () => {
  it("renders every card when nothing is provided", () => {
    // The injection key is absent for a consumer who configured nothing, so
    // the default has to be "all" rather than "none".
    expect(visibleCards(mountPanel())).toEqual([
      "layout",
      "appearance",
      "language",
      "preheader",
      "tips",
    ]);
  });

  it("renders every field control when nothing is provided", () => {
    const wrapper = mountPanel();
    for (const testid of [
      "template-settings-width-preset",
      "template-settings-width-custom",
      "template-settings-background",
      "template-settings-text-color",
      "template-settings-link-color",
      "template-settings-link-underline",
      "template-settings-font-family",
      "template-settings-locale",
      "template-settings-direction",
      "template-settings-preheader",
    ]) {
      expect(has(wrapper, testid), testid).toBe(true);
    }
  });

  it("keeps the Language card when only locale is excluded", () => {
    const wrapper = mountPanel(
      ALL_TEMPLATE_SETTINGS_FIELDS.filter((f) => f !== "locale"),
    );
    expect(has(wrapper, "template-settings-locale")).toBe(false);
    expect(has(wrapper, "template-settings-direction")).toBe(true);
    expect(visibleCards(wrapper)).toEqual([
      "layout",
      "appearance",
      "language",
      "preheader",
      "tips",
    ]);
  });

  it("keeps the Language card when only direction is excluded", () => {
    const wrapper = mountPanel(
      ALL_TEMPLATE_SETTINGS_FIELDS.filter((f) => f !== "direction"),
    );
    expect(has(wrapper, "template-settings-direction")).toBe(false);
    expect(has(wrapper, "template-settings-locale")).toBe(true);
    expect(visibleCards(wrapper)).toEqual([
      "layout",
      "appearance",
      "language",
      "preheader",
      "tips",
    ]);
  });

  it("drops the Language card when locale and direction are both excluded", () => {
    const wrapper = mountPanel(
      ALL_TEMPLATE_SETTINGS_FIELDS.filter(
        (f) => f !== "locale" && f !== "direction",
      ),
    );
    expect(has(wrapper, "template-settings-locale")).toBe(false);
    expect(has(wrapper, "template-settings-direction")).toBe(false);
    expect(visibleCards(wrapper)).toEqual([
      "layout",
      "appearance",
      "preheader",
      "tips",
    ]);
  });

  it("drops the Preheader card when preheaderText is excluded", () => {
    const wrapper = mountPanel(
      ALL_TEMPLATE_SETTINGS_FIELDS.filter((f) => f !== "preheaderText"),
    );
    expect(has(wrapper, "template-settings-preheader")).toBe(false);
    expect(visibleCards(wrapper)).toEqual([
      "layout",
      "appearance",
      "language",
      "tips",
    ]);
  });

  it("keeps the Appearance card and drops only the excluded control", () => {
    const wrapper = mountPanel([
      "backgroundColor",
      "textColor",
      "linkUnderline",
      "locale",
    ]);
    expect(visibleCards(wrapper)).toEqual(["appearance", "language", "tips"]);
    expect(has(wrapper, "template-settings-background")).toBe(true);
    expect(has(wrapper, "template-settings-text-color")).toBe(true);
    expect(has(wrapper, "template-settings-link-underline")).toBe(true);
    expect(has(wrapper, "template-settings-link-color")).toBe(false);
    expect(has(wrapper, "template-settings-font-family")).toBe(false);
  });

  it("gates both width controls on the single width field", () => {
    const wrapper = mountPanel(["width"]);
    expect(visibleCards(wrapper)).toEqual(["layout", "tips"]);
    expect(has(wrapper, "template-settings-width-preset")).toBe(true);
    expect(has(wrapper, "template-settings-width-custom")).toBe(true);
  });

  it("renders nothing at all when every field is excluded", () => {
    // Including Tips: the card is advice about settings, so a panel of nothing
    // but advice is worse than no panel. The tab gate below is the other half.
    const wrapper = mountPanel([]);
    expect(visibleCards(wrapper)).toEqual([]);
  });

  it("spaces card contents with a flex gap, never a trailing margin", () => {
    // A per-child bottom margin leaves dead space under whichever field is now
    // last once an excluded one is dropped. A flex gap has no trailing edge, so
    // every subset spaces correctly with no per-card bookkeeping.
    const wrapper = mountPanel();
    const card = wrapper.find(
      '[data-testid="template-settings-card-appearance"]',
    );
    expect(card.classes()).toContain("tpl:flex-col");
    expect(card.classes()).toContain("tpl:gap-3.5");
    expect(wrapper.html()).not.toContain("tpl:mb-3.5");
  });
});

// --- Settings tab gating ----------------------------------------------------

function mountRightSidebar(fields?: TemplateSettingsField[]) {
  return mountEditor(RightSidebar, {
    props: { selectedBlock: null, settings: makeSettings() },
    provides: {
      [FONTS_MANAGER_KEY]: fontsManager,
      ...(fields === undefined
        ? {}
        : { [TEMPLATE_SETTINGS_FIELDS_KEY]: new Set(fields) }),
    },
  });
}

describe("RightSidebar Settings tab", () => {
  it("renders the Settings tab when nothing is provided", () => {
    expect(mountRightSidebar().find("#tpl-tab-settings").exists()).toBe(true);
  });

  it("renders the Settings tab while at least one field survives", () => {
    expect(
      mountRightSidebar(["preheaderText"]).find("#tpl-tab-settings").exists(),
    ).toBe(true);
  });

  it("hides the Settings tab when every field is excluded", () => {
    // A tab that opens an empty panel is worse than no tab, so the whole
    // control goes rather than the panel rendering blank.
    expect(mountRightSidebar([]).find("#tpl-tab-settings").exists()).toBe(
      false,
    );
  });

  it("keeps the Content tab when the Settings tab is hidden", () => {
    const wrapper = mountRightSidebar([]);
    expect(wrapper.find("#tpl-tab-content").exists()).toBe(true);
    expect(wrapper.find("#tpl-tabpanel-content").exists()).toBe(true);
  });

  it("never renders the settings tabpanel when the tab is hidden", () => {
    // `activeTab` starts on "content" and only the (absent) button can change
    // it, so this is belt-and-braces — the panel carries the same gate the
    // issues panel does, rather than trusting that nothing can select it.
    expect(mountRightSidebar([]).find("#tpl-tabpanel-settings").exists()).toBe(
      false,
    );
  });
});

// --- The config actually reaches the panel ----------------------------------
//
// The two describes above provide the injection key straight into a mount,
// which proves the components read it and NOTHING about whether the config
// gets there. `Editor.vue` hands `useEditorCore` a hand-built per-key object
// literal rather than a spread, and omitting an optional property from an
// object literal is legal TypeScript — so a key missing from that literal is
// a feature that is 100% inert with a green build and a green suite.
//
// These cases mount the real `Editor.vue` with a real `config`, so they cross
// every hop: config → Editor.vue's literal → useEditorCore's provide →
// the components. Negative-checked by deleting the `templateSettings` line
// from that literal, which fails both.

async function mountRealEditor(config: Record<string, unknown>) {
  const translations = await loadTranslations("en");
  return mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content: createDefaultTemplateContent(),
        ...config,
      },
      translations,
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
}

describe("templateSettings reaches the panel through init's config", () => {
  it("hides the Language card for a real config that excludes locale and direction", async () => {
    const wrapper = await mountRealEditor({
      templateSettings: {
        fields: ALL_TEMPLATE_SETTINGS_FIELDS.filter(
          (f) => f !== "locale" && f !== "direction",
        ),
      },
    });
    // The Settings tab has to be opened first — the panel is `v-if`'d on it.
    await wrapper.find("#tpl-tab-settings").trigger("click");
    expect(
      wrapper.find('[data-testid="template-settings-card-language"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="template-settings-card-layout"]').exists(),
    ).toBe(true);
  });

  it("shows the direction toggle for a real config of width + direction", async () => {
    const wrapper = await mountRealEditor({
      templateSettings: { fields: ["width", "direction"] },
    });
    await wrapper.find("#tpl-tab-settings").trigger("click");
    expect(
      wrapper.find('[data-testid="template-settings-direction"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="template-settings-locale"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="template-settings-card-layout"]').exists(),
    ).toBe(true);
  });

  it("hides the whole Settings tab for a real config of `fields: false`", async () => {
    const wrapper = await mountRealEditor({
      templateSettings: { fields: false },
    });
    expect(wrapper.find("#tpl-tab-settings").exists()).toBe(false);
    expect(wrapper.find("#tpl-tab-content").exists()).toBe(true);
  });

  it("keeps every card for a real config that omits the key", async () => {
    const wrapper = await mountRealEditor({});
    await wrapper.find("#tpl-tab-settings").trigger("click");
    for (const card of CARDS) {
      expect(
        wrapper.find(`[data-testid="template-settings-card-${card}"]`).exists(),
        card,
      ).toBe(true);
    }
  });

  it("warns and skips an entry that is not a template setting", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const wrapper = await mountRealEditor({
      templateSettings: { fields: ["width", "colour"] },
    });
    await wrapper.find("#tpl-tab-settings").trigger("click");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(
      'config.templateSettings.fields: "colour" is not a template setting',
    );
    // The typo narrows the panel rather than restoring every setting.
    expect(
      wrapper.find('[data-testid="template-settings-card-layout"]').exists(),
    ).toBe(true);
    expect(
      wrapper
        .find('[data-testid="template-settings-card-appearance"]')
        .exists(),
    ).toBe(false);
    warn.mockRestore();
  });
});
