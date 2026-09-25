import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createImageBlock,
  createSectionBlock,
  uniformBorder,
} from "@templatical/types";
import type {
  BorderSideValue,
  BorderValue,
  CornerRadius,
} from "@templatical/types";
import { renderBlock, renderToMjml, RenderContext } from "../src";

/**
 * `border` / `border-<side>` / `border-radius` on `mj-section`, `mj-image` and
 * `mj-button` compile into inline styles — the only place a recipient's client
 * sees them. A string check on the MJML alone would not prove the attribute
 * survives (MJML silently drops attributes an element does not accept), so
 * these compile the renderer's output and assert on the HTML.
 */

const ctx = new RenderContext(600, [], "Arial, sans-serif", true);

const SIDE: BorderSideValue = { width: 2, style: "dashed", color: "#ff0000" };
const BORDER: BorderValue = uniformBorder(SIDE);
const NONE: BorderSideValue = { width: 0, style: "solid", color: "#000000" };

/** Top and bottom drawn, left and right not. */
const TOP_AND_BOTTOM: BorderValue = {
  top: SIDE,
  right: NONE,
  bottom: SIDE,
  left: NONE,
};

/** Every drawn side different. */
const MIXED: BorderValue = {
  top: { width: 4, style: "solid", color: "#111111" },
  right: { width: 1, style: "dotted", color: "#222222" },
  bottom: { width: 2, style: "dashed", color: "#333333" },
  left: NONE,
};

const BORDER_ATTR = /\sborder(-(top|right|bottom|left))?="/;

async function compile(mjml: string): Promise<string> {
  const result = await mjml2html(mjml);
  expect(result.errors).toEqual([]);
  return result.html.replace(/\s+/g, " ");
}

function wrapInColumn(blockMjml: string): string {
  return `<mjml><mj-body><mj-section><mj-column>${blockMjml}</mj-column></mj-section></mj-body></mjml>`;
}

function wrapInBody(sectionMjml: string): string {
  return `<mjml><mj-body>${sectionMjml}</mj-body></mjml>`;
}

/** The inline style of the `<img>` MJML emits for an mj-image. */
function imgStyle(html: string): string {
  const img = html.match(/<img[^>]*>/);
  expect(img).not.toBeNull();
  return /style="([^"]*)"/.exec(img![0])![1];
}

