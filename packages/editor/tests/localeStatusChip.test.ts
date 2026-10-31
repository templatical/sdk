// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import {
  createMenuBlock,
  createParagraphBlock,
  createSectionBlock,
  applyOperations,
} from "@templatical/types";
import { openLanguages, languageContent } from "./helpers/localization";

const block = (id: string) => `[data-block-id="${id}"]`;
describe("locale status chips", () => {
  it("prunes an orphan whole-element override and still marks an absent optional object property", async () => {
    const content = languageContent();
    content.blocks = [
      createMenuBlock({
        id: "menu",
        items: [
          { id: "gone", text: "Gone", url: "https://example.com" },
          { id: "kept", text: "Kept", url: "https://example.com" },
        ],
      }),
    ];
    const localized = applyOperations(content, [
      {
        op: "updateBlockLocale",
        blockId: "menu",
        locale: "de",
        set: {
          "items.gone": {
            id: "gone",
            text: "Anders",
            url: "https://example.de",
          },
        },
      },
    ]);
    const { wrapper, editor } = await openLanguages({ content: localized });
    editor.setActiveLocale("de");
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="locale-chip"][data-state="missing"]')
        .exists(),
    ).toBe(true);
    editor.setActiveLocale(null);
    editor.updateBlock("menu", {
      items: [{ id: "kept", text: "Kept", url: "https://example.com" }],
    });
    expect(
      editor.content.value.blocks[0].l10n?.de.set?.["items.gone"],
    ).toBeUndefined();
    editor.setActiveLocale("de");
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="locale-chip"][data-state="changed"]')
        .exists(),
    ).toBe(false);
    editor.updateBlock("menu", {
      items: [{ id: "kept", text: "Behalten", url: "https://example.com" }],
    } as any);
    editor.updateBlock("menu", { color: "#123456" });
    await nextTick();
    expect(
      wrapper
        .get('[data-testid="locale-chip"][data-state="changed"]')
        .attributes("aria-label"),
    ).toContain("Changed in Deutsch");
    expect(editor.content.value.blocks[0]).not.toHaveProperty("color");
  });

  it("shows missing text and stale text with Keep updating the source hash", async () => {
    const { wrapper, editor } = await openLanguages();
    editor.setActiveLocale("de");
    await nextTick();
    expect(
      wrapper
        .get(
          `${block("image")} [data-testid="locale-chip"][data-state="missing"]`,
        )
        .attributes("aria-label"),
    ).toBe("Not translated");
    expect(
      wrapper
        .get(
          `${block("title")} [data-testid="locale-chip"][data-state="stale"]`,
        )
        .attributes("aria-label"),
    ).toContain("Out of date");
    await wrapper
      .get(`${block("title")} [data-testid="locale-chip"]`)
      .trigger("click");
    await wrapper.get('[data-testid="locale-keep"]').trigger("click");
    expect(
      wrapper.find('[data-testid="locale-chip"][data-state="stale"]').exists(),
    ).toBe(false);
    expect(editor.content.value.blocks[0].l10n?.de.text?.content.value).toBe(
      "Hallo",
    );
  });
  it("uses default only for stale paths and resets only set paths", async () => {
    const { wrapper, editor } = await openLanguages();
    editor.setActiveLocale("de");
    await nextTick();
    await wrapper
      .get(`${block("title")} [data-testid="locale-chip"]`)
      .trigger("click");
    expect(wrapper.get('[data-testid="locale-use-default"]').text()).toBe(
      "Use English",
    );
    await wrapper.get('[data-testid="locale-use-default"]').trigger("click");
    expect(editor.content.value.blocks[0].l10n?.de).toEqual({
      set: { color: "#123456" },
    });
    editor.updateBlock("title", { content: "Hallo" } as any);
    await nextTick();
    expect(
      wrapper
        .get(`${block("title")} [data-testid="locale-chip"]`)
        .attributes("aria-label"),
    ).toBe("Changed in Deutsch");
    await wrapper
      .get(`${block("title")} [data-testid="locale-chip"]`)
      .trigger("click");
    expect(wrapper.get('[data-testid="locale-reset"]').text()).toBe(
      "Reset changes",
    );
    await wrapper.get('[data-testid="locale-reset"]').trigger("click");
    expect(editor.content.value.blocks[0].l10n?.de.set).toBeUndefined();
    expect(editor.content.value.blocks[0].l10n?.de.text?.content.value).toBe(
      "Hallo",
    );
  });
  it("keeps hidden blocks as ghosts with Show and excludes them in preview", async () => {
    const { wrapper, editor } = await openLanguages();
    editor.setActiveLocale("de");
    editor.setBlockHidden("title", true);
    await nextTick();
    expect(wrapper.get(block("title")).classes()).toContain(
      "tpl-block--locale-hidden",
    );
    expect(
      wrapper
        .get('[data-testid="locale-chip"][data-state="hidden"]')
        .attributes("aria-label"),
    ).toContain("Hidden in Deutsch");
    editor.setPreviewMode(true);
    await nextTick();
    expect(wrapper.find(block("title")).exists()).toBe(false);
    editor.setPreviewMode(false);
    await nextTick();
    await wrapper
      .get(`${block("title")} [data-testid="locale-chip"]`)
      .trigger("click");
    expect(wrapper.get('[data-testid="locale-popover"]').text()).toContain(
      "This block isn't in the Deutsch email.",
    );
    await wrapper.get('[data-testid="locale-show"]').trigger("click");
    expect(editor.content.value.blocks[0].l10n?.de.hidden).toBeUndefined();
    expect(wrapper.get(block("title")).classes()).not.toContain(
      "tpl-block--locale-hidden",
    );
  });
  it("counts stale languages in the default view", async () => {
    const { wrapper } = await openLanguages();
    expect(
      wrapper
        .get('[data-testid="locale-chip"][data-state="default-stale"]')
        .attributes("aria-label"),
    ).toBe("Out of date in 1 language");
    expect(wrapper.find('[data-testid="locale-keep"]').exists()).toBe(false);
  });
  it("hides a block through the visibility control in a language view", async () => {
    const { wrapper, editor } = await openLanguages();
    editor.setActiveLocale("de");
    editor.selectBlock("title");
    await nextTick();
    await vi.dynamicImportSettled();
    await wrapper.get('[data-testid="locale-hide"]').trigger("click");
    expect(editor.content.value.blocks[0].l10n?.de.hidden).toBe(true);
    expect(editor.content.value.blocks[0].visibility).toBeUndefined();
  });
  it("does not mark fields whose element ids contain dots", async () => {
    const content = languageContent();
    content.blocks = [
      createMenuBlock({
        id: "menu",
        items: [{ id: "bad.id", text: "Hello", url: "" }] as any,
      }),
    ];
    content.blocks[0].l10n = { de: { set: { "items.bad.id.text": "Hallo" } } };
    const { wrapper, editor } = await openLanguages({ content });
    editor.setActiveLocale("de");
    await nextTick();
    // A normal missing field proves marker rendering has been implemented.
    editor.addBlock(languageContent().blocks[1]);
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="locale-chip"][data-state="missing"]')
        .exists(),
    ).toBe(true);
    expect(
      wrapper.get(block("menu")).find('[data-testid="locale-chip"]').exists(),
    ).toBe(false);
  });
});

