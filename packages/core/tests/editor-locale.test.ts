import { describe, expect, it, vi } from "vitest";
import { ref } from "@vue/reactivity";
import {
  applyOperations,
  createDefaultTemplateContent,
  createTitleBlock,
  createImageBlock,
  createMenuBlock,
  createTableBlock,
  createSectionBlock,
  createCustomBlock,
  localizeBlock,
  safeClone,
  sourceHash,
  type Block,
  type CustomBlock,
  type CustomBlockDefinition,
  type Template,
} from "@templatical/types";
import { useBlockActions } from "../src/block-actions";
import { useEditor } from "../src/editor";
import { useHistory } from "../src/history";
import { diffContent } from "../src/diff-content";
import { validateTemplate } from "../../template-tools/src/validate";
import { useHistoryInterceptor } from "../src/history-interceptor";

function setup(locales?: string[]) {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.blocks = [
    createTitleBlock({ id: "t1", content: "<p>Hello</p>" }),
    createImageBlock({ id: "im1", src: "en.png" }),
  ];
  const onLocaleChange = vi.fn();
  const editor = useEditor({
    content,
    localization: locales ? { locales } : undefined,
    onLocaleChange,
  });
  const history = useHistory({
    content: editor.content,
    setContent: editor.setContent,
  });
  useHistoryInterceptor(editor, history);
  return { editor, history, onLocaleChange };
}

function german() {
  const result = setup();
  result.editor.addLocale("de");
  result.editor.setActiveLocale("de");
  result.history.clear();
  return result;
}

