import { describe, expect, it } from "vitest";
import { convertLeaf, type MapContext } from "../block-mapper";
import type { ChamaileonNode } from "../types";
import type {
  ButtonBlock,
  DividerBlock,
  ImageBlock,
  TitleBlock,
} from "@templatical/types";

const ctx = (): MapContext => ({
  bodyWidth: 600,
  columnWidth: 600,
  variables: [],
  warnings: [],
});

const node = (partial: ChamaileonNode): ChamaileonNode => partial;

describe("button", () => {
  it("maps a 2.0 kebab-case filled button", () => {
    const { block, entry } = convertLeaf(
      node({
        type: "button",
        attrs: {
          text: "Download the App",
          href: "https://x.test",
          align: "center",
        },
        style: {
          "background-color": "#00a591",
          color: "#ffffff",
          "border-radius": "5px",
          "font-size": "16px",
        },
      }),
      ctx(),
    );
    const b = block as ButtonBlock;
    expect(b.type).toBe("button");
    expect(b.text).toBe("Download the App");
    expect(b.url).toBe("https://x.test");
    expect(b.backgroundColor).toBe("#00a591");
    expect(b.textColor).toBe("#ffffff");
    expect(b.borderRadius).toBe(5);
    expect(entry.status).toBe("converted");
    expect(entry.sourceTag).toBe("button");
  });

  it("strips a 4.x HTML label and unwraps a variable fill", () => {
    const { block } = convertLeaf(
      node({
        type: "button",
        attrs: { text: "<p>Details</p>\n", href: "" },
        style: {
          backgroundColor: { reference: "SecondaryColor", default: "#5C9AEB" },
          color: "#ffffff",
        },
      }),
      ctx(),
    );
    const b = block as ButtonBlock;
    expect(b.text).toBe("Details");
    expect(b.backgroundColor).toBe("#5c9aeb");
  });

  it("does not keep factory #333333 on an outlined button", () => {
    const { block, entry } = convertLeaf(
      node({
        type: "button",
        attrs: { text: "Let's do step one", href: "" },
        style: {
          "background-color": null,
          color: "#00a591",
          "border-left": "1px solid #00a591",
          "border-radius": "5px",
        },
      }),
      ctx(),
    );
    const b = block as ButtonBlock;
    expect(b.backgroundColor).toBe("#ffffff");
    expect(b.textColor).toBe("#00a591");
    expect(entry.status).toBe("approximated");
    expect(entry.note).toMatch(/outlined/i);
  });
});

describe("image", () => {
  it("reads 2.0 style.src", () => {
    const { block } = convertLeaf(
      node({
        type: "image",
        attrs: { altText: "Logo", align: "center" },
        style: { src: "https://cdn.test/logo.png", width: "72px" },
      }),
      ctx(),
    );
    const b = block as ImageBlock;
    expect(b.src).toBe("https://cdn.test/logo.png");
    expect(b.alt).toBe("Logo");
    expect(b.width).toBe(72);
  });

  it("reads 4.x attrs.src and treats body-width as full", () => {
    const { block } = convertLeaf(
      node({
        type: "image",
        attrs: { src: "https://cdn.test/hero.png", altText: "" },
        style: { width: "600px" },
      }),
      ctx(),
    );
    expect((block as ImageBlock).width).toBe("full");
  });
});

describe("divider", () => {
  it("parses 2.0 attrs.lineStyle", () => {
    const { block } = convertLeaf(
      node({
        type: "divider",
        attrs: { lineStyle: "2px solid #00a591" },
        style: {},
      }),
      ctx(),
    );
    const b = block as DividerBlock;
    expect(b.thickness).toBe(2);
    expect(b.lineStyle).toBe("solid");
    expect(b.color).toBe("#00a591");
    expect(b.width).toBe("full");
  });

  it("treats 4.x style.width as thickness, not block width", () => {
    const { block } = convertLeaf(
      node({
        type: "divider",
        attrs: {},
        style: { width: "2px", type: "solid", color: "#a9a9a9" },
      }),
      ctx(),
    );
    const b = block as DividerBlock;
    expect(b.thickness).toBe(2);
    expect(b.width).toBe("full");
  });
});

describe("text", () => {
  it("maps a sole h1 to a title", () => {
    const { block, entry } = convertLeaf(
      node({
        type: "text",
        attrs: { text: '<h1 style="text-align: center;">WELCOME</h1>' },
        style: { color: "#000000" },
      }),
      ctx(),
    );
    const b = block as TitleBlock;
    expect(b.type).toBe("title");
    expect(b.level).toBe(1);
    expect(entry.templaticalBlockType).toBe("title");
  });
});

describe("unknown type", () => {
  it("html-fallbacks with JSON.stringify of the node", () => {
    const n = node({ type: "countdown", attrs: { foo: 1 } });
    const { block, entry } = convertLeaf(n, ctx());
    expect(block?.type).toBe("html");
    expect(entry.status).toBe("html-fallback");
    expect((block as { content: string }).content).toContain('"countdown"');
  });
});

describe("visibility", () => {
  it("maps hideOnMobile onto the block", () => {
    const { block } = convertLeaf(
      node({
        type: "text",
        attrs: { text: "<p>Hi</p>", hideOnMobile: true },
        style: {},
      }),
      ctx(),
    );
    expect(block?.visibility).toEqual({ desktop: true, mobile: false });
  });

  it("omits visibility when both flags are false", () => {
    const { block } = convertLeaf(
      node({
        type: "text",
        attrs: { text: "<p>Hi</p>", hideOnMobile: false, hideOnDesktop: false },
        style: {},
      }),
      ctx(),
    );
    expect("visibility" in (block ?? {})).toBe(false);
  });
});