describe("chip popovers", () => {
  it("opens with the badge's label when only the label carries the state or count", async () => {
    const content = languageContent();
    content.blocks[0].l10n!.fr = {
      text: { content: { value: "Bonjour", sourceHash: "old" } },
    };
    content.blocks.push(
      createMenuBlock({
        id: "menu",
        items: [
          { id: "a", text: "One", url: "" },
          { id: "b", text: "Two", url: "" },
        ],
      }),
      createMenuBlock({
        id: "stale-menu",
        items: [
          { id: "a", text: "One", url: "" },
          { id: "b", text: "Two", url: "" },
        ],
        l10n: {
          de: {
            text: {
              "items.a.text": { value: "Eins", sourceHash: "old" },
              "items.b.text": { value: "Zwei", sourceHash: "old" },
            },
          },
        },
      }),
    );
    const { wrapper, editor } = await openLanguages({ content });
    const firstLine = async (id: string) => {
      await wrapper
        .get(`${block(id)} [data-testid="locale-chip"]`)
        .trigger("click");
      const text = wrapper.get('[data-testid="locale-popover"] p').text();
      await wrapper
        .get('[data-testid="locale-popover"]')
        .trigger("keydown", { key: "Escape" });
      return text;
    };
    expect(await firstLine("title")).toBe("Out of date in 2 languages");
    editor.setActiveLocale("de");
    await nextTick();
    expect(await firstLine("menu")).toBe("2 not translated");
    expect(await firstLine("stale-menu")).toBe("2 out of date");
    // One field: the explanation already says what the badge means.
    expect(await firstLine("image")).toBe(
      "Not translated yet. The email shows the English text.",
    );
    expect(await firstLine("title")).toBe(
      "English changed since this was translated.",
    );
  });

  it("shows one chip with missing before stale before changed, counting fields", async () => {
    const content = languageContent();
    content.blocks = [
      createMenuBlock({
        id: "menu",
        items: [
          { id: "a", text: "One", url: "" },
          { id: "b", text: "Two", url: "" },
          { id: "c", text: "Three", url: "" },
        ],
        l10n: {
          de: {
            text: { "items.c.text": { value: "Drei", sourceHash: "old" } },
            set: { color: "#123456" },
          },
        },
      }),
    ];
    const { wrapper, editor } = await openLanguages({ content });
    editor.setActiveLocale("de");
    await nextTick();
    expect(wrapper.findAll('[data-testid="locale-chip"]')).toHaveLength(1);
    expect(
      wrapper.get('[data-testid="locale-chip"]').attributes("aria-label"),
    ).toBe("2 not translated");
    editor.updateBlock("menu", {
      items: [
        { id: "a", text: "Eins", url: "" },
        { id: "b", text: "Zwei", url: "" },
        { id: "c", text: "Drei", url: "" },
      ],
    } as any);
    await nextTick();
    expect(
      wrapper.get('[data-testid="locale-chip"]').attributes("data-state"),
    ).toBe("stale");
    editor.keepTranslations("menu", ["items.c.text"]);
    await nextTick();
    expect(
      wrapper.get('[data-testid="locale-chip"]').attributes("aria-label"),
    ).toBe("Changed in Deutsch");
    await wrapper.get('[data-testid="locale-chip"]').trigger("click");
    expect(wrapper.get('[data-testid="locale-popover"]').text()).toContain(
      "1 property differs from English.",
    );
  });

  it("shows the current default excerpt without its markup", async () => {
    const content = languageContent();
    content.blocks = [
      createParagraphBlock({
        id: "p",
        content:
          '<p>Hello <strong>world</strong>, <a href="#">see more</a></p>',
        l10n: {
          de: {
            text: { content: { value: "<p>Hallo</p>", sourceHash: "old" } },
          },
        },
      }),
    ];
    const { wrapper, editor } = await openLanguages({ content });
    editor.setActiveLocale("de");
    await nextTick();
    await wrapper.get('[data-testid="locale-chip"]').trigger("click");
    expect(wrapper.get('[data-testid="locale-popover"]').text()).toContain(
      "Now: “Hello world, see more”",
    );
  });

  it("counts stale fields, shows the current default excerpt capped at 60 characters, and keeps both", async () => {
    const content = languageContent();
    content.blocks = [
      createMenuBlock({
        id: "menu",
        items: [
          { id: "a", text: "A".repeat(70), url: "" },
          { id: "b", text: "Two", url: "" },
        ],
        l10n: {
          de: {
            text: {
              "items.a.text": { value: "Eins", sourceHash: "old" },
              "items.b.text": { value: "Zwei", sourceHash: "old" },
            },
          },
        },
      }),
    ];
    const { wrapper, editor, history } = await openLanguages({ content });
    editor.setActiveLocale("de");
    await nextTick();
    expect(
      wrapper.get('[data-testid="locale-chip"]').attributes("aria-label"),
    ).toBe("2 out of date");
    await wrapper.get('[data-testid="locale-chip"]').trigger("click");
    const popover = wrapper.get('[data-testid="locale-popover"]');
    expect(popover.text()).toContain(
      "English changed since this was translated.",
    );
    expect(popover.text()).toContain(`Now: “${"A".repeat(60)}”`);
    expect(popover.text()).not.toContain("A".repeat(61));
    await popover.get('[data-testid="locale-keep"]').trigger("click");
    expect(wrapper.find('[data-testid="locale-chip"]').exists()).toBe(false);
    history.undo();
    await nextTick();
    expect(
      wrapper.get('[data-testid="locale-chip"]').attributes("aria-label"),
    ).toBe("2 out of date");
  });

  it("explains missing text without a provider, opens on Enter and closes on Escape", async () => {
    const { wrapper, editor } = await openLanguages();
    editor.setActiveLocale("de");
    await nextTick();
    const chip = wrapper.get(`${block("image")} [data-testid="locale-chip"]`);
    expect(chip.attributes("aria-expanded")).toBe("false");
    await chip.trigger("keydown", { key: "Enter" });
    expect(wrapper.get('[data-testid="locale-popover"]').text()).toBe(
      "Not translated yet. The email shows the English text.",
    );
    expect(wrapper.find('[data-testid="locale-translate"]').exists()).toBe(
      false,
    );
    await wrapper
      .get('[data-testid="locale-popover"]')
      .trigger("keydown", { key: "Escape" });
    expect(wrapper.find('[data-testid="locale-popover"]').exists()).toBe(false);
    expect(chip.attributes("aria-expanded")).toBe("false");
  });

  it("lists stale languages once each and Open switches the view", async () => {
    const content = languageContent();
    content.blocks[0].l10n!.fr = {
      text: { content: { value: "Bonjour", sourceHash: "old" } },
    };
    const { wrapper, editor } = await openLanguages({ content });
    expect(
      wrapper.get('[data-testid="locale-chip"]').attributes("aria-label"),
    ).toBe("Out of date in 2 languages");
    await wrapper.get('[data-testid="locale-chip"]').trigger("click");
    const popover = wrapper.get('[data-testid="locale-popover"]');
    expect(popover.text()).toContain("Deutsch");
    expect(popover.text()).toContain("Français");
    const open = popover.findAll("button").filter((b) => b.text() === "Open");
    expect(open).toHaveLength(2);
    await open[0].trigger("click");
    expect(editor.activeLocale.value).toBe("de");
    expect(wrapper.find('[data-testid="locale-popover"]').exists()).toBe(false);
  });

  it("keeps the chip out of flow and removes it and its popover in preview", async () => {
    const { wrapper, editor } = await openLanguages();
    const chip = wrapper.get('[data-testid="locale-chip"]');
    expect(chip.element.parentElement!.classList).toContain("tpl:absolute");
    await chip.trigger("click");
    expect(wrapper.find('[data-testid="locale-popover"]').exists()).toBe(true);
    editor.setPreviewMode(true);
    await nextTick();
    expect(wrapper.find('[data-testid="locale-chip"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="locale-popover"]').exists()).toBe(false);
  });

  it("keeps explanations readable but offers no mutation in a disabled language", async () => {
    const { wrapper, editor } = await openLanguages({
      localization: { locales: ["nl"] },
    });
    editor.setActiveLocale("de");
    await nextTick();
    await wrapper
      .get(`${block("title")} [data-testid="locale-chip"]`)
      .trigger("click");
    expect(wrapper.get('[data-testid="locale-popover"]').text()).toContain(
      "English changed since this was translated.",
    );
    for (const id of [
      "locale-keep",
      "locale-use-default",
      "locale-retranslate",
    ]) {
      expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(false);
    }
  });
});