describe("editor language routing", () => {
  it("removes a deleted ancestor override after resetting both leaves in reverse order", () => {
    const { editor, history } = setup();
    editor.updateBlock("im1", {
      visibility: { desktop: false, mobile: false },
    });
    editor.addLocale("de");
    editor.setActiveLocale("de");
    editor.updateBlock("im1", { visibility: undefined });
    expect(editor.content.value.blocks[1].l10n?.de.set).toEqual({
      visibility: null,
    });
    history.clear();

    editor.resetLocaleFields("im1", [
      "visibility.mobile",
      "visibility.desktop",
    ]);

    expect(editor.content.value.blocks[1].l10n).toBeUndefined();
    history.undo();
    expect(editor.content.value.blocks[1].l10n?.de.set).toEqual({
      visibility: null,
    });
    expect(history.canUndo.value).toBe(false);
    history.redo();
    expect(editor.content.value.blocks[1].l10n).toBeUndefined();
    editor.setActiveLocale(null);
    editor.updateBlock("im1", {
      visibility: { desktop: true, mobile: true },
    });
    editor.setActiveLocale("de");
    expect(
      localizeBlock(editor.content.value.blocks[1], "de", "en").visibility,
    ).toEqual({
      desktop: true,
      mobile: true,
    });
  });

  it("does not override a re-entered custom object with reordered nested keys", () => {
    const { editor } = german();
    const block = createCustomBlock({
      type: "card",
      name: "Card",
      fields: [],
      template: "<mj-text>Card</mj-text>",
    });
    block.id = "card";
    block.fieldValues = {
      card: { title: "Offer", links: [{ label: "Read", url: "/read" }] },
    };
    editor.addBlock(block);

    editor.updateBlock("card", {
      fieldValues: {
        card: { links: [{ url: "/read", label: "Read" }], title: "Offer" },
      },
    });

    expect(editor.content.value.blocks[2].l10n).toBeUndefined();
    expect(editor.content.value.blocks[2]).toMatchObject({
      fieldValues: {
        card: { title: "Offer", links: [{ label: "Read", url: "/read" }] },
      },
    });
  });

  it("resets a leaf inside a deleted locale ancestor without restoring its sibling", () => {
    const { editor, history } = setup();
    editor.updateBlock("im1", {
      visibility: { desktop: false, mobile: false },
    });
    editor.addLocale("de");
    editor.setActiveLocale("de");
    editor.updateBlock("im1", { visibility: undefined });
    expect(editor.content.value.blocks[1].l10n?.de.set).toEqual({
      visibility: null,
    });
    history.clear();

    editor.resetLocaleFields("im1", ["visibility.mobile"]);

    const block = editor.content.value.blocks[1];
    expect(block.l10n?.de.set).toEqual({ visibility: { mobile: false } });
    expect(localizeBlock(block, "de", "en").visibility).toEqual({
      mobile: false,
    });
    expect(block.visibility).toEqual({ desktop: false, mobile: false });
    history.undo();
    expect(editor.content.value.blocks[1].l10n?.de.set).toEqual({
      visibility: null,
    });
    expect(history.canUndo.value).toBe(false);
  });

  it("resets a nested locale field without removing its sibling override and supports undo", () => {
    const { editor, history } = german();
    editor.updateBlock("im1", {
      visibility: { desktop: false, mobile: false },
    });
    history.clear();
    editor.resetLocaleFields("im1", ["visibility.mobile"]);
    expect(editor.content.value.blocks[1].l10n?.de.set).toEqual({
      visibility: { desktop: false },
    });
    history.undo();
    expect(editor.content.value.blocks[1].l10n?.de.set).toEqual({
      visibility: { desktop: false, mobile: false },
    });
    expect(history.canUndo.value).toBe(false);
    history.redo();
    editor.resetLocaleFields("im1", ["visibility.desktop"]);
    expect(editor.content.value.blocks[1].l10n).toBeUndefined();
  });

  it("adds a version and routes text and src without changing the base", () => {
    const { editor } = german();
    editor.updateBlock("t1", { content: "<p>Hallo</p>" });
    editor.updateBlock("im1", { src: "de.png" });
    expect(editor.content.value.settings.locales).toEqual(["de"]);
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hello</p>",
      l10n: {
        de: {
          text: {
            content: {
              value: "<p>Hallo</p>",
              source: sourceHash("<p>Hello</p>"),
            },
          },
        },
      },
    });
    expect(editor.content.value.blocks[1]).toMatchObject({
      src: "en.png",
      l10n: { de: { set: { src: "de.png" } } },
    });
  });

  it("routes settings text and direction and refuses a new default while versions exist", () => {
    const { editor } = german();
    editor.updateSettings({ preheaderText: "Vorschau", direction: "rtl" });
    expect(editor.content.value.settings).toMatchObject({
      locale: "en",
      l10n: {
        de: {
          set: { preheaderText: "Vorschau", direction: "rtl" },
        },
      },
    });
    expect(() => editor.updateSettings({ locale: "fr" })).toThrow();
    editor.setActiveLocale(null);
    expect(() => editor.updateSettings({ locale: "fr" })).toThrow();
  });

  it("keeps existing menu base values when adding, reordering and deleting items", () => {
    const { editor } = german();
    editor.addBlock(
      createMenuBlock({
        id: "m1",
        items: [
          { id: "i1", text: "Home", url: "/en" },
          { id: "i2", text: "About", url: "/about" },
        ],
        l10n: {
          de: {
            text: {
              "items.i1.text": { value: "Start", source: sourceHash("Home") },
            },
          },
        },
      }),
    );
    editor.updateBlock("m1", {
      items: [
        { id: "i2", text: "Über", url: "/about" },
        { id: "i1", text: "Start", url: "/en" },
        { id: "i3", text: "Neu", url: "/new" },
      ],
    });
    const menu = editor.content.value.blocks[2];
    expect(menu).toMatchObject({
      items: [
        { id: "i2", text: "About" },
        { id: "i1", text: "Home" },
        { id: "i3", text: "Neu" },
      ],
    });
    editor.updateBlock("m1", {
      items: [{ id: "i3", text: "Neu", url: "/new" }],
    });
    expect(menu.l10n).toBeUndefined();
  });

  it("keeps custom text translatable through registered definitions", () => {
    const { editor } = german();
    editor.setCustomBlockDefinitions([
      { type: "card", fields: [{ key: "headline", type: "text" }] },
    ] as any);
    editor.addBlock({
      id: "c1",
      type: "custom",
      customType: "card",
      fieldValues: { headline: "Hello" },
    } as Block);
    editor.updateBlock("c1", { fieldValues: { headline: "Hallo" } });
    expect(editor.content.value.blocks[2].l10n).toEqual({
      de: {
        text: {
          "fieldValues.headline": {
            value: "Hallo",
            source: sourceHash("Hello"),
          },
        },
      },
    });
  });

  it.each(["field reset", "typing the default"])(
    "keeps custom render caches out of German edits and restores fallback after %s",
    (reset) => {
      const { editor } = german();
      const definition: CustomBlockDefinition = {
        type: "greeting",
        name: "Greeting",
        fields: [
          {
            key: "headline",
            label: "Headline",
            type: "text",
            default: "Hello",
          },
        ],
        template: "<p>{{ headline }}</p>",
        stylesheet: ".greeting { color: red; }",
      };
      const block = createCustomBlock(definition);
      block.id = "greeting";
      block.renderedHtml = "<p>Hello</p>";
      block.renderedStylesheet = definition.stylesheet;
      editor.setCustomBlockDefinitions([definition]);
      editor.addBlock(block);
      const current = () => editor.content.value.blocks[2] as CustomBlock;

      for (const headline of ["Hallo", "Guten Tag"]) {
        editor.updateBlock("greeting", { fieldValues: { headline } });
        expect.soft(current().l10n?.de).toEqual({
          text: {
            "fieldValues.headline": {
              value: headline,
              source: sourceHash("Hello"),
            },
          },
        });
        const projected = localizeBlock(current(), "de", "en") as CustomBlock;
        expect.soft(projected).not.toHaveProperty("renderedHtml");
        expect
          .soft(projected.renderedStylesheet)
          .toBe(".greeting { color: red; }");
      }

      if (reset === "field reset")
        editor.resetLocaleFields("greeting", ["fieldValues.headline"]);
      else
        editor.updateBlock("greeting", { fieldValues: { headline: "Hello" } });

      expect.soft(current()).not.toHaveProperty("l10n");
      expect.soft(localizeBlock(current(), "de", "en")).toMatchObject({
        fieldValues: { headline: "Hello" },
        renderedHtml: "<p>Hello</p>",
        renderedStylesheet: ".greeting { color: red; }",
      });
      expect(current().fieldValues).toEqual({ headline: "Hello" });
      expect(current().renderedHtml).toBe("<p>Hello</p>");
    },
  );

  it("hides, keeps stale translations and resets specific fields or the whole layer", () => {
    const { editor } = german();
    editor.updateBlock("t1", { content: "<p>Hallo</p>" });
    editor.setBlockHidden("t1", true);
    editor.setActiveLocale(null);
    editor.updateBlock("t1", { content: "<p>Changed</p>" });
    editor.setActiveLocale("de");
    editor.keepTranslations("t1", ["content"]);
    expect(editor.content.value.blocks[0].l10n?.de).toEqual({
      hidden: true,
      text: {
        content: {
          value: "<p>Hallo</p>",
          source: sourceHash("<p>Changed</p>"),
        },
      },
    });
    editor.resetLocaleFields("t1", ["content"]);
    expect(editor.content.value.blocks[0].l10n?.de).toEqual({ hidden: true });
    editor.resetLocaleFields("t1");
    expect(editor.content.value.blocks[0].l10n).toBeUndefined();
  });

  it.each([
    "addLocale",
    "removeLocale",
    "setBlockHidden",
    "resetLocaleFields",
    "keepTranslations",
  ] as const)("%s is exactly one snapshot undo step", (method) => {
    const { editor, history } = german();
    editor.updateBlock("t1", { content: "<p>Hallo</p>" });
    editor.setBlockHidden("t1", true);
    editor.setActiveLocale(null);
    editor.updateBlock("t1", { content: "<p>Changed</p>" });
    editor.setActiveLocale("de");
    history.clear();
    const before = safeClone(editor.content.value);
    if (method === "addLocale") editor.addLocale("fr");
    if (method === "removeLocale") editor.removeLocale("de");
    if (method === "setBlockHidden") editor.setBlockHidden("t1", false);
    if (method === "resetLocaleFields") editor.resetLocaleFields("t1");
    if (method === "keepTranslations")
      editor.keepTranslations("t1", ["content"]);
    expect(editor.content.value).not.toEqual(before);
    history.undo();
    expect(editor.content.value).toEqual(before);
    expect(history.canUndo.value).toBe(false);
    history.destroy();
  });

  it("removes every nested and settings layer, falling back to default", () => {
    const { editor, onLocaleChange } = german();
    editor.updateBlock("t1", { content: "<p>Hallo</p>" });
    editor.updateSettings({ preheaderText: "Hallo" });
    editor.addBlock(
      createSectionBlock({
        id: "s1",
        children: [[createTitleBlock({ l10n: { de: { hidden: true } } })]],
      }),
    );
    editor.removeLocale("de");
    expect(JSON.stringify(editor.content.value)).not.toContain("l10n");
    expect(editor.content.value.settings.locales).toBeUndefined();
    expect(editor.activeLocale.value).toBeNull();
    expect(onLocaleChange).toHaveBeenLastCalledWith("en");
  });

  it("falls back after setContent, a remote removal and undo of addLocale", () => {
    const { editor, history, onLocaleChange } = german();
    editor.setContent(
      applyOperations(editor.content.value, [
        { op: "removeLocale", locale: "de" },
      ]),
    );
    expect(editor.activeLocale.value).toBeNull();
    editor.addLocale("de");
    editor.setActiveLocale("de");
    history.undo();
    expect(editor.activeLocale.value).toBeNull();
    editor.addLocale("de");
    editor.setActiveLocale("de");
    editor.setContent(createDefaultTemplateContent());
    expect(editor.activeLocale.value).toBeNull();
    expect(
      onLocaleChange.mock.calls.filter(([locale]) => locale === "en"),
    ).toHaveLength(3);
  });

  it("falls back when a provider load replaces the available versions", async () => {
    const content = createDefaultTemplateContent();
    content.settings.locales = ["de"];
    const editor = useEditor({
      content,
      templates: {
        load: async () =>
          ({
            id: "other",
            content: createDefaultTemplateContent(),
          }) as Template,
      } as any,
    });
    editor.setActiveLocale("de");
    await editor.load("other");
    expect(editor.activeLocale.value).toBeNull();
  });

  it("does not coalesce typing across language switches", () => {
    const { editor, history } = german();
    editor.updateBlock("t1", { content: "<p>Hallo</p>" });
    editor.setActiveLocale(null);
    editor.updateBlock("t1", { content: "<p>Changed</p>" });
    history.undo();
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hello</p>",
      l10n: { de: { text: { content: { value: "<p>Hallo</p>" } } } },
    });
    history.undo();
    expect(editor.content.value.blocks[0].l10n).toBeUndefined();
  });

  it("makes disabled versions read-only at every mutation boundary", () => {
    const { editor } = setup(["fr"]);
    const content = safeClone(editor.content.value);
    content.settings.locales = ["de"];
    editor.setContent(content);
    editor.setActiveLocale("de");
    const before = safeClone(editor.content.value);
    editor.updateBlock("t1", { content: "no" });
    editor.updateSettings({ width: 700 });
    editor.setBlockHidden("t1", true);
    editor.resetLocaleFields("t1");
    editor.keepTranslations("t1", ["content"]);
    editor.addBlock(createTitleBlock());
    editor.removeBlock("t1");
    editor.moveBlock("t1", 1);
    expect(editor.content.value).toEqual(before);
  });

  it("uses active language locks for local edits and every lock for item structure", () => {
    const content = createDefaultTemplateContent();
    content.settings.locales = ["de", "fr"];
    content.blocks = [
      createMenuBlock({
        id: "m1",
        items: [{ id: "i1", text: "Home", url: "/" }],
      }),
    ];
    const editor = useEditor({
      content,
      lockedBlocks: ref(
        new Map([
          [
            "fr",
            { blockId: "m1", locale: "fr", holder: { sessionId: "peer" } },
          ],
        ]),
      ),
    });
    editor.setActiveLocale("de");
    editor.updateBlock("m1", {
      items: [{ id: "i1", text: "Start", url: "/" }],
    });
    expect(
      editor.content.value.blocks[0].l10n?.de?.text?.["items.i1.text"]?.value,
    ).toBe("Start");
    editor.updateBlock("m1", {
      items: [
        { id: "i1", text: "Start", url: "/" },
        { id: "i2", text: "New", url: "/" },
      ],
    });
    expect((editor.content.value.blocks[0] as any).items).toHaveLength(1);
  });

  it.each(["drag", "resize", "cross-section"])(
    "routes %s to base children while preserving moved blocks and layers",
    (kind) => {
      const { editor } = german();
      const child = createTitleBlock({
        id: "child",
        content: "Base",
        l10n: {
          de: {
            text: { content: { value: "Deutsch", source: sourceHash("Base") } },
          },
        },
      });
      editor.addBlock(
        createSectionBlock({ id: "s1", columns: "2", children: [[child], []] }),
      );
      editor.addBlock(createSectionBlock({ id: "s2", children: [[]] }));
      if (kind === "drag")
        editor.updateBlock("s1", {
          children: [[], [localizeBlock(child, "de", "en")]],
        });
      if (kind === "resize")
        editor.updateBlock("s1", {
          columns: "1",
          children: [[localizeBlock(child, "de", "en")]],
        });
      if (kind === "cross-section") editor.moveBlock("child", 0, "s2", 0);
      const sections = editor.content.value.blocks.filter(
        (block) => block.type === "section",
      );
      const moved = sections
        .flatMap((block) => block.children.flat())
        .find((block) => block.id === "child");
      expect(moved).toEqual(child);
      expect(sections.every((block) => block.l10n === undefined)).toBe(true);
    },
  );
});

