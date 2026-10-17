import { describe, expect, it } from "vitest";
import { renderToMjml } from "@templatical/renderer";
import {
  createDefaultTemplateContent,
  createImageBlock,
  createSectionBlock,
  uniformBorder,
} from "@templatical/types";
import type {
  Block,
  ImageBlock,
  SectionBlock,
  TemplateContent,
} from "@templatical/types";
import { convertMjmlTemplate } from "../converter";

/**
 * `fluid-on-mobile` has no field: the renderer sets it only on an image that
 * fills its column on desktop. A source image set narrower than its column
 * that asks for it is therefore approximated, and says so.
 */

function mjml(image: string, head = ""): string {
  return `<mjml><mj-head>${head}</mj-head><mj-body width="600px">
  <mj-section padding="0px"><mj-column>${image}</mj-column></mj-section>
</mj-body></mjml>`;
}

function imageEntry(source: string) {
  const { content, report } = convertMjmlTemplate(source);
  const entries = report.entries.filter((e) => e.sourceTag === "mj-image");
  expect(entries).toHaveLength(1);
  const section = content.blocks[0] as SectionBlock;
  return { entry: entries[0], block: section.children[0][0] as ImageBlock };
}

describe("a source fluid-on-mobile", () => {
  it("is approximated on an image narrower than its column", () => {
    const { entry, block } = imageEntry(
      mjml(
        '<mj-image src="https://cdn.test/logo.png" width="120px" fluid-on-mobile="true" />',
      ),
    );
    expect(block.width).toBe(120);
    expect(entry.status).toBe("approximated");
    expect(entry.note).toBe(
      "fluid-on-mobile on a 120px image narrower than its column has no Templatical equivalent: the image keeps its width on phones instead of filling the column.",
    );
  });

  it("is approximated when it comes from mj-attributes", () => {
    const { entry } = imageEntry(
      mjml(
        '<mj-image src="https://cdn.test/logo.png" width="120px" />',
        '<mj-attributes><mj-image fluid-on-mobile="true" /></mj-attributes>',
      ),
    );
    expect(entry.status).toBe("approximated");
  });

  it("is converted on a full-width image", () => {
    const { entry, block } = imageEntry(
      mjml(
        '<mj-image src="https://cdn.test/hero.png" fluid-on-mobile="true" />',
      ),
    );
    expect(block.width).toBe("full");
    expect(entry.status).toBe("converted");
  });

  it("is converted on a px width at the room, where the renderer sets it too", () => {
    // 600 less the image's MJML-default 25px sides is 550.
    const { entry, block } = imageEntry(
      mjml(
        '<mj-image src="https://cdn.test/hero.png" width="550px" padding="10px 25px" fluid-on-mobile="true" />',
      ),
    );
    expect(block.width).toBe("full");
    expect(entry.status).toBe("converted");
  });

  it("is approximated one pixel under the room", () => {
    const { entry } = imageEntry(
      mjml(
        '<mj-image src="https://cdn.test/hero.png" width="549px" padding="10px 25px" fluid-on-mobile="true" />',
      ),
    );
    expect(entry.status).toBe("approximated");
  });

  it('is ignored when "false" or absent', () => {
    for (const attr of [' fluid-on-mobile="false"', ""]) {
      const { entry } = imageEntry(
        mjml(
          `<mj-image src="https://cdn.test/logo.png" width="120px"${attr} />`,
        ),
      );
      expect(entry.status).toBe("converted");
    }
  });
});

describe("the renderer's own output re-imports as converted at the room", () => {
  function doc(blocks: Block[]): TemplateContent {
    return { ...createDefaultTemplateContent(), blocks };
  }

  function section(
    columns: SectionBlock["columns"],
    image: ImageBlock,
    partial: Partial<SectionBlock> = {},
  ): SectionBlock {
    const count = { "1": 1, "2": 2, "3": 3, "1-2": 2, "2-1": 2 }[columns];
    const children: Block[][] = Array.from({ length: count }, () => []);
    children[0] = [image];
    return createSectionBlock({ columns, children, ...partial });
  }

  async function roundTrip(content: TemplateContent) {
    const mjmlOut = await renderToMjml(content);
    const { report, content: back } = convertMjmlTemplate(mjmlOut);
    const image = (back.blocks[0] as SectionBlock).children[0][0] as ImageBlock;
    return {
      fluid: mjmlOut.includes('fluid-on-mobile="true"'),
      statuses: report.entries
        .filter((e) => e.sourceTag === "mj-image")
        .map((e) => e.status),
      width: image.width,
    };
  }

  // Rooms from renderer/tests/mjml-image-fluid-on-mobile.test.ts, which reads
  // them back from MJML itself.
  const cases: Array<[string, number, (w: number) => TemplateContent]> = [
    [
      "padded, bordered two-column section",
      252,
      (w) =>
        doc([
          section(
            "2",
            createImageBlock({ src: "https://cdn.test/a.png", width: w }),
            {
              styles: { padding: { top: 0, right: 25, bottom: 0, left: 25 } },
              border: uniformBorder({
                width: 3,
                style: "solid",
                color: "#000000",
              }),
            },
          ),
        ]),
    ],
    [
      "section inside a wrapper band",
      440,
      (w) =>
        doc([
          section(
            "1",
            createImageBlock({ src: "https://cdn.test/a.png", width: w }),
            {
              wrapper: { padding: { top: 0, right: 50, bottom: 0, left: 50 } },
            },
          ),
        ]),
    ],
    [
      "first of three columns, 33.33% of 600",
      179,
      (w) =>
        doc([
          section(
            "3",
            createImageBlock({ src: "https://cdn.test/a.png", width: w }),
            {
              styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
            },
          ),
        ]),
    ],
  ];

  it.each(cases)("%s", async (_name, room, build) => {
    // At the room the image fills its column, so it comes back as "full".
    const at = await roundTrip(build(room));
    expect(at).toEqual({ fluid: true, statuses: ["converted"], width: "full" });

    const under = await roundTrip(build(room - 1));
    expect(under).toEqual({
      fluid: false,
      statuses: ["converted"],
      width: room - 1,
    });
  });
});
