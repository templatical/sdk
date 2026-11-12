import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createDefaultTemplateContent,
  createImageBlock,
  createParagraphBlock,
  createSectionBlock,
  getColumnCount,
  type ColumnLayout,
  type SectionBlock,
  type TemplateContent,
} from "@templatical/types";
import { renderToMjml } from "../src";

const LAYOUTS: ColumnLayout[] = [
  "1",
  "2",
  "3",
  "4",
  "1-2",
  "2-1",
  "1-3",
  "3-1",
  "1-2-1",
];

const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };

function content(blocks: TemplateContent["blocks"]): TemplateContent {
  const base = createDefaultTemplateContent();
  return { ...base, settings: { ...base.settings, width: 600 }, blocks };
}

function sectionOf(
  columns: ColumnLayout,
  partial: Partial<SectionBlock> = {},
): SectionBlock {
  const count = getColumnCount(columns);
  const children = Array.from({ length: count }, (_, index) => [
    createParagraphBlock({ content: `<p>COL${index}</p>` }),
    createImageBlock({
      src: "https://example.com/photo.png",
      alt: "Photo",
      width: "full",
      styles: { padding: ZERO },
    }),
  ]);
  return createSectionBlock({
    columns,
    children,
    styles: { padding: ZERO },
    ...partial,
  });
}

function columnWidthAttrs(mjml: string): string[] {
  return [...mjml.matchAll(/<mj-column width="([^"]+)"/g)].map(
    (match) => match[1],
  );
}

/**
 * HEAD's preset output at 600px with no section padding and no image padding.
 * Container px is the floored column box (`600 / 3` is 200). Content width is
 * the emitted percentage of that 600, floored (`33.33%` is 199). With no image
 * padding the image room is that content width: a pixel image of that width
 * is fluid, and one pixel less is not. A full image's `width` is the container px.
 */
const PRESET_AT_600: Record<
  ColumnLayout,
  {
    widths: string[];
    containerPx: number[];
    contentWidth: number[];
    imageRoom: number[];
  }
> = {
  "1": {
    widths: ["100%"],
    containerPx: [600],
    contentWidth: [600],
    imageRoom: [600],
  },
  "2": {
    widths: ["50%", "50%"],
    containerPx: [300, 300],
    contentWidth: [300, 300],
    imageRoom: [300, 300],
  },
  "3": {
    widths: ["33.33%", "33.33%", "33.34%"],
    containerPx: [200, 200, 200],
    contentWidth: [199, 199, 200],
    imageRoom: [199, 199, 200],
  },
  "4": {
    widths: ["25%", "25%", "25%", "25%"],
    containerPx: [150, 150, 150, 150],
    contentWidth: [150, 150, 150, 150],
    imageRoom: [150, 150, 150, 150],
  },
  "1-2": {
    widths: ["33.33%", "66.67%"],
    containerPx: [200, 400],
    contentWidth: [199, 400],
    imageRoom: [199, 400],
  },
  "2-1": {
    widths: ["66.67%", "33.33%"],
    containerPx: [400, 200],
    contentWidth: [400, 199],
    imageRoom: [400, 199],
  },
  "1-3": {
    widths: ["25%", "75%"],
    containerPx: [150, 450],
    contentWidth: [150, 450],
    imageRoom: [150, 450],
  },
  "3-1": {
    widths: ["75%", "25%"],
    containerPx: [450, 150],
    contentWidth: [450, 150],
    imageRoom: [450, 150],
  },
  "1-2-1": {
    widths: ["25%", "50%", "25%"],
    containerPx: [150, 300, 150],
    contentWidth: [150, 300, 150],
    imageRoom: [150, 300, 150],
  },
};

describe("preset sections without columnWidths", () => {
  it.each(LAYOUTS)(
    "renders %s with the preset percentages, container px, content width and image room",
    async (layout) => {
      const expected = PRESET_AT_600[layout];
      const children = expected.imageRoom.map((room, index) => [
        createParagraphBlock({ content: `<p>COL${index}</p>` }),
        createImageBlock({
          src: `https://example.com/full-${index}.png`,
          alt: "Full",
          width: "full",
          styles: { padding: ZERO },
        }),
        createImageBlock({
          src: `https://example.com/room-${index}.png`,
          alt: "Room",
          width: room,
          styles: { padding: ZERO },
        }),
        createImageBlock({
          src: `https://example.com/under-${index}.png`,
          alt: "Under",
          width: room - 1,
          styles: { padding: ZERO },
        }),
      ]);
      const mjml = await renderToMjml(
        content([
          createSectionBlock({
            columns: layout,
            children,
            styles: { padding: ZERO },
          }),
        ]),
      );
      const tags = mjml.match(/<mj-image[\s\S]*?\/>/g) ?? [];

      expect(columnWidthAttrs(mjml)).toEqual(expected.widths);
      expect(expected.contentWidth).toEqual(expected.imageRoom);
      for (let index = 0; index < expected.containerPx.length; index++) {
        const full = tags.find((tag) => tag.includes(`full-${index}.png`));
        const room = tags.find((tag) => tag.includes(`room-${index}.png`));
        const under = tags.find((tag) => tag.includes(`under-${index}.png`));
        expect(full).toContain(`width="${expected.containerPx[index]}px"`);
        expect(room).toContain(`width="${expected.contentWidth[index]}px"`);
        expect(room).toContain('fluid-on-mobile="true"');
        expect(under).toContain(`width="${expected.imageRoom[index]! - 1}px"`);
        expect(under).not.toContain("fluid-on-mobile");
      }
    },
  );
});