describe("locale routing regressions", () => {
  it.each([false, true])(
    "keeps custom repeatables local even with entry ids: %s",
    (withIds) => {
      const { editor } = german();
      const items = [{ ...(withIds ? { id: "one" } : {}), text: "First" }];
      const block = {
        id: "repeat",
        type: "custom",
        customType: "list",
        fieldValues: { items },
      } as Block;
      editor.addBlock(block);
      const before = JSON.stringify(block);
      const next = [
        ...items,
        { ...(withIds ? { id: "two" } : {}), text: "Zweiter" },
      ];
      editor.updateBlock("repeat", { fieldValues: { items: next } });
      const { l10n, ...base } = editor.content.value.blocks[2];
      expect(JSON.stringify(base)).toBe(before);
      expect(l10n).toEqual({ de: { set: { "fieldValues.items": next } } });
    },
  );
});

it("routes absent preheader as set and existing preheader as text through validation and collaboration", () => {
  const { editor } = german();
  const before = safeClone(editor.content.value);
  editor.updateSettings({ preheaderText: "Vorschau" });
  expect(editor.content.value.settings.l10n?.de).toEqual({
    set: { preheaderText: "Vorschau" },
  });
  expect(validateTemplate(editor.content.value)).toEqual({
    valid: true,
    errors: [],
  });
  expect(
    applyOperations(before, diffContent(before, editor.content.value)),
  ).toEqual(editor.content.value);
  editor.setActiveLocale(null);
  editor.updateSettings({ preheaderText: "Preview" });
  editor.setActiveLocale("de");
  const withSource = safeClone(editor.content.value);
  editor.updateSettings({ preheaderText: "Neue Vorschau" });
  expect(editor.content.value.settings.l10n?.de).toEqual({
    text: {
      preheaderText: { value: "Neue Vorschau", source: sourceHash("Preview") },
    },
  });
  expect(validateTemplate(editor.content.value)).toEqual({
    valid: true,
    errors: [],
  });
  expect(
    applyOperations(withSource, diffContent(withSource, editor.content.value)),
  ).toEqual(editor.content.value);
});