describe("chip isolation", () => {
  it("teleports into the editor root, retains state across projected objects, and closes outside", async () => {
    const { mountEditor } = await import("./helpers/mount");
    const { ref } = await import("vue");
    const { EDITOR_KEY, POPOVER_ROOT_KEY } = await import("../src/keys");
    const { default: LocaleStatusChip } =
      await import("../src/components/localization/LocaleStatusChip.vue");
    const target = document.createElement("div");
    target.className = "tpl-popover-root";
    document.body.append(target);
    const editor = {
      activeLocale: ref("de"),
      content: ref(languageContent()),
      state: { template: { id: "one" } },
    };
    const wrapper = mountEditor(LocaleStatusChip, {
      attachTo: document.body,
      props: {
        blockId: "title",
        state: "stale",
        count: 1,
        stale: ["content"],
        setPaths: [],
        staleLocales: [],
        excerpt: "Hello",
        eligibleGaps: false,
        editable: false,
      },
      provides: { [EDITOR_KEY]: editor, [POPOVER_ROOT_KEY]: ref(target) },
    });
    try {
      await wrapper.get('[data-testid="locale-chip"]').trigger("click");
      expect(wrapper.find('[data-testid="locale-popover"]').exists()).toBe(
        false,
      );
      expect(
        target.querySelector('[data-testid="locale-popover"]'),
      ).not.toBeNull();
      await wrapper.setProps({
        stale: ["content"],
        setPaths: [],
        staleLocales: [],
      });
      expect(
        target.querySelector('[data-testid="locale-popover"]'),
      ).not.toBeNull();
      document.body.click();
      await nextTick();
      expect(target.querySelector('[data-testid="locale-popover"]')).toBeNull();
    } finally {
      wrapper.unmount();
      target.remove();
    }
  });

  it("scopes coverage and eligible strings to this block, excluding descendants and settings", async () => {
    const types = await import("@templatical/types");
    const { mountEditor } = await import("./helpers/mount");
    const { ref } = await import("vue");
    const { EDITOR_KEY, LOCALIZATION_KEY, TRANSLATIONS_KEY } =
      await import("../src/keys");
    const { default: en } = await import("../src/i18n/locales/en");
    const { default: LocaleMarkers } =
      await import("../src/components/localization/LocaleMarkers.vue");
    const content = languageContent();
    content.settings.preheaderText = "Settings must not be scanned";
    const coverage = vi.spyOn(types, "localeCoverage");
    const strings = vi.spyOn(types, "localeStrings");
    const wrapper = mountEditor(LocaleMarkers, {
      props: { block: content.blocks[0] },
      provides: {
        [EDITOR_KEY]: {
          activeLocale: ref("de"),
          content: ref(content),
          state: { template: null },
        },
        [LOCALIZATION_KEY]: { locales: ["de"] },
        [TRANSLATIONS_KEY]: en,
      },
    });
    try {
      expect(
        wrapper.get('[data-testid="locale-chip"]').attributes("data-state"),
      ).toBe("stale");
      expect(coverage.mock.calls.length).toBeGreaterThan(0);
      expect(strings.mock.calls.length).toBeGreaterThan(0);
      for (const [scoped] of [...coverage.mock.calls, ...strings.mock.calls]) {
        expect(scoped.blocks.map((b) => b.id)).toEqual(["title"]);
        expect(scoped.settings.preheaderText).toBeUndefined();
      }
      const section = types.createSectionBlock({
        id: "section",
        children: [[content.blocks[1]]],
      });
      coverage.mockClear();
      strings.mockClear();
      await wrapper.setProps({ block: section });
      expect(wrapper.find('[data-testid="locale-chip"]').exists()).toBe(false);
      for (const [scoped] of coverage.mock.calls)
        expect((scoped.blocks[0] as any).children).toEqual([]);
    } finally {
      wrapper.unmount();
      coverage.mockRestore();
      strings.mockRestore();
    }
  });
});

