import { describe, expect, it, vi } from "vitest";
import {
  resolveBlockComponent,
  backgroundImageHostClass,
  getBackgroundImageStyle,
  getBlockWrapperStyle,
  getCachedBlockWrapperStyle,
  getSectionWrapperStyle,
  getWrapperStyle,
  getDocumentStyle,
} from "../src/utils/blockComponentResolver";
import type { TemplateSettings } from "@templatical/types";
import { SYNTAX_PRESETS, resolveFontStack } from "@templatical/types";
import { createImageUrlResolver } from "../src/composables/useImageUrlResolver";
import {
  createBackgroundImage,
  createTitleBlock,
  createImageBlock,
  createButtonBlock,
  createCountdownBlock,
  createDividerBlock,
  createSectionBlock,
  createWrapperBlock,
  createDefaultTemplateContent,
  uniformBorder,
} from "@templatical/types";
import type { UseBlockRegistryReturn } from "../src/composables/useBlockRegistry";
import { markRaw, type Component } from "vue";
import { renderToMjml } from "@templatical/renderer";

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

  it("includes the border for a section when set (canvas/preview match export)", () => {
    const style = getBlockWrapperStyle(
      createSectionBlock({
        border: uniformBorder({ width: 1, style: "dotted", color: "#cccccc" }),
      }),
    );
    expect(style.border).toBe("1px dotted #cccccc");
  });

  it("draws a section border on the drawn sides only", () => {
    const style = getBlockWrapperStyle(
      createSectionBlock({
        border: {
          top: { width: 2, style: "solid", color: "#000000" },
          right: { width: 0, style: "solid", color: "#000000" },
          bottom: { width: 2, style: "solid", color: "#000000" },
          left: { width: 0, style: "solid", color: "#000000" },
        },
      }),
    );
    expect(style.border).toBeUndefined();
    expect(style.borderTop).toBe("2px solid #000000");
    expect(style.borderBottom).toBe("2px solid #000000");
    expect(style.borderLeft).toBeUndefined();
    expect(style.borderRight).toBeUndefined();
  });

  it("omits the border for a section when unset or zero-width", () => {
    expect(getBlockWrapperStyle(createSectionBlock()).border).toBeUndefined();
    expect(
      getBlockWrapperStyle(
        createSectionBlock({
          border: uniformBorder({ width: 0, style: "solid", color: "#cccccc" }),
        }),
      ).border,
    ).toBeUndefined();
  });

  it("does not apply padding or background on a layout wrapper", () => {
    // The band paints through getWrapperStyle on WrapperBlock's root. Applying
    // the content-box helper here would double the padding against that band.
    const block = createWrapperBlock({
      styles: {
        backgroundColor: "#ffffff",
        padding: { top: 24, right: 24, bottom: 24, left: 24 },
      },
    });
    expect(getBlockWrapperStyle(block)).toEqual({});
  });
});