it.each(["menu item", "table row", "table cell"])(
  "keeps dotted-id %s text in the base in every language",
  (kind) => {
    const { editor } = german();
    const block =
      kind === "menu item"
        ? createMenuBlock({
            id: "dotted",
            items: [
              {
                id: "a.b",
                text: "Home",
                url: "/",
                openInNewTab: false,
                bold: false,
                underline: false,
              },
            ],
          })
        : createTableBlock({
            id: "dotted",
            rows: [
              {
                id: kind === "table row" ? "a.b" : "row",
                cells: [
                  {
                    id: kind === "table cell" ? "a.b" : "cell",
                    content: "Home",
                  },
                ],
              },
            ],
          });
    const base = safeClone(block);
    editor.addBlock(block);
    const view = safeClone(block);
    if (view.type === "menu") view.items[0].text = "Start";
    if (view.type === "table") view.rows[0].cells[0].content = "Start";
    editor.updateBlock("dotted", view);
    const saved = editor.content.value.blocks.find((b) => b.id === "dotted")!;
    expect(saved).toEqual(base);
    expect(localizeBlock(saved, "en", "en")).toEqual(base);
    expect(localizeBlock(saved, "de", "en")).toEqual(base);
    expect(validateTemplate(editor.content.value).valid).toBe(true);
  },
);

