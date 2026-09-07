import { describe, expect, it } from "vitest";
import type {
  ButtonBlock,
  DividerBlock,
  ImageBlock,
  ParagraphBlock,
  SpacerBlock,
  TitleBlock,
} from "@templatical/types";
import { convertLeaf, type MapContext } from "../block-mapper";
import { readGlobalStyle } from "../global-style";
import type { TopolNode } from "../types";

function ctx(
  rootAttrs: Record<string, unknown> = {},
  columnWidth = 600,
): MapContext {
  const warnings: string[] = [];
  const style = readGlobalStyle(
    { tagName: "mj-global-style", attributes: rootAttrs } as never,
    undefined,
    warnings,
  );
  return { style, columnWidth, warnings };
}

const node = (
  tagName: string,
  attributes: Record<string, unknown> = {},
  content?: string,
): TopolNode =>
  ({
    tagName,
    attributes,
    ...(content === undefined ? {} : { content }),
  }) as TopolNode;

describe("mj-text", () => {
  it("converts a heading to a title block", () => {
    const r = convertLeaf(
      node("mj-text", { align: "center" }, "<h2>Welcome</h2>"),
      ctx(),
    )!;
    const block = r.block as TitleBlock;
    expect(block.type).toBe("title");
    expect(block.level).toBe(2);
    expect(block.content).toBe("Welcome");
    expect(block.textAlign).toBe("center");
    expect(r.entry).toEqual({
      sourceTag: "mj-text",
      templaticalBlockType: "title",
      status: "converted",
    });
  });

  it("reports a clamped heading level as approximated", () => {
    const r = convertLeaf(node("mj-text", {}, "<h5>Small</h5>"), ctx())!;
    expect((r.block as TitleBlock).level).toBe(4);
    expect(r.entry.status).toBe("approximated");
    expect(r.entry.note).toBe(
      "Heading level h5 clamped to 4 — Templatical titles support h1-h4.",
    );
  });

  it("converts ordinary rich text to a paragraph, preserving markup", () => {
    const r = convertLeaf(
      node("mj-text", {}, "<p>Hello <strong>you</strong></p>"),
      ctx(),
    )!;
    expect((r.block as ParagraphBlock).content).toBe(
      "<p>Hello <strong>you</strong></p>",
    );
    expect(r.entry.templaticalBlockType).toBe("paragraph");
  });

  it("never sets a colour on a paragraph — paragraph colour is document-level", () => {
    const r = convertLeaf(
      node("mj-text", { color: "#445566" }, "<p>x</p>"),
      ctx(),
    )!;
    expect("color" in r.block!).toBe(false);
  });

  it("carries the node's own colour onto a title", () => {
    const r = convertLeaf(
      node("mj-text", { color: "#445566" }, "<h1>x</h1>"),
      ctx(),
    )!;
    expect((r.block as TitleBlock).color).toBe("#445566");
  });

  it("takes a title colour from the h1 selector default when the node sets none", () => {
    const r = convertLeaf(
      node("mj-text", {}, "<h1>x</h1>"),
      ctx({ "h1:color": "#111111" }),
    )!;
    expect((r.block as TitleBlock).color).toBe("#111111");
  });

  it("omits the title colour when neither the node nor the cascade sets one", () => {
    const r = convertLeaf(node("mj-text", {}, "<h1>x</h1>"), ctx())!;
    expect("color" in r.block!).toBe(false);
  });

  it("carries a font family onto a title", () => {
    const r = convertLeaf(
      node("mj-text", { "font-family": "Georgia, serif" }, "<h1>x</h1>"),
      ctx(),
    )!;
    expect((r.block as TitleBlock).fontFamily).toBe("Georgia");
  });

  it("omits the title font family when neither the node nor the cascade sets one", () => {
    const r = convertLeaf(node("mj-text", {}, "<h1>x</h1>"), ctx())!;
    expect("fontFamily" in r.block!).toBe(false);
  });
});