describe("custom column widths", () => {
  it("emits 25% / 25% / 50% for [25, 25, 50]", async () => {
    const mjml = await renderToMjml(
      content([sectionOf("3", { columnWidths: [25, 25, 50] })]),
    );
    expect(columnWidthAttrs(mjml)).toEqual(["25%", "25%", "50%"]);
  });

  it("emits 50% / 33.33% / 16.67% for [50, 33.33, 16.67]", async () => {
    const mjml = await renderToMjml(
      content([sectionOf("3", { columnWidths: [50, 33.33, 16.67] })]),
    );
    expect(columnWidthAttrs(mjml)).toEqual(["50%", "33.33%", "16.67%"]);
  });

  it("renders an ignored override as the preset", async () => {
    const preset = await renderToMjml(content([sectionOf("3")]));
    const ignored = await renderToMjml(
      content([sectionOf("3", { columnWidths: [50, 50] })]),
    );
    expect(ignored).toBe(preset);
  });

  it("wraps custom widths in mj-group when stackOnMobile is false", async () => {
    const mjml = await renderToMjml(
      content([
        sectionOf("3", {
          columnWidths: [25, 25, 50],
          stackOnMobile: false,
        }),
      ]),
    );
    expect(mjml).toContain("<mj-group>");
    expect(columnWidthAttrs(mjml)).toEqual(["25%", "25%", "50%"]);
  });

  it("gives an image in a custom column the room of that percentage", async () => {
    const narrow = createImageBlock({
      src: "https://example.com/photo.png",
      alt: "Photo",
      width: 100,
      styles: { padding: ZERO },
    });
    const under = createImageBlock({
      src: "https://example.com/under.png",
      alt: "Under",
      width: 99,
      styles: { padding: ZERO },
    });
    const full = createImageBlock({
      src: "https://example.com/full.png",
      alt: "Full",
      width: "full",
      styles: { padding: ZERO },
    });
    const children = [[], [], [narrow, under, full]];
    const mjml = await renderToMjml(
      content([
        createSectionBlock({
          columns: "3",
          columnWidths: [50, 33.33, 16.67],
          children,
          styles: { padding: ZERO },
        }),
      ]),
    );

    expect(columnWidthAttrs(mjml)).toEqual(["50%", "33.33%", "16.67%"]);
    expect(mjml).toContain('src="https://example.com/photo.png"');
    const tags = mjml.match(/<mj-image[\s\S]*?\/>/g) ?? [];
    const photo = tags.find((tag) => tag.includes("photo.png"));
    const short = tags.find((tag) => tag.includes("under.png"));
    const filled = tags.find((tag) => tag.includes("full.png"));
    // 16.67% of 600 is 100.02, and the column content floors to 100.
    expect(photo).toContain('width="100px"');
    expect(photo).toContain('fluid-on-mobile="true"');
    expect(short).toContain('width="99px"');
    expect(short).not.toContain("fluid-on-mobile");
    expect(filled).toContain('width="100px"');
    expect(filled).toContain('fluid-on-mobile="true"');
  });
});

describe("custom column widths through mjml", () => {
  async function compiledClasses(
    stackOnMobile: boolean | undefined,
  ): Promise<string[]> {
    const mjml = await renderToMjml(
      content([
        sectionOf("3", {
          columnWidths: [50, 33.33, 16.67],
          ...(stackOnMobile === false ? { stackOnMobile: false } : {}),
        }),
      ]),
    );
    const { html, errors } = await mjml2html(mjml);
    expect(errors).toEqual([]);
    return [...html.matchAll(/mj-column-per-([0-9-]+)/g)].map(
      (match) => match[1],
    );
  }

  function shares(classes: string[]): string[] {
    return [...new Set(classes.filter((name) => name !== "100"))];
  }

  it("compiles 50 / 33.33 / 16.67 for a stacking section", async () => {
    const classes = await compiledClasses(undefined);
    expect(classes).toEqual(
      expect.arrayContaining(["50", "33-33", "16-67"]),
    );
    expect(shares(classes)).toEqual(["50", "33-33", "16-67"]);
  });

  it("compiles the same shares inside mj-group", async () => {
    const classes = await compiledClasses(false);
    expect(classes).toContain("100");
    expect(shares(classes)).toEqual(["50", "33-33", "16-67"]);
  });
});