describe("locale mutation history eligibility", () => {
  it.each(["default", "missing", "disabled", "already reset"])(
    "preserves undo and redo when reset is refused or unchanged: %s",
    (reason) => {
      const { editor, history } = setup(
        reason === "disabled" ? ["fr"] : undefined,
      );
      if (reason === "disabled")
        editor.setContent(
          {
            ...editor.content.value,
            settings: { ...editor.content.value.settings, locales: ["de"] },
          },
          false,
        );
      else editor.addLocale("de");
      editor.updateBlock("t1", { content: "Base edit" });
      editor.updateSettings({ width: 700 });
      history.undo();
      if (reason !== "default") editor.setActiveLocale("de");
      const before = safeClone(editor.content.value);
      const record = vi.spyOn(history, "record");
      expect(history.canUndo.value).toBe(true);
      expect(history.canRedo.value).toBe(true);
      editor.resetLocaleFields(reason === "missing" ? "missing" : "t1");
      expect(record).not.toHaveBeenCalled();
      expect(editor.content.value).toEqual(before);
      expect(history.canUndo.value).toBe(true);
      expect(history.canRedo.value).toBe(true);
      history.redo();
      expect(editor.content.value.settings.width).toBe(700);
      history.undo();
      history.undo();
      expect((editor.content.value.blocks[0] as any).content).toBe(
        "<p>Hello</p>",
      );
      history.destroy();
    },
  );

  it.each(["setBlockHidden", "keepTranslations", "resetLocaleFields"] as const)(
    "does not record unchanged %s calls",
    (method) => {
      const { editor, history } = german();
      const before = safeClone(editor.content.value);
      if (method === "setBlockHidden") editor.setBlockHidden("t1", false);
      if (method === "keepTranslations")
        editor.keepTranslations("t1", ["content"]);
      if (method === "resetLocaleFields")
        editor.resetLocaleFields("t1", ["content"]);
      expect(editor.content.value).toEqual(before);
      expect(history.canUndo.value).toBe(false);
      expect(history.canRedo.value).toBe(false);
      history.destroy();
    },
  );

  it("leaves history untouched for every disabled-language mutator", () => {
    const { editor, history } = setup(["fr"]);
    editor.setContent(
      {
        ...editor.content.value,
        settings: { ...editor.content.value.settings, locales: ["de"] },
      },
      false,
    );
    editor.setActiveLocale("de");
    history.clear();
    const before = safeClone(editor.content.value);
    editor.addLocale("fr");
    editor.removeLocale("de");
    editor.setBlockHidden("t1", true);
    editor.keepTranslations("t1", ["content"]);
    editor.resetLocaleFields("t1");
    editor.updateBlock("t1", { content: "Ignored" });
    editor.updateSettings({ width: 800 });
    editor.addBlock(createTitleBlock({ id: "ignored" }));
    editor.removeBlock("t1");
    editor.moveBlock("t1", 1);
    expect(editor.content.value).toEqual(before);
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(false);
    history.destroy();
  });
});