describe("ancestor-hidden languages", () => {
  it.each(["missing", "stale"])(
    "suppresses a %s child's chip and translation actions inside a hidden section",
    async (state) => {
      const content = languageContent();
      const child = createParagraphBlock({
        id: "child",
        content: "Hello",
        ...(state === "stale"
          ? {
              l10n: {
                de: {
                  text: { content: { value: "Hallo", sourceHash: "00000000" } },
                },
              },
            }
          : {}),
      });
      content.blocks = [
        createSectionBlock({
          id: "section",
          children: [[child]],
          l10n: { de: { hidden: true } },
        }),
      ];
      const { wrapper, editor } = await openLanguages({
        content,
        translation: { translate: async () => ({ fields: [] }) },
      });
      editor.setActiveLocale("de");
      await nextTick();
      const descendant = wrapper.get(block("child"));
      expect(descendant.find('[data-testid="locale-chip"]').exists()).toBe(
        false,
      );
      expect(descendant.find('[data-testid="locale-translate"]').exists()).toBe(
        false,
      );
      expect(
        descendant.find('[data-testid="locale-retranslate"]').exists(),
      ).toBe(false);
      expect(
        wrapper
          .get(
            `${block("section")} > .tpl-block-badges > [data-testid="locale-chip"]`,
          )
          .attributes("data-state"),
      ).toBe("hidden");
      editor.setBlockHidden("section", false);
      await nextTick();
      expect(
        descendant.get('[data-testid="locale-chip"]').attributes("data-state"),
      ).toBe(state);
      await descendant.get('[data-testid="locale-chip"]').trigger("click");
      expect(
        wrapper
          .get(
            `[data-testid="${state === "missing" ? "locale-translate" : "locale-retranslate"}"]`,
          )
          .text(),
      ).toBe(state === "missing" ? "Translate" : "Re-translate");
      editor.setBlockHidden("section", true);
      await nextTick();
      expect(descendant.find('[data-testid="locale-chip"]').exists()).toBe(
        false,
      );
      expect(wrapper.find('[data-testid="locale-popover"]').exists()).toBe(
        false,
      );
    },
  );

  it("excludes an ancestor-hidden language from a stale child's default-view list", async () => {
    const content = languageContent();
    content.blocks = [
      createSectionBlock({
        id: "section",
        l10n: { de: { hidden: true } },
        children: [
          [
            createParagraphBlock({
              id: "child",
              content: "Hello",
              l10n: {
                de: {
                  text: { content: { value: "Hallo", sourceHash: "00000000" } },
                },
                fr: {
                  text: {
                    content: { value: "Bonjour", sourceHash: "00000000" },
                  },
                },
              },
            }),
          ],
        ],
      }),
    ];
    const { wrapper, editor } = await openLanguages({ content });
    const chip = wrapper.get(`${block("child")} [data-testid="locale-chip"]`);
    expect(chip.attributes("aria-label")).toBe("Out of date in 1 language");
    await chip.trigger("click");
    const popover = wrapper.get('[data-testid="locale-popover"]');
    expect(popover.text()).toContain("Français");
    expect(popover.text()).not.toContain("Deutsch");
    editor.setActiveLocale("de");
    editor.setBlockHidden("section", false);
    editor.setActiveLocale(null);
    await nextTick();
    expect(chip.attributes("aria-label")).toBe("Out of date in 2 languages");
  });
});