describe("getBlockWrapperStyle for a hero", () => {
  const image = {
    ...createBackgroundImage("https://cdn.test/hero.jpg"),
    size: "contain" as const,
    repeat: true,
    naturalWidth: 1200,
    naturalHeight: 800,
  };
  const border = uniformBorder({ width: 2, style: "solid", color: "#ff0000" });
  const drawsBorder = (style: Record<string, string>) =>
    Object.keys(style).some((key) => /^border(?!Radius)/.test(key));

  it("draws a matching hero at the renderer's fixed height for its desktop box, on every viewport", () => {
    const section = createSectionBlock({
      backgroundImage: image,
      hero: { height: "image", verticalAlign: "middle" },
    });
    const style = getBlockWrapperStyle(section, { heroBoxWidth: 600 });
    expect(style).toMatchObject({ minHeight: "400px" });
    expect(style).not.toHaveProperty("aspectRatio");
    expect(getBlockWrapperStyle(section, { heroBoxWidth: 560 }).minHeight).toBe(
      "373px",
    );
  });

  it.each([
    [600, 1200, 800],
    [560, 1200, 800],
    [333, 1000, 333],
    [600, 1920, 1081],
  ])(
    "matches the renderer's Match image height in a %ipx body (%ix%i image)",
    async (width, naturalWidth, naturalHeight) => {
      const section = createSectionBlock({
        backgroundImage: { ...image, naturalWidth, naturalHeight },
        hero: { height: "image", verticalAlign: "middle" },
        styles: {
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          backgroundColor: "",
        },
      });
      const content = createDefaultTemplateContent();
      content.settings = { ...content.settings, width };
      content.blocks = [section];
      const mjml = await renderToMjml(content);
      const height = /<mj-hero[^>]* height="(\d+)px"/.exec(mjml);
      expect(height).not.toBeNull();
      expect(
        getBlockWrapperStyle(section, { heroBoxWidth: width }).minHeight,
      ).toBe(`${height![1]}px`);
    },
  );

  it("draws a matching hero at the image's shape where its box is unknown, cover and unrepeated, with no border", () => {
    const style = getBlockWrapperStyle(
      createSectionBlock({
        backgroundImage: image,
        hero: { height: "image", verticalAlign: "bottom" },
        border,
        borderRadius: 12,
      }),
    );
    expect(style).toMatchObject({
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      boxSizing: "border-box",
      aspectRatio: `1 / ${800 / 1200}`,
      backgroundSize: "cover",
      backgroundRepeat: "no-repeat",
      borderRadius: "12px",
    });
    expect(style).not.toHaveProperty("minHeight");
    expect(drawsBorder(style)).toBe(false);
  });

  it("draws a fixed hero at least as tall as its height", () => {
    const style = getBlockWrapperStyle(
      createSectionBlock({
        backgroundImage: createBackgroundImage("https://cdn.test/hero.jpg"),
        hero: { height: 320, verticalAlign: "middle" },
      }),
    );
    expect(style).toMatchObject({
      minHeight: "320px",
      justifyContent: "center",
    });
    expect(style).not.toHaveProperty("aspectRatio");
  });

  it("draws a hero that doesn't apply as a regular section", () => {
    const style = getBlockWrapperStyle(
      createSectionBlock({
        columns: "2",
        children: [[], []],
        backgroundImage: image,
        hero: { height: "image", verticalAlign: "middle" },
        border,
      }),
    );
    expect(style).not.toHaveProperty("display");
    expect(style.backgroundSize).toBe("contain");
    expect(drawsBorder(style)).toBe(true);
  });

  it("lays out a merge-tag hero without painting its image", () => {
    const style = getBlockWrapperStyle(
      createSectionBlock({
        backgroundImage: createBackgroundImage("{{ hero_url }}"),
        hero: { height: 300, verticalAlign: "top" },
      }),
      { backgroundImageUrl: null },
    );
    expect(style).toMatchObject({ minHeight: "300px" });
    expect(style).not.toHaveProperty("backgroundImage");
  });
});