describe("structural history eligibility", () => {
  it.each(["removeBlock", "moveBlock", "addBlock", "duplicateBlock"] as const)(
    "%s refusals preserve content, dirty state, undo and redo",
    async (method) => {
      const reasons =
        method === "duplicateBlock"
          ? ["missing", "readonly", "foreign lock", "locked section"]
          : ["missing", "readonly", "foreign lock"];
      for (const reason of reasons)
        for (const dirty of [false, true]) {
          const seed = createDefaultTemplateContent();
          seed.settings.locale = "en";
          seed.settings.locales = ["de", "fr"];
          seed.blocks = [
            createTitleBlock({ id: "t1" }),
            createTitleBlock({ id: "t2" }),
            createSectionBlock({
              id: "s1",
              children: [[createTitleBlock({ id: "child" })]],
            }),
          ];
          let saved = safeClone(seed);
          const locks = ref(new Map<string, unknown>());
          const editor = useEditor({
            content: seed,
            localization: {
              locales: reason === "readonly" ? ["fr"] : ["de", "fr"],
            },
            lockedBlocks: locks,
            templates: {
              load: async () =>
                ({ id: "template", content: safeClone(saved) }) as Template,
              create: false,
              save: false,
            },
          });
          const history = useHistory({
            content: editor.content,
            setContent: editor.setContent,
          });
          useHistoryInterceptor(editor, history);
          const actions = useBlockActions({
            addBlock: editor.addBlock,
            removeBlock: editor.removeBlock,
            updateBlock: editor.updateBlock,
            selectBlock: editor.selectBlock,
            findBlockLocation: editor.findBlockLocation,
          });
          editor.updateSettings({ width: 650 });
          editor.updateSettings({ width: 700 });
          history.undo();
          saved = safeClone(editor.content.value);
          await editor.load("template");
          if (dirty) editor.markDirty();
          editor.setActiveLocale("de");
          if (reason === "foreign lock" || reason === "locked section") {
            const id =
              method === "addBlock" || reason === "locked section"
                ? "s1"
                : "t1";
            locks.value.set(id, {
              blockId: id,
              locale: "fr",
              holder: { sessionId: "peer" },
            });
          }
          const before = safeClone(editor.content.value);
          const record = vi.spyOn(history, "record");
          expect(history.canUndo.value).toBe(true);
          expect(history.canRedo.value).toBe(true);
          const id = reason === "missing" ? "missing" : "t1";
          if (method === "removeBlock") editor.removeBlock(id);
          if (method === "moveBlock") editor.moveBlock(id, 1);
          if (method === "addBlock")
            editor.addBlock(
              createTitleBlock(),
              reason === "missing" ? "missing" : "s1",
            );
          if (method === "duplicateBlock")
            actions.duplicateBlock(
              reason === "locked section"
                ? (editor.content.value.blocks[2] as any).children[0][0]
                : reason === "missing"
                  ? createTitleBlock({ id })
                  : editor.content.value.blocks[0],
            );
          const label = `${method}: ${reason}, dirty=${dirty}`;
          expect.soft(record, label).not.toHaveBeenCalled();
          expect.soft(editor.content.value, label).toEqual(before);
          expect.soft(editor.state.isDirty, label).toBe(dirty);
          expect.soft(history.canUndo.value, label).toBe(true);
          expect.soft(history.canRedo.value, label).toBe(true);
          history.redo();
          expect.soft(editor.content.value.settings.width, label).toBe(700);
          history.undo();
          history.undo();
          expect.soft(editor.content.value.settings.width, label).toBe(600);
          history.destroy();
        }
    },
  );
});