describe("loaded nested hidden sections", () => {
  it.each([
    ["missing", 2],
    ["stale", 2],
    ["missing", 3],
    ["stale", 3],
  ] as const)(
    "keeps a %s descendant suppressed through Show/re-hide at depth %s",
    async (state, depth) => {
      const content = languageContent();
      const child = createParagraphBlock({
        id: "nested-child",
        content: "Hello",
        l10n: {
          ...(state === "stale"
            ? {
                de: {
                  text: { content: { value: "Hallo", sourceHash: "00000000" } },
                },
              }
            : {}),
          fr: {
            text: { content: { value: "Bonjour", sourceHash: "00000000" } },
          },
        },
      });
      let section = createSectionBlock({
        id: "inner",
        children: [[child]],
        l10n: { de: { hidden: true } },
      });
      if (depth === 3)
        section = createSectionBlock({ id: "middle", children: [[section]] });
      content.blocks = [
        createSectionBlock({
          id: "outer",
          children: [[section]],
          l10n: { fr: { hidden: true } },
        }),
      ];
      const { wrapper, editor } = await openLanguages({
        content,
        translation: { translate: async () => ({ fields: [] }) },
      });
      editor.setActiveLocale("de");
      await nextTick();
      const descendant = wrapper.get(block("nested-child"));
      expect(descendant.find('[data-testid="locale-chip"]').exists()).toBe(
        false,
      );
      expect(wrapper.get(block("outer")).classes()).not.toContain(
        "tpl-block--locale-hidden",
      );
      const hidden = wrapper.get(
        `${block("inner")} > .tpl-block-badges > [data-testid="locale-chip"]`,
      );
      expect(hidden.attributes("data-state")).toBe("hidden");
      await hidden.trigger("click");
      await wrapper.get('[data-testid="locale-show"]').trigger("click");
      expect(
        descendant.get('[data-testid="locale-chip"]').attributes("data-state"),
      ).toBe(state);
      await descendant.get('[data-testid="locale-chip"]').trigger("click");
      expect(
        wrapper
          .get(
            `[data-testid="${state === "missing" ? "locale-translate" : "locale-retranslate"}"]`,
          )
          .text(),
      ).toBe(state === "missing" ? "Translate" : "Re-translate");
      editor.setBlockHidden("inner", true);
      await nextTick();
      expect(descendant.find('[data-testid="locale-chip"]').exists()).toBe(
        false,
      );
      expect(wrapper.find('[data-testid="locale-popover"]').exists()).toBe(
        false,
      );
      editor.setActiveLocale(null);
      await nextTick();
      // German is hidden by the inner section, French by the outer one.
      expect(descendant.find('[data-testid="locale-chip"]').exists()).toBe(
        false,
      );
      editor.setActiveLocale("de");
      await nextTick();
      expect(descendant.find('[data-testid="locale-chip"]').exists()).toBe(
        false,
      );
    },
  );
});
