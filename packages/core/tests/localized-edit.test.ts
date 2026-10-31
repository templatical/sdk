import { describe, expect, it } from "vitest";
import {
  createTitleBlock,
  createMenuBlock,
  createImageBlock,
  createSectionBlock,
  sourceHash,
  type Block,
  type CustomBlockDefinition,
} from "@templatical/types";
import { deriveLayer, resetLocalizedFields } from "../src/localized-edit";

describe("deriveLayer", () => {
  const base = createTitleBlock({ id: "t1", content: "Hello" });

  it("stores a translated title against the base hash", () => {
    expect(deriveLayer(base, { ...base, content: "Hallo" }, undefined)).toEqual(
      {
        text: { content: { value: "Hallo", sourceHash: sourceHash("Hello") } },
      },
    );
  });

  it("resets a translation when the base value is typed back", () => {
    expect(
      deriveLayer(base, base, {
        text: { content: { value: "Hallo", sourceHash: "old" } },
      }),
    ).toEqual({});
  });

  it("keeps an unchanged translation stale", () => {
    expect(
      deriveLayer(
        base,
        { ...base, content: "Hallo" },
        {
          text: { content: { value: "Hallo", sourceHash: "old" } },
        },
      ),
    ).toEqual({ text: { content: { value: "Hallo", sourceHash: "old" } } });
  });

  it("addresses menu text and URLs by element id", () => {
    const menu = createMenuBlock({
      items: [{ id: "i1", text: "Home", url: "/en" }],
    });
    expect(
      deriveLayer(
        menu,
        { ...menu, items: [{ id: "i1", text: "Start", url: "/de" }] },
        undefined,
      ),
    ).toEqual({
      text: { "items.i1.text": { value: "Start", sourceHash: sourceHash("Home") } },
      set: { "items.i1.url": "/de" },
    });
  });

  it("stores a nested style leaf as an override", () => {
    const styled = {
      ...base,
      styles: {
        ...base.styles,
        padding: { top: 10, right: 0, bottom: 0, left: 0 },
      },
    };
    expect(
      deriveLayer(
        styled,
        {
          ...styled,
          styles: {
            ...styled.styles,
            padding: { ...styled.styles.padding, top: 20 },
          },
        },
        undefined,
      ),
    ).toEqual({ set: { "styles.padding.top": 20 } });
  });

  it("uses custom definitions to separate text from colour", () => {
    const custom = {
      id: "c1",
      type: "custom",
      customType: "card",
      fieldValues: { headline: "Hello", color: "#000000" },
    } as Block;
    const definitions = [
      {
        type: "card",
        fields: [
          { key: "headline", type: "text" },
          { key: "color", type: "color" },
        ],
      },
    ] as CustomBlockDefinition[];
    expect(
      deriveLayer(
        custom,
        {
          ...custom,
          fieldValues: { headline: "Hallo", color: "#ffffff" },
        } as Block,
        undefined,
        definitions,
      ),
    ).toEqual({
      text: {
        "fieldValues.headline": { value: "Hallo", sourceHash: sourceHash("Hello") },
      },
      set: { "fieldValues.color": "#ffffff" },
    });
  });

  it("carries hidden even when there are no differing fields", () => {
    expect(deriveLayer(base, base, { hidden: true })).toEqual({ hidden: true });
  });

  it.each([
    ["height", createImageBlock({ height: 150 }), { height: undefined }],
    [
      "wrapper",
      createSectionBlock({ wrapper: { backgroundColor: "#000000" } }),
      { wrapper: undefined },
    ],
    [
      "styles.linkColor",
      { ...base, styles: { ...base.styles, linkColor: "#000000" } },
      { styles: { ...base.styles, linkColor: undefined } },
    ],
  ])(
    "represents clearing %s with null, never undefined",
    (path, block, patch) => {
      const layer = deriveLayer(
        block as Block,
        { ...block, ...patch } as Block,
        undefined,
      );
      expect(layer).toEqual({ set: { [path]: null } });
      expect(JSON.parse(JSON.stringify(layer))).toEqual(layer);
    },
  );

  it("does not turn section columns or children into overrides", () => {
    const section = createSectionBlock();
    expect(
      deriveLayer(
        section,
        { ...section, columns: "50-50", children: [[], []] },
        undefined,
      ),
    ).toEqual({});
  });
});

it("uses set rather than text when a translatable base value is absent", () => {
  const image = createImageBlock();
  const { alt: _alt, ...withoutAlt } = image;
  expect(
    deriveLayer(
      withoutAlt as Block,
      { ...image, alt: "Beschreibung" },
      undefined,
    ),
  ).toEqual({ set: { alt: "Beschreibung" } });
});

it("resets id-addressed list elements, removes orphan elements and preserves sibling edits", () => {
  const base = createMenuBlock({
    items: [
      { id: "home", text: "Home", url: "/" },
      { id: "about", text: "About", url: "/about" },
    ],
  });
  const view = {
    ...base,
    items: [
      { id: "home", text: "Start", url: "/de" },
      { id: "orphan", text: "Deleted", url: "/old" },
      { id: "about", text: "Über uns", url: "/de/about" },
    ],
  };
  const restored = resetLocalizedFields(base, view, [
    "items.home",
    "items.orphan",
    "items.missing",
  ]);
  expect(view.items).toEqual([
    base.items[0],
    { id: "about", text: "Über uns", url: "/de/about" },
  ]);
  expect(restored.size).toBe(0);
  view.items[0].text = "Further edit";
  expect(base.items[0].text).toBe("Home");
});
