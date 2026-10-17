import { describe, expect, it } from "vitest";
import { getWidthPercentages, renderToMjml } from "@templatical/renderer";
import {
  createBackgroundImage,
  createDefaultTemplateContent,
  createImageBlock,
  createSectionBlock,
  createSlotBlock,
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
import { imageRoom, sectionBandWidth } from "../src/utils/imageRoom";

/**
 * `imageRoom` must agree with the renderer to the pixel: the aspect-ratio lock
 * clamps a height-led width at the room, and the renderer starts filling the
 * phone column (`fluid-on-mobile`) at exactly that width. Each case checks the
 * util's room against the renderer's own boundary.
 */

const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };

function doc(blocks: Block[], width = 600): TemplateContent {
  const content = createDefaultTemplateContent();
  return { ...content, settings: { ...content.settings, width }, blocks };
}

function image(width: ImageBlock["width"], partial: Partial<ImageBlock> = {}) {
  return createImageBlock({
    id: "probe",
    src: "https://cdn.test/p.png",
    width,
    ...partial,
  });
}

function section(
  columns: ColumnLayout,
  index: number,
  probe: Block,
  partial: Partial<SectionBlock> = {},
): SectionBlock {
  const count = getWidthPercentages(columns).length;
  const children: Block[][] = Array.from({ length: count }, () => []);
  children[index] = [probe];
  return createSectionBlock({ columns, children, ...partial });
}

async function fluidAt(
  build: (width: number) => TemplateContent,
  width: number,
  layout?: TemplateContent,
): Promise<boolean> {
  const mjml = await renderToMjml(build(width), { layout });
  return mjml.includes('fluid-on-mobile="true"');
}

const cases: Array<
  [string, number, (width: number) => TemplateContent, TemplateContent?]
> = [
  ["top-level image", 580, (w) => doc([image(w)])],
  [
    "two columns, default section padding",
    260,
    (w) => doc([section("2", 0, image(w))]),
  ],
  [
    "first of three columns at 33.33%",
    179,
    (w) => doc([section("3", 0, image(w), { styles: { padding: ZERO } })]),
  ],
  [
    "last of three columns at 33.34%",
    180,
    (w) => doc([section("3", 2, image(w), { styles: { padding: ZERO } })]),
  ],
  [
    "wide column of 1-2",
    380,
    (w) => doc([section("1-2", 1, image(w), { styles: { padding: ZERO } })]),
  ],
  [
    "padded, bordered section",
    252,
    (w) =>
      doc([
        section("2", 0, image(w), {
          styles: { padding: { top: 0, right: 25, bottom: 0, left: 25 } },
          border: uniformBorder({ width: 3, style: "solid", color: "#000" }),
        }),
      ]),
  ],
  [
    "section wrapper band",
    440,
    (w) =>
      doc([
        section("1", 0, image(w), {
          wrapper: { padding: { top: 0, right: 50, bottom: 0, left: 50 } },
        }),
      ]),
  ],
  [
    "bordered image",
    252,
    (w) =>
      doc([
        section(
          "2",
          0,
          image(w, {
            border: uniformBorder({ width: 4, style: "solid", color: "#000" }),
          }),
        ),
      ]),
  ],
  [
    // A hero hides its section's border (and draws none), so only the band
    // and the hero's padding narrow its content: 600 − 40 − 48 − 20.
    "padded, bordered hero in a band",
    492,
    (w) =>
      doc([
        section("1", 0, image(w), {
          styles: { padding: { top: 48, right: 24, bottom: 48, left: 24 } },
          border: uniformBorder({ width: 3, style: "solid", color: "#000" }),
          wrapper: { padding: { top: 0, right: 20, bottom: 0, left: 20 } },
          backgroundImage: createBackgroundImage("https://cdn.test/hero.jpg"),
          hero: { height: 300, verticalAlign: "middle" },
        }),
      ]),
  ],
  [
    // Without an image the hero doesn't apply: a regular, bordered section.
    "hero that doesn't apply",
    486,
    (w) =>
      doc([
        section("1", 0, image(w), {
          styles: { padding: { top: 48, right: 24, bottom: 48, left: 24 } },
          border: uniformBorder({ width: 3, style: "solid", color: "#000" }),
          wrapper: { padding: { top: 0, right: 20, bottom: 0, left: 20 } },
          hero: { height: 300, verticalAlign: "middle" },
        }),
      ]),
  ],
  ["body width 640", 280, (w) => doc([section("2", 0, image(w))], 640)],
  [
    // The band is searched first and holds no image, so its padding must not
    // narrow the content that follows it.
    "after a layout header band",
    260,
    (w) => doc([section("2", 0, image(w))]),
    doc([
      createWrapperBlock({
        styles: { padding: { top: 0, right: 30, bottom: 0, left: 30 } },
        children: [createSectionBlock({ columns: "1", children: [[]] })],
      }),
      createSlotBlock(),
    ]),
  ],
  [
    "inside a layout wrapper",
    230,
    (w) => doc([section("2", 1, image(w))]),
    doc([
      createWrapperBlock({
        styles: { padding: { top: 0, right: 30, bottom: 0, left: 30 } },
        children: [createSlotBlock()],
      }),
    ]),
  ],
];

