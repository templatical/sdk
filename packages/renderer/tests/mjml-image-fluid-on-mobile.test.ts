import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createDefaultTemplateContent,
  createImageBlock,
  createSectionBlock,
  createSlotBlock,
  createVideoBlock,
  createWrapperBlock,
  uniformBorder,
} from "@templatical/types";
import type {
  Block,
  ColumnLayout,
  ImageBlock,
  SectionBlock,
  TemplateContent,
} from "@templatical/types";
import { fluidOnMobileAttr, renderToMjml } from "../src";

/**
 * `fluid-on-mobile` widens an image to its stacked column on a phone. It
 * belongs only on an image that already fills its column on desktop: `"full"`,
 * or a pixel width MJML caps at the room it gives the image. A narrower image
 * keeps its width, as the editor canvas draws it (`width: Npx; max-width: 100%`).
 *
 * Each boundary reads the room from MJML itself, by compiling a 9999px image and
 * reading back the width MJML gave it, so the renderer's arithmetic is checked
 * against MJML's, not against a copy of it.
 */

const PROBE = "https://example.com/probe.png";

function doc(blocks: Block[], width = 600): TemplateContent {
  const content = createDefaultTemplateContent();
  return { ...content, settings: { ...content.settings, width }, blocks };
}

function probeImage(
  width: ImageBlock["width"],
  partial: Partial<ImageBlock> = {},
): ImageBlock {
  return createImageBlock({ src: PROBE, alt: "probe", width, ...partial });
}

function section(
  columns: ColumnLayout,
  index: number,
  probe: Block,
  partial: Partial<SectionBlock> = {},
): SectionBlock {
  const count = { "1": 1, "2": 2, "3": 3, "1-2": 2, "2-1": 2 }[columns];
  const children: Block[][] = Array.from({ length: count }, () => []);
  children[index] = [probe];
  return createSectionBlock({ columns, children, ...partial });
}

async function compile(
  content: TemplateContent,
  layout?: TemplateContent,
): Promise<string> {
  const { html, errors } = await mjml2html(
    await renderToMjml(content, { layout }),
  );
  expect(errors).toEqual([]);
  return html;
}

/** The `<table>` MJML wraps the probe in, up to its `<img>`. */
function probeMarkup(html: string): string {
  const at = html.indexOf(`src="${PROBE}"`);
  expect(at).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf("<table", at), at);
}

function isFluid(html: string): boolean {
  return probeMarkup(html).includes("mj-full-width-mobile");
}

/** The probe's `<img>` tag, found by its `src` rather than a pattern built from it. */
function probeTag(html: string): string {
  const at = html.indexOf(`src="${PROBE}"`);
  expect(at).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf("<img", at), html.indexOf(">", at) + 1);
}

function renderedWidth(html: string): number {
  const width = probeTag(html).match(/\bwidth="(\d+)"/);
  expect(width).not.toBeNull();
  return Number(width![1]);
}

/**
 * Compile the probe at MJML's room and one pixel under it. `build` returns the
 * whole template for a given probe width.
 */
async function boundary(
  build: (width: number) => TemplateContent,
  layout?: TemplateContent,
) {
  const room = renderedWidth(await compile(build(9999), layout));
  return {
    room,
    atRoom: isFluid(await compile(build(room), layout)),
    underRoom: isFluid(await compile(build(room - 1), layout)),
  };
}

describe("fluid-on-mobile is set per image", () => {
  it("emits no global mj-image default", async () => {
    const mjml = await renderToMjml(doc([probeImage(120)]));
    expect(mjml).not.toContain("fluid-on-mobile");
  });

  it("keeps a 120px logo at 120px on phones", async () => {
    const html = await compile(doc([probeImage(120)]));
    expect(isFluid(html)).toBe(false);
    expect(renderedWidth(html)).toBe(120);
  });

  it("makes a full-width image fill its column on phones", async () => {
    const html = await compile(doc([probeImage("full")]));
    expect(isFluid(html)).toBe(true);
    expect(renderedWidth(html)).toBe(580);
  });

  it("keeps an image with a set height narrower than the column unstretched", async () => {
    const html = await compile(doc([probeImage(120, { height: 40 })]));
    expect(isFluid(html)).toBe(false);
    const img = probeTag(html);
    expect(img).toContain('height="40"');
    expect(img).toContain('width="120"');
  });
});