describe("border round-trip through MJML compiler", () => {
  it("borders the image itself", async () => {
    const block = createImageBlock({
      src: "https://example.com/img.png",
      width: 300,
      border: BORDER,
    });

    const mjml = renderBlock(block, ctx);
    expect(mjml).toContain('border="2px dashed #ff0000"');

    expect(imgStyle(await compile(wrapInColumn(mjml)))).toContain(
      "border:2px dashed #ff0000",
    );
  });

  it("borders the button", async () => {
    const block = createButtonBlock({ border: BORDER });

    const mjml = renderBlock(block, ctx);
    expect(mjml).toContain('border="2px dashed #ff0000"');

    expect(await compile(wrapInColumn(mjml))).toContain(
      "border:2px dashed #ff0000",
    );
  });

  it("borders the section box", async () => {
    const block = createSectionBlock({ border: BORDER });

    const mjml = renderBlock(block, ctx);
    expect(mjml).toMatch(/<mj-section[^>]*border="2px dashed #ff0000"/);

    expect(await compile(wrapInBody(mjml))).toContain(
      "border:2px dashed #ff0000",
    );
  });

  describe("per side", () => {
    it("emits one attribute per drawn side and no shorthand", () => {
      const blocks = [
        createImageBlock({
          src: "https://example.com/img.png",
          border: TOP_AND_BOTTOM,
        }),
        createButtonBlock({ border: TOP_AND_BOTTOM }),
        createSectionBlock({ border: TOP_AND_BOTTOM }),
      ];

      for (const block of blocks) {
        const mjml = renderBlock(block, ctx);
        expect(mjml).toContain('border-top="2px dashed #ff0000"');
        expect(mjml).toContain('border-bottom="2px dashed #ff0000"');
        expect(mjml).not.toMatch(/\sborder(-left|-right)?="/);
      }
    });

    it("gives each side its own width, style and color", () => {
      const mjml = renderBlock(createButtonBlock({ border: MIXED }), ctx);
      expect(mjml).toContain('border-top="4px solid #111111"');
      expect(mjml).toContain('border-right="1px dotted #222222"');
      expect(mjml).toContain('border-bottom="2px dashed #333333"');
      expect(mjml).not.toContain("border-left=");
    });

    it("keeps the image's side borders after MJML's own `border:0` default", async () => {
      const block = createImageBlock({
        src: "https://example.com/img.png",
        width: 300,
        border: TOP_AND_BOTTOM,
      });

      // Later declarations win: the sides must come after any `border:0`.
      const style = imgStyle(
        await compile(wrapInColumn(renderBlock(block, ctx))),
      );
      const reset = style.indexOf("border:0");
      const top = style.indexOf("border-top:2px dashed #ff0000");
      expect(top).toBeGreaterThan(-1);
      expect(style).toContain("border-bottom:2px dashed #ff0000");
      if (reset !== -1) expect(top).toBeGreaterThan(reset);
    });

    it("carries each side into the compiled button and section", async () => {
      const button = await compile(
        wrapInColumn(renderBlock(createButtonBlock({ border: MIXED }), ctx)),
      );
      expect(button).toContain("border-top:4px solid #111111");
      expect(button).toContain("border-right:1px dotted #222222");
      expect(button).toContain("border-bottom:2px dashed #333333");

      const section = await compile(
        wrapInBody(renderBlock(createSectionBlock({ border: MIXED }), ctx)),
      );
      expect(section).toContain("border-top:4px solid #111111");
      expect(section).toContain("border-right:1px dotted #222222");
      expect(section).toContain("border-bottom:2px dashed #333333");
    });
  });

  it("emits nothing when the border is unset or no side has a width", () => {
    const borders: (BorderValue | undefined)[] = [
      undefined,
      uniformBorder({ ...SIDE, width: 0 }),
      uniformBorder({ ...SIDE, width: -1 }),
    ];

    for (const border of borders) {
      const blocks = [
        createImageBlock({ src: "https://example.com/img.png", border }),
        createButtonBlock({ border }),
        createSectionBlock({ border }),
      ];

      for (const block of blocks) {
        expect(renderBlock(block, ctx)).not.toMatch(BORDER_ATTR);
      }
    }
  });

  it("strips characters that would break out of the CSS declaration", async () => {
    const block = createButtonBlock({
      border: {
        ...TOP_AND_BOTTOM,
        top: {
          width: 1,
          style: "solid",
          color: "red; background: url('//attacker/log')",
        },
      },
    });

    const mjml = renderBlock(block, ctx);
    expect(mjml).not.toContain(";");

    // The payload survives only as part of one (invalid) `border-top` value,
    // never as a declaration of its own.
    expect(await compile(wrapInColumn(mjml))).not.toMatch(
      /;\s*background:\s*url\(/,
    );
  });
});

describe("per-corner border radius round-trip through MJML compiler", () => {
  const TOP_ONLY: CornerRadius = {
    topLeft: 12,
    topRight: 12,
    bottomRight: 0,
    bottomLeft: 0,
  };
  const SQUARE: CornerRadius = {
    topLeft: 0,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 0,
  };

  it("rounds only the chosen corners of an image", async () => {
    const block = createImageBlock({
      src: "https://example.com/img.png",
      width: 300,
      borderRadius: TOP_ONLY,
    });

    const mjml = renderBlock(block, ctx);
    expect(mjml).toContain('border-radius="12px 12px 0px 0px"');
    expect(imgStyle(await compile(wrapInColumn(mjml)))).toContain(
      "border-radius:12px 12px 0px 0px",
    );
  });

  it("rounds only the chosen corners of a button", async () => {
    const mjml = renderBlock(
      createButtonBlock({ borderRadius: TOP_ONLY }),
      ctx,
    );
    expect(mjml).toContain('border-radius="12px 12px 0px 0px"');
    expect(await compile(wrapInColumn(mjml))).toContain(
      "border-radius:12px 12px 0px 0px",
    );
  });

  it("rounds only the chosen corners of a section", async () => {
    const mjml = renderBlock(
      createSectionBlock({ borderRadius: TOP_ONLY }),
      ctx,
    );
    expect(mjml).toMatch(/<mj-section[^>]*border-radius="12px 12px 0px 0px"/);
    expect(await compile(wrapInBody(mjml))).toContain(
      "border-radius:12px 12px 0px 0px",
    );
  });

  it("rounds only the chosen corners of a section wrapper", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSectionBlock({
        wrapper: {
          backgroundColor: "#eeeeee",
          borderRadius: {
            topLeft: 0,
            topRight: 0,
            bottomRight: 20,
            bottomLeft: 20,
          },
        },
      }),
    ];

    const mjml = await renderToMjml(content);
    expect(mjml).toMatch(/<mj-wrapper[^>]*border-radius="0px 0px 20px 20px"/);
    expect(await compile(mjml)).toContain("border-radius:0px 0px 20px 20px");
  });

  it("collapses matching corners to a single value", () => {
    const mjml = renderBlock(
      createImageBlock({
        src: "https://example.com/img.png",
        borderRadius: {
          topLeft: 8,
          topRight: 8,
          bottomRight: 8,
          bottomLeft: 8,
        },
      }),
      ctx,
    );
    expect(mjml).toContain('border-radius="8px"');
  });

  it("emits nothing for an image or section whose corners are all square", () => {
    expect(
      renderBlock(
        createImageBlock({
          src: "https://example.com/img.png",
          borderRadius: SQUARE,
        }),
        ctx,
      ),
    ).not.toContain("border-radius");
    expect(
      renderBlock(createSectionBlock({ borderRadius: SQUARE }), ctx),
    ).not.toContain("border-radius");
  });

  it("keeps a plain-number button radius exactly as before, 0 included", () => {
    expect(renderBlock(createButtonBlock({ borderRadius: 0 }), ctx)).toContain(
      'border-radius="0px"',
    );
    expect(renderBlock(createButtonBlock({ borderRadius: 6 }), ctx)).toContain(
      'border-radius="6px"',
    );
    expect(
      renderBlock(createButtonBlock({ borderRadius: SQUARE }), ctx),
    ).toContain('border-radius="0px"');
  });
});