describe("imageRoom", () => {
  it.each(cases)(
    "%s matches the renderer",
    async (_name, room, build, layout) => {
      expect(imageRoom(build(100), "probe", layout)).toBe(room);
      expect(await fluidAt(build, room, layout)).toBe(true);
      expect(await fluidAt(build, room - 1, layout)).toBe(false);
    },
  );

  it("is null for a block that isn't in the content", () => {
    expect(imageRoom(doc([image(120)]), "missing")).toBeNull();
  });

  it("ignores a layout that can't be applied", () => {
    // No slot, so applyLayout throws; the room falls back to the content.
    const broken = doc([createWrapperBlock({ children: [] })]);
    expect(imageRoom(doc([image(120)]), "probe", broken)).toBe(580);
  });

  it("uses the renderer's column percentages", () => {
    for (const layout of ["1", "2", "3", "1-2", "2-1"] as ColumnLayout[]) {
      const percents = getWidthPercentages(layout).map(parseFloat);
      percents.forEach((percent, index) => {
        const content = doc([
          section(layout, index, image(100), { styles: { padding: ZERO } }),
        ]);
        expect(imageRoom(content, "probe")).toBe(
          Math.floor((600 * percent) / 100) - 20,
        );
      });
    }
  });
});

describe("sectionBandWidth", () => {
  const band = (left: number, right = left) => ({
    top: 0,
    right,
    bottom: 0,
    left,
  });
  const card = (padding: ReturnType<typeof band>, children: Block[]) =>
    createWrapperBlock({ styles: { padding }, children });

  function heroDoc(partial: Partial<SectionBlock> = {}): TemplateContent {
    return doc([
      createSectionBlock({
        id: "hero",
        children: [[]],
        backgroundImage: createBackgroundImage("https://cdn.test/hero.jpg"),
        hero: { height: 300, verticalAlign: "middle" },
        ...partial,
      }),
    ]);
  }

  async function rendererBox(
    content: TemplateContent,
    layout?: TemplateContent,
  ): Promise<number> {
    const mjml = await renderToMjml(content, { layout });
    const width = /<mj-hero[^>]*background-width="(\d+)px"/.exec(mjml);
    expect(width).not.toBeNull();
    return Number(width![1]);
  }

  const cases: Array<[string, number, TemplateContent, TemplateContent?]> = [
    ["top level", 600, heroDoc()],
    ["section wrapper", 560, heroDoc({ wrapper: { padding: band(20) } })],
    [
      "layout card",
      540,
      heroDoc(),
      doc([card(band(30), [createSlotBlock()])]),
    ],
    [
      "a fractional band, floored",
      559,
      heroDoc({ wrapper: { padding: band(20.5, 20) } }),
    ],
  ];

  it.each(cases)(
    "%s matches the renderer's hero box",
    async (_name, width, content, layout) => {
      expect(sectionBandWidth(content, "hero", layout)).toBe(width);
      expect(await rendererBox(content, layout)).toBe(width);
    },
  );

  it("is null for a section that isn't in the content", () => {
    expect(sectionBandWidth(heroDoc(), "missing")).toBeNull();
  });
});