describe("getSectionWrapperStyle", () => {
  it("rounds only the chosen corners of the wrapper", () => {
    const style = getSectionWrapperStyle(
      createSectionBlock({
        wrapper: {
          borderRadius: { topLeft: 0, topRight: 0, bottomRight: 16, bottomLeft: 16 },
        },
      }),
    );
    expect(style?.borderRadius).toBe("0px 0px 16px 16px");
  });

  it("rounds only the chosen corners of the section box", () => {
    const style = getBlockWrapperStyle(
      createSectionBlock({
        borderRadius: { topLeft: 8, topRight: 8, bottomRight: 0, bottomLeft: 0 },
      }),
    );
    expect(style.borderRadius).toBe("8px 8px 0px 0px");
  });

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

describe("getWrapperStyle", () => {
  it("returns null for a non-wrapper block", () => {
    expect(getWrapperStyle(createTitleBlock())).toBeNull();
  });

  it("builds bg + padding + radius from the block itself", () => {
    const block = createWrapperBlock({
      styles: {
        backgroundColor: "#ffffff",
        padding: { top: 24, right: 24, bottom: 24, left: 24 },
      },
      borderRadius: 12,
    });
    expect(getWrapperStyle(block)).toEqual({
      backgroundColor: "#ffffff",
      padding: "24px 24px 24px 24px",
      borderRadius: "12px",
    });
  });

  it("omits unset fields — a padding-only band has no bg or radius", () => {
    const block = createWrapperBlock({
      styles: {
        padding: { top: 10, right: 10, bottom: 10, left: 10 },
      },
      borderRadius: 0,
    });
    expect(getWrapperStyle(block)).toEqual({
      padding: "10px 10px 10px 10px",
    });
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

  // The real rule, with the editor's default fonts config.
  const resolve = (fontFamily: string) =>
    resolveFontStack(fontFamily, {
      customFonts: [],
      defaultFallback: "Arial, sans-serif",
    });

  it("resolves the template font the way the email does", () => {
    expect(getDocumentStyle(settings({ fontFamily: "Roboto" }), resolve).fontFamily).toBe(
      "'Roboto', Arial, sans-serif",
    );
    expect(getDocumentStyle(settings({ fontFamily: "georgia" }), resolve).fontFamily).toBe(
      "Georgia, serif",
    );
  });

  it("carries the template font family and nothing else when unconfigured", () => {
    expect(
      getDocumentStyle(
        settings({
          fontFamily: "Georgia, serif",
          textColor: "",
          linkColor: "",
          linkUnderline: false,
        }),
        resolve,
      ),
    ).toEqual({ fontFamily: "Georgia, serif" });
  });

  it("sets the link underline variable only when enabled", () => {
    const on = getDocumentStyle(settings({ linkUnderline: true }), resolve);
    expect(on["--tpl-doc-link-underline"]).toBe("underline");

    // Unset, NOT "none": the CSS fallback supplies `none`, and emitting it here
    // would also override an inherited value.
    const off = getDocumentStyle(settings({ linkUnderline: false }), resolve);
    expect(off).not.toHaveProperty("--tpl-doc-link-underline");
  });

  it("sets the link colour variable only when configured", () => {
    expect(
      getDocumentStyle(settings({ linkColor: "#ff0000" }), resolve)[
        "--tpl-doc-link-color"
      ],
    ).toBe("#ff0000");
    expect(getDocumentStyle(settings({ linkColor: "" }), resolve)).not.toHaveProperty(
      "--tpl-doc-link-color",
    );
  });

  it("sets the text colour only when configured", () => {
    expect(getDocumentStyle(settings({ textColor: "#123456" }), resolve).color).toBe(
      "#123456",
    );
    expect(getDocumentStyle(settings({ textColor: "" }), resolve)).not.toHaveProperty(
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
        resolve,
      ),
    ).toEqual({
      fontFamily: "Georgia, serif",
      color: "#111827",
      "--tpl-doc-link-color": "#c0392b",
      "--tpl-doc-link-underline": "underline",
    });
  });
});

describe("background images on the canvas", () => {
  const image = createBackgroundImage("https://cdn.test/hero.jpg");

  it("getBackgroundImageStyle mirrors the renderer's values", () => {
    expect(getBackgroundImageStyle(image)).toEqual({
      backgroundImage: 'url("https://cdn.test/hero.jpg")',
      backgroundSize: "cover",
      backgroundPosition: "center center",
      backgroundRepeat: "no-repeat",
      "--tpl-block-bg-layer":
        'url("https://cdn.test/hero.jpg") center center / cover no-repeat',
    });
  });

  it("the dark-preview layer paints the same url, position, size and repeat", () => {
    const tiled = {
      ...image,
      size: "auto" as const,
      position: { x: "left" as const, y: "top" as const },
      repeat: true,
    };
    const style = getBackgroundImageStyle(tiled, 'blob:http://x.test/a"b');
    expect(style["--tpl-block-bg-layer"]).toBe(
      'url("blob:http://x.test/a%22b") left top / auto repeat',
    );
    expect(style.backgroundImage).toBe('url("blob:http://x.test/a%22b")');
  });

  it("getBackgroundImageStyle is empty without a usable url", () => {
    expect(getBackgroundImageStyle(undefined)).toEqual({});
    expect(getBackgroundImageStyle({ ...image, url: " " })).toEqual({});
  });

  it("paints the display url instead of the stored one, encoded", () => {
    expect(
      getBackgroundImageStyle(image, 'blob:http://x.test/a"b').backgroundImage,
    ).toBe('url("blob:http://x.test/a%22b")');
  });

  it("ignores a blank display url", () => {
    expect(getBackgroundImageStyle(image, "").backgroundImage).toBe(
      'url("https://cdn.test/hero.jpg")',
    );
  });

  it("section box carries the image next to its color", () => {
    const section = createSectionBlock({
      backgroundImage: image,
      styles: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        backgroundColor: "#0f172a",
      },
    });
    const style = getBlockWrapperStyle(section, {
      backgroundImageUrl: "blob:resolved",
    });
    expect(style.backgroundColor).toBe("#0f172a");
    expect(style.backgroundImage).toBe('url("blob:resolved")');
  });

  it("section wrapper frame carries its own image", () => {
    const section = createSectionBlock({
      wrapper: { backgroundImage: createBackgroundImage("https://cdn.test/band.jpg") },
    });
    expect(getSectionWrapperStyle(section)?.backgroundImage).toBe(
      'url("https://cdn.test/band.jpg")',
    );
  });

  it("layout wrapper band carries its own image", () => {
    const band = createWrapperBlock({
      backgroundImage: createBackgroundImage("https://cdn.test/band.jpg"),
    });
    expect(getWrapperStyle(band)?.backgroundSize).toBe("cover");
  });

  it("marks every surface that paints an image as a dark-preview photo host", () => {
    const section = createSectionBlock({
      backgroundImage: image,
      wrapper: { backgroundImage: createBackgroundImage("https://cdn.test/band.jpg") },
    });
    const band = createWrapperBlock({
      backgroundImage: createBackgroundImage("https://cdn.test/band.jpg"),
    });
    expect(backgroundImageHostClass(getBlockWrapperStyle(section))).toBe(
      "tpl-has-bg-image",
    );
    expect(backgroundImageHostClass(getSectionWrapperStyle(section))).toBe(
      "tpl-has-bg-image",
    );
    expect(backgroundImageHostClass(getWrapperStyle(band))).toBe(
      "tpl-has-bg-image",
    );
  });

  it("leaves surfaces without a painted image unmarked", () => {
    const plain = createSectionBlock({ wrapper: { backgroundColor: "#eee" } });
    const mergeTag = createSectionBlock({
      backgroundImage: createBackgroundImage("{{ hero_url }}"),
    });
    expect(backgroundImageHostClass(getBlockWrapperStyle(plain))).toBeUndefined();
    expect(
      backgroundImageHostClass(getSectionWrapperStyle(plain)),
    ).toBeUndefined();
    expect(
      backgroundImageHostClass(
        getBlockWrapperStyle(mergeTag, { backgroundImageUrl: null }),
      ),
    ).toBeUndefined();
    expect(
      backgroundImageHostClass(getSectionWrapperStyle(createTitleBlock())),
    ).toBeUndefined();
  });
});

describe("background images and merge tags", () => {
  const image = createBackgroundImage("https://cdn.test/hero.jpg");
  const mergeTagImage = createBackgroundImage("{{ hero_url }}");
  const syntax = SYNTAX_PRESETS.liquid;

  it("getBackgroundImageStyle paints nothing for a null display url", () => {
    expect(getBackgroundImageStyle(image, null)).toEqual({});
  });

  it("a null display url drops the image and keeps the section's color", () => {
    const section = createSectionBlock({
      backgroundImage: image,
      styles: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        backgroundColor: "#0f172a",
      },
    });
    const style = getBlockWrapperStyle(section, { backgroundImageUrl: null });
    expect(style.backgroundColor).toBe("#0f172a");
    expect(style).not.toHaveProperty("backgroundImage");
    expect(style).not.toHaveProperty("backgroundSize");
  });

  describe("getCachedBlockWrapperStyle", () => {
    it("paints the cached display url", () => {
      const resolver = createImageUrlResolver((src) => `blob:${src}`);
      resolver.lookup("hero.jpg");
      const section = createSectionBlock({
        backgroundImage: createBackgroundImage("hero.jpg"),
      });
      expect(
        getCachedBlockWrapperStyle(section, resolver, syntax).backgroundImage,
      ).toBe('url("blob:hero.jpg")');
    });

    it("paints the stored url for an uncached src and starts no lookup", () => {
      const resolve = vi.fn((src: string) => `blob:${src}`);
      const section = createSectionBlock({
        backgroundImage: createBackgroundImage("hero.jpg"),
      });
      const style = getCachedBlockWrapperStyle(
        section,
        createImageUrlResolver(resolve),
        syntax,
      );
      expect(style.backgroundImage).toBe('url("hero.jpg")');
      expect(resolve).not.toHaveBeenCalled();
    });

    it("paints no image for a merge-tag url", () => {
      const resolve = vi.fn((src: string) => `blob:${src}`);
      const section = createSectionBlock({
        backgroundImage: mergeTagImage,
        styles: {
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          backgroundColor: "#0f172a",
        },
      });
      const style = getCachedBlockWrapperStyle(
        section,
        createImageUrlResolver(resolve),
        syntax,
      );
      expect(style).not.toHaveProperty("backgroundImage");
      expect(style.backgroundColor).toBe("#0f172a");
      expect(resolve).not.toHaveBeenCalled();
    });

    it("leaves blocks other than sections as getBlockWrapperStyle has them", () => {
      const title = createTitleBlock();
      expect(getCachedBlockWrapperStyle(title, null, syntax)).toEqual(
        getBlockWrapperStyle(title),
      );
    });
  });
});

describe("getCachedBlockWrapperStyle for a hero", () => {
  it("draws a matching hero at its desktop box's height", () => {
    const section = createSectionBlock({
      backgroundImage: {
        ...createBackgroundImage("https://cdn.test/hero.jpg"),
        naturalWidth: 1200,
        naturalHeight: 800,
      },
      hero: { height: "image", verticalAlign: "middle" },
    });
    const style = getCachedBlockWrapperStyle(
      section,
      null,
      SYNTAX_PRESETS.liquid,
      560,
    );
    expect(style.minHeight).toBe("373px");
  });
});
