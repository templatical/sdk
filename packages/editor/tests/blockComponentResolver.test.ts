import { describe, expect, it, vi } from "vitest";
import {
  resolveBlockComponent,
  getBlockWrapperStyle,
  getSectionWrapperStyle,
  getDocumentStyle,
} from "../src/utils/blockComponentResolver";
import type { Block, TemplateSettings } from "@templatical/types";
import {
  createTitleBlock,
  createImageBlock,
  createButtonBlock,
  createCountdownBlock,
  createDividerBlock,
  createSectionBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import type { UseBlockRegistryReturn } from "../src/composables/useBlockRegistry";
import { markRaw, type Component } from "vue";

const FakeTitle = markRaw({ name: "FakeTitle" }) as unknown as Component;
const FakeImage = markRaw({ name: "FakeImage" }) as unknown as Component;
const FakeRegistered = markRaw({
  name: "FakeRegistered",
}) as unknown as Component;

const componentMap: Record<string, Component> = {
  title: FakeTitle,
  image: FakeImage,
};

describe("resolveBlockComponent", () => {
  it("returns component from map when registry is null", () => {
    const block = createTitleBlock();
    const result = resolveBlockComponent(block, null, componentMap);
    expect(result).toBe(FakeTitle);
  });

  it("returns component from map when registry is undefined", () => {
    const block = createImageBlock();
    const result = resolveBlockComponent(block, undefined, componentMap);
    expect(result).toBe(FakeImage);
  });

  it("returns null for unknown block type", () => {
    const block = createButtonBlock();
    const result = resolveBlockComponent(block, null, componentMap);
    expect(result).toBeNull();
  });

  it("checks registry first before falling back to map", () => {
    const block = createTitleBlock();
    const registry = {
      getComponent: vi.fn().mockReturnValue(FakeRegistered),
    } as unknown as UseBlockRegistryReturn;

    const result = resolveBlockComponent(block, registry, componentMap);
    expect(result).toBe(FakeRegistered);
    expect(registry.getComponent).toHaveBeenCalledWith(block);
  });

  it("falls back to map when registry returns undefined", () => {
    const block = createTitleBlock();
    const registry = {
      getComponent: vi.fn().mockReturnValue(undefined),
    } as unknown as UseBlockRegistryReturn;

    const result = resolveBlockComponent(block, registry, componentMap);
    expect(result).toBe(FakeTitle);
  });

  it("returns null when both registry and map miss", () => {
    const block = createDividerBlock();
    const registry = {
      getComponent: vi.fn().mockReturnValue(undefined),
    } as unknown as UseBlockRegistryReturn;

    const result = resolveBlockComponent(block, registry, componentMap);
    expect(result).toBeNull();
  });

  /**
   * The registry is the ONLY source for `countdown`, on purpose: it's the one
   * Cloud-only block, so `useEditorCore` registers it as a lazy
   * `defineAsyncComponent` and every fallback map omits it. A static entry in a
   * fallback map would never be reached (registry wins) yet its static import
   * would still drag the module into the eager bundle — which is exactly what
   * `Canvas.vue` used to do.
   */
  it("resolves a registry-only block type that no fallback map carries", () => {
    const block = createCountdownBlock();
    const registry = {
      getComponent: vi.fn().mockReturnValue(FakeRegistered),
    } as unknown as UseBlockRegistryReturn;

    // `componentMap` deliberately has no `countdown` key.
    expect(componentMap.countdown).toBeUndefined();
    expect(resolveBlockComponent(block, registry, componentMap)).toBe(
      FakeRegistered,
    );
    // Without a registry there is nothing to fall back to — the block simply
    // doesn't render, which is how the three preview surfaces already behave.
    expect(resolveBlockComponent(block, null, componentMap)).toBeNull();
  });
});

describe("getBlockWrapperStyle", () => {
  it("computes padding and background from block styles", () => {
    const block = createTitleBlock();
    block.styles = {
      padding: { top: 10, right: 20, bottom: 30, left: 40 },
      backgroundColor: "#ff0000",
    };

    const style = getBlockWrapperStyle(block);
    expect(style.padding).toBe("10px 20px 30px 40px");
    expect(style.margin).toBeUndefined();
    expect(style.backgroundColor).toBe("#ff0000");
  });

  it("defaults backgroundColor to transparent when empty", () => {
    const block = createTitleBlock();
    block.styles = {
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      backgroundColor: "",
    };

    const style = getBlockWrapperStyle(block);
    expect(style.backgroundColor).toBe("transparent");
  });

  it("handles zero padding", () => {
    const block = createTitleBlock();
    block.styles = {
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      backgroundColor: "#fff",
    };

    const style = getBlockWrapperStyle(block);
    expect(style.padding).toBe("0px 0px 0px 0px");
    expect(style.backgroundColor).toBe("#fff");
  });

  it("includes borderRadius for a section when set (canvas/preview match export)", () => {
    const style = getBlockWrapperStyle(createSectionBlock({ borderRadius: 12 }));
    expect(style.borderRadius).toBe("12px");
  });

  it("omits borderRadius for a section when unset or zero", () => {
    expect(getBlockWrapperStyle(createSectionBlock()).borderRadius).toBeUndefined();
    expect(
      getBlockWrapperStyle(createSectionBlock({ borderRadius: 0 })).borderRadius,
    ).toBeUndefined();
  });

  it("never sets borderRadius for a non-section block", () => {
    expect(getBlockWrapperStyle(createTitleBlock()).borderRadius).toBeUndefined();
  });
});

describe("getSectionWrapperStyle", () => {
  it("returns null for a non-section block", () => {
    expect(getSectionWrapperStyle(createTitleBlock())).toBeNull();
  });

  it("returns null for a section without a wrapper", () => {
    expect(getSectionWrapperStyle(createSectionBlock())).toBeNull();
  });

  it("builds bg + padding + radius for a wrapped section", () => {
    const block = createSectionBlock({
      wrapper: {
        backgroundColor: "#0000ff",
        padding: { top: 24, right: 20, bottom: 24, left: 20 },
        borderRadius: 8,
      },
    });
    expect(getSectionWrapperStyle(block)).toEqual({
      backgroundColor: "#0000ff",
      padding: "24px 20px 24px 20px",
      borderRadius: "8px",
    });
  });

  it("omits unset fields — a padding-only frame has no bg or radius", () => {
    const block = createSectionBlock({
      wrapper: {
        padding: { top: 10, right: 10, bottom: 10, left: 10 },
        borderRadius: 0,
      },
    });
    const style = getSectionWrapperStyle(block);
    expect(style).toEqual({ padding: "10px 10px 10px 10px" });
  });
});

describe("getDocumentStyle", () => {
  /* Every surface that renders blocks must apply this. Omitting it is what made
     saved-block previews drop the template font and the link underline while
     the canvas kept them — the link rules in styles/index.css fall through to
     `text-decoration: none` / `color: inherit` when the vars are unset. */
  function settings(overrides: Partial<TemplateSettings> = {}) {
    return {
      ...createDefaultTemplateContent().settings,
      ...overrides,
    } as TemplateSettings;
  }

  it("carries the template font family and nothing else when unconfigured", () => {
    expect(
      getDocumentStyle(
        settings({
          fontFamily: "Georgia, serif",
          textColor: "",
          linkColor: "",
          linkUnderline: false,
        }),
      ),
    ).toEqual({ fontFamily: "Georgia, serif" });
  });

  it("sets the link underline variable only when enabled", () => {
    const on = getDocumentStyle(settings({ linkUnderline: true }));
    expect(on["--tpl-doc-link-underline"]).toBe("underline");

    // Unset, NOT "none": the CSS fallback supplies `none`, and emitting it here
    // would also override an inherited value.
    const off = getDocumentStyle(settings({ linkUnderline: false }));
    expect(off).not.toHaveProperty("--tpl-doc-link-underline");
  });

  it("sets the link colour variable only when configured", () => {
    expect(
      getDocumentStyle(settings({ linkColor: "#ff0000" }))[
        "--tpl-doc-link-color"
      ],
    ).toBe("#ff0000");
    expect(getDocumentStyle(settings({ linkColor: "" }))).not.toHaveProperty(
      "--tpl-doc-link-color",
    );
  });

  it("sets the text colour only when configured", () => {
    expect(getDocumentStyle(settings({ textColor: "#123456" })).color).toBe(
      "#123456",
    );
    expect(getDocumentStyle(settings({ textColor: "" }))).not.toHaveProperty(
      "color",
    );
  });

  it("emits every property together for a fully configured template", () => {
    expect(
      getDocumentStyle(
        settings({
          fontFamily: "Georgia, serif",
          textColor: "#111827",
          linkColor: "#c0392b",
          linkUnderline: true,
        }),
      ),
    ).toEqual({
      fontFamily: "Georgia, serif",
      color: "#111827",
      "--tpl-doc-link-color": "#c0392b",
      "--tpl-doc-link-underline": "underline",
    });
  });
});