describe("fills its column at exactly the room MJML gives it", () => {
  it("top-level image (the default section)", async () => {
    expect(await boundary((w) => doc([probeImage(w)]))).toEqual({
      room: 580,
      atRoom: true,
      underRoom: false,
    });
  });

  it("two-column section with its default 20px padding", async () => {
    expect(
      await boundary((w) => doc([section("2", 0, probeImage(w))])),
    ).toEqual({ room: 260, atRoom: true, underRoom: false });
  });

  it("three columns at 33.33%, not a third of the body", async () => {
    const zeroPadding = {
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    };
    // 600 × 33.33% = 199.98, which MJML floors to 199; a third would be 200.
    expect(
      await boundary((w) => doc([section("3", 0, probeImage(w), zeroPadding)])),
    ).toEqual({ room: 179, atRoom: true, underRoom: false });
    // The last column is 33.34%: 200.04, floored to 200.
    expect(
      await boundary((w) => doc([section("3", 2, probeImage(w), zeroPadding)])),
    ).toEqual({ room: 180, atRoom: true, underRoom: false });
  });

  it("wide column of a 1-2 layout", async () => {
    const zeroPadding = {
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    };
    expect(
      await boundary((w) =>
        doc([section("1-2", 1, probeImage(w), zeroPadding)]),
      ),
    ).toEqual({ room: 380, atRoom: true, underRoom: false });
  });

  it("section padding and border narrow the columns", async () => {
    const partial: Partial<SectionBlock> = {
      styles: { padding: { top: 0, right: 25, bottom: 0, left: 25 } },
      border: uniformBorder({ width: 3, style: "solid", color: "#000000" }),
    };
    // (600 − 50 − 6) × 50% = 272, less the image's 20px of padding.
    expect(
      await boundary((w) => doc([section("2", 0, probeImage(w), partial)])),
    ).toEqual({ room: 252, atRoom: true, underRoom: false });
  });

  it("a section's own wrapper band narrows it", async () => {
    const partial: Partial<SectionBlock> = {
      wrapper: { padding: { top: 0, right: 50, bottom: 0, left: 50 } },
    };
    // 600 − 100 (band) − 40 (section) − 20 (image).
    expect(
      await boundary((w) => doc([section("1", 0, probeImage(w), partial)])),
    ).toEqual({ room: 440, atRoom: true, underRoom: false });
  });

  it("a layout wrapper narrows what it holds", async () => {
    // Wrapper blocks are layout-only, so the band reaches the renderer via `layout`.
    const layout = doc([
      createWrapperBlock({
        styles: { padding: { top: 0, right: 30, bottom: 0, left: 30 } },
        children: [createSlotBlock()],
      }),
    ]);
    expect(await boundary((w) => doc([probeImage(w)]), layout)).toEqual({
      room: 520,
      atRoom: true,
      underRoom: false,
    });
    // (540 − 40) × 50% − 20.
    expect(
      await boundary((w) => doc([section("2", 1, probeImage(w))]), layout),
    ).toEqual({ room: 230, atRoom: true, underRoom: false });
  });

  it("the image's own border counts against the room", async () => {
    const border = uniformBorder({
      width: 4,
      style: "solid",
      color: "#000000",
    });
    expect(
      await boundary((w) => doc([section("2", 0, probeImage(w, { border }))])),
    ).toEqual({ room: 252, atRoom: true, underRoom: false });
  });

  it("columns that don't stack on phones", async () => {
    expect(
      await boundary((w) =>
        doc([section("2", 0, probeImage(w), { stackOnMobile: false })]),
      ),
    ).toEqual({ room: 260, atRoom: true, underRoom: false });
  });

  it("a body width other than 600", async () => {
    expect(
      await boundary((w) => doc([section("2", 0, probeImage(w))], 640)),
    ).toEqual({ room: 280, atRoom: true, underRoom: false });
  });
});

describe("video thumbnails follow the same rule", () => {
  const video = (width: ImageBlock["width"]) =>
    createVideoBlock({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      thumbnailUrl: PROBE,
      width,
    });

  it("full-width fills, a narrow one keeps its width", async () => {
    expect(isFluid(await compile(doc([video("full")])))).toBe(true);
    expect(isFluid(await compile(doc([video(120)])))).toBe(false);
  });

  it("fills at exactly the room in a two-column section", async () => {
    expect(await boundary((w) => doc([section("2", 0, video(w))]))).toEqual({
      room: 260,
      atRoom: true,
      underRoom: false,
    });
  });
});

describe("custom block renderers", () => {
  it("an mj-image a custom renderer emits is not made fluid behind its back", async () => {
    const mjml = await renderToMjml(doc([probeImage(120)]), {
      blockRenderers: {
        image: (block) =>
          `<mj-image src="${(block as ImageBlock).src}" width="120px" />`,
      },
    });
    const { html } = await mjml2html(mjml);
    expect(isFluid(html)).toBe(false);
  });

  it("can apply the built-in rule with the exported helper", async () => {
    const content = doc([section("2", 0, probeImage(260))]);
    const mjml = await renderToMjml(content, {
      blockRenderers: {
        image: (block, ctx) => {
          const image = block as ImageBlock;
          return `<mj-image src="${image.src}" width="${image.width}px"${fluidOnMobileAttr(image, ctx)} />`;
        },
      },
    });
    const { html } = await mjml2html(mjml);
    expect(isFluid(html)).toBe(true);
    expect(isFluid(await compile(content))).toBe(true);
  });
});