describe("mj-button", () => {
  it("converts label, url and appearance", () => {
    const r = convertLeaf(
      node(
        "mj-button",
        {
          href: "https://x.test",
          "background-color": "#ff6600",
          color: "#222222",
          "font-size": 16,
          "border-radius": "4px",
          align: "right",
          padding: "10px",
        },
        "<p>Buy <strong>now</strong></p>",
      ),
      ctx(),
    )!;
    const block = r.block as ButtonBlock;
    expect(block.text).toBe("Buy now");
    expect(block.url).toBe("https://x.test");
    expect(block.backgroundColor).toBe("#ff6600");
    expect(block.textColor).toBe("#222222");
    expect(block.fontSize).toBe(16);
    expect(block.borderRadius).toBe(4);
    expect(block.align).toBe("right");
    expect(block.styles.padding).toEqual({
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    });
  });

  it("carries a font family onto a button", () => {
    const r = convertLeaf(
      node(
        "mj-button",
        { href: "https://x.test", "font-family": "Georgia, serif" },
        "<p>Go</p>",
      ),
      ctx(),
    )!;
    expect((r.block as ButtonBlock).fontFamily).toBe("Georgia");
  });

  it("keeps the factory borderRadius when the node declares none", () => {
    const r = convertLeaf(
      node("mj-button", { href: "https://x.test" }, "<p>Go</p>"),
      ctx(),
    )!;
    expect((r.block as ButtonBlock).borderRadius).toBe(6);
  });

  it("keeps the factory fontSize when the node declares none", () => {
    const r = convertLeaf(
      node("mj-button", { href: "https://x.test" }, "<p>Go</p>"),
      ctx(),
    )!;
    expect((r.block as ButtonBlock).fontSize).toBe(15);
  });

  it("honours an explicit zero border radius", () => {
    const r = convertLeaf(
      node(
        "mj-button",
        { href: "https://x.test", "border-radius": "0" },
        "<p>Go</p>",
      ),
      ctx(),
    )!;
    expect((r.block as ButtonBlock).borderRadius).toBe(0);
  });

  it("takes the background from the button selector default when the node sets none", () => {
    const r = convertLeaf(
      node("mj-button", { href: "https://x.test" }, "<p>Go</p>"),
      ctx({ "button:background-color": "#e85034" }),
    )!;
    expect((r.block as ButtonBlock).backgroundColor).toBe("#e85034");
  });

  it("takes the background from the mj-button tag default when the node sets none", () => {
    const r = convertLeaf(
      node("mj-button", { href: "https://x.test" }, "<p>Go</p>"),
      ctx({ "mj-button": { "background-color": "#123456" } }),
    )!;
    expect((r.block as ButtonBlock).backgroundColor).toBe("#123456");
  });

  it("keeps the factory background and text colours when nothing sets them", () => {
    const r = convertLeaf(
      node("mj-button", { href: "https://x.test" }, "<p>Go</p>"),
      ctx(),
    )!;
    const block = r.block as ButtonBlock;
    expect(block.backgroundColor).toBe("#333333");
    expect(block.textColor).toBe("#ffffff");
  });

  it("returns null for a button with no label", () => {
    expect(
      convertLeaf(node("mj-button", { href: "https://x.test" }, "  "), ctx()),
    ).toBe(null);
  });
});

describe("mj-image", () => {
  it('restores width "full" from widthPercent 100', () => {
    const r = convertLeaf(
      node("mj-image", { src: "a.png", width: 600, widthPercent: 100 }),
      ctx(),
    )!;
    expect((r.block as ImageBlock).width).toBe("full");
  });

  it("keeps a px width when the image is not full width", () => {
    const r = convertLeaf(
      node("mj-image", { src: "a.png", width: 78, widthPercent: 13 }),
      ctx(),
    )!;
    expect((r.block as ImageBlock).width).toBe(78);
  });

  it("forces full width when the pixel width reaches the column width, even without widthPercent 100", () => {
    const r = convertLeaf(
      node("mj-image", { src: "a.png", width: 700, widthPercent: 90 }),
      ctx(),
    )!;
    expect((r.block as ImageBlock).width).toBe("full");
  });

  it("falls back to full width when neither width nor widthPercent is set", () => {
    const r = convertLeaf(node("mj-image", { src: "a.png" }), ctx())!;
    expect((r.block as ImageBlock).width).toBe("full");
  });

  it("reads a left alignment", () => {
    const r = convertLeaf(
      node("mj-image", { src: "a.png", align: "left" }),
      ctx(),
    )!;
    expect((r.block as ImageBlock).align).toBe("left");
  });

  it("treats an explicit null alt and href as absent", () => {
    const r = convertLeaf(
      node("mj-image", { src: "a.png", alt: null, href: null }),
      ctx(),
    )!;
    const block = r.block as ImageBlock;
    expect(block.alt).toBe("");
    expect("linkUrl" in block).toBe(false);
  });

  it("reads a link", () => {
    const r = convertLeaf(
      node("mj-image", { src: "a.png", href: "https://x.test" }),
      ctx(),
    )!;
    expect((r.block as ImageBlock).linkUrl).toBe("https://x.test");
  });

  it("reads an alt attribute", () => {
    const r = convertLeaf(
      node("mj-image", { src: "a.png", alt: "A hero image" }),
      ctx(),
    )!;
    expect((r.block as ImageBlock).alt).toBe("A hero image");
  });

  it("returns null for an image with no src", () => {
    expect(convertLeaf(node("mj-image", { alt: "x" }), ctx())).toBe(null);
  });
});

describe("mj-gif", () => {
  it("converts to an image block and reports the source tag", () => {
    const r = convertLeaf(
      node("mj-gif", { src: "a.gif", widthPercent: 100 }),
      ctx(),
    )!;
    expect(r.block!.type).toBe("image");
    expect(r.entry).toEqual({
      sourceTag: "mj-gif",
      templaticalBlockType: "image",
      status: "approximated",
      note: "<mj-gif> imported as an image block; Templatical has no dedicated GIF block.",
    });
  });
});

describe("mj-spacer and mj-divider", () => {
  it("converts a spacer height", () => {
    const r = convertLeaf(node("mj-spacer", { height: "32px" }), ctx())!;
    expect((r.block as SpacerBlock).height).toBe(32);
  });

  it("keeps the factory height when the spacer declares none", () => {
    const r = convertLeaf(node("mj-spacer", {}), ctx())!;
    expect((r.block as SpacerBlock).height).toBe(24);
  });

  it("converts a divider, reading the separate numeric padding keys", () => {
    const r = convertLeaf(
      node("mj-divider", {
        "border-color": "#ACACAC",
        "border-style": "solid",
        "border-width": "1px",
        "padding-top": 24,
        "padding-right": 22,
        "padding-bottom": 10,
        "padding-left": 25,
      }),
      ctx(),
    )!;
    const block = r.block as DividerBlock;
    expect(block.color).toBe("#acacac");
    expect(block.thickness).toBe(1);
    expect(block.lineStyle).toBe("solid");
    expect(block.styles.padding).toEqual({
      top: 24,
      right: 22,
      bottom: 10,
      left: 25,
    });
  });

  it("reads a non-default line style and thickness", () => {
    const r = convertLeaf(
      node("mj-divider", { "border-style": "dashed", "border-width": "3px" }),
      ctx(),
    )!;
    const block = r.block as DividerBlock;
    expect(block.lineStyle).toBe("dashed");
    expect(block.thickness).toBe(3);
  });

  it("keeps the factory colour when the node sets none", () => {
    const r = convertLeaf(node("mj-divider", {}), ctx())!;
    expect((r.block as DividerBlock).color).toBe("#e0e0e0");
  });
});

describe("shared block chrome (styles.backgroundColor)", () => {
  it("sets the block's own background colour from the node's attribute", () => {
    const r = convertLeaf(
      node("mj-spacer", { height: "10px", "background-color": "#f0f0f0" }),
      ctx(),
    )!;
    expect(r.block!.styles.backgroundColor).toBe("#f0f0f0");
  });

  it("omits the background colour when the node sets none", () => {
    const r = convertLeaf(node("mj-spacer", { height: "10px" }), ctx())!;
    expect("backgroundColor" in r.block!.styles).toBe(false);
  });
});

describe("the unknown-tag fallback", () => {
  it("preserves an unrecognised node as an html block", () => {
    const r = convertLeaf(node("mj-carousel", { images: "x" }), ctx())!;
    expect(r.block!.type).toBe("html");
    expect((r.block as { content: string }).content).toContain("mj-carousel");
    expect(r.entry).toEqual({
      sourceTag: "mj-carousel",
      templaticalBlockType: "html",
      status: "html-fallback",
      note: "<mj-carousel> has no Templatical block equivalent; the original node is preserved as JSON.",
    });
  });
});
