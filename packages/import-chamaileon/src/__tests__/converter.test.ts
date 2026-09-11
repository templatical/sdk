/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type {
  ButtonBlock,
  ParagraphBlock,
  SectionBlock,
  TitleBlock,
} from "@templatical/types";
import { convertChamaileonTemplate } from "../converter";
import type { ChamaileonDocument } from "../types";
import { NEWSLETTER } from "./fixtures/newsletter";

const EMPTY_DOC: ChamaileonDocument = {
  body: {
    eid: "root",
    type: "body",
    children: [],
    style: { bodyWidth: 600, backgroundColor: "#ffffff" },
    version: "4.1.0",
  },
};

const INVALID_MESSAGE =
  "Invalid Chamaileon template: expected the document JSON object from getDocument().";
const WRONG_BODY_MESSAGE =
  'Invalid Chamaileon template: expected body.type to be "body".';

describe("convertChamaileonTemplate input guards", () => {
  it("throws a typed message for a non-object input", () => {
    expect(() => convertChamaileonTemplate(42 as never)).toThrow(
      INVALID_MESSAGE,
    );
  });

  it("throws the same message for unparseable JSON", () => {
    expect(() => convertChamaileonTemplate("{")).toThrow(INVALID_MESSAGE);
  });

  it("throws when body.type is missing", () => {
    expect(() =>
      convertChamaileonTemplate({ body: { children: [] } } as never),
    ).toThrow(WRONG_BODY_MESSAGE);
  });

  it("throws on an Unlayer-shaped object rather than importing it", () => {
    expect(() =>
      convertChamaileonTemplate({ body: { rows: [] } } as never),
    ).toThrow(WRONG_BODY_MESSAGE);
  });

  it("accepts a JSON string and parses it", () => {
    const { content } = convertChamaileonTemplate(JSON.stringify(EMPTY_DOC));
    expect(content.blocks).toEqual([]);
  });

  it("warns when the document has no convertible content", () => {
    const { report } = convertChamaileonTemplate(EMPTY_DOC);
    expect(report.warnings).toEqual([
      "No convertible content was found in the Chamaileon document. Check that body.children holds at least one fullwidth.",
    ]);
    expect(report.summary).toEqual({
      total: 0,
      converted: 0,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
  });

  it("defaults every setting when the document declares none", () => {
    const { content } = convertChamaileonTemplate({
      body: { eid: "root", type: "body", children: [] },
    });
    expect(content.settings.width).toBe(600);
    expect(content.settings.backgroundColor).toBe("#ffffff");
    expect(content.settings.fontFamily).toBe("Arial");
    expect(content.settings.textColor).toBe("#1a1a1a");
    expect("preheaderText" in content.settings).toBe(false);
  });
});

const CORPUS = "/tmp/chamaileon-corpus/welcome-email.json";

function sectionsOf(
  blocks: ReturnType<typeof convertChamaileonTemplate>["content"]["blocks"],
): SectionBlock[] {
  return blocks.filter((b): b is SectionBlock => b.type === "section");
}

function leavesOf(sections: SectionBlock[]) {
  return sections.flatMap((section) => section.children.flat());
}

describe("convertChamaileonTemplate end to end", () => {
  it("reads width, background, and preheader from the document", () => {
    const { content } = convertChamaileonTemplate(NEWSLETTER);
    expect(content.settings.width).toBe(600);
    expect(content.settings.backgroundColor).toBe("#f4f4f4");
    expect(content.settings.preheaderText).toBe("Hello");
    expect(content.settings.fontFamily).toBe("Arial");
    expect(content.settings.textColor).toBe("#1a1a1a");
    expect(content.settings.linkUnderline).toBe(true);
    expect(content.settings.locale).toBe("en");
  });

  it("puts a filled teal button in the first section, not factory #333333", () => {
    const { content } = convertChamaileonTemplate(NEWSLETTER);
    const first = sectionsOf(content.blocks)[0];
    const button = first.children
      .flat()
      .find((b): b is ButtonBlock => b.type === "button");
    expect(button?.backgroundColor).toBe("#00a591");
    expect(button?.textColor).toBe("#ffffff");
    expect(button?.borderRadius).toBe(5);
    expect(button?.backgroundColor).not.toBe("#333333");
  });

  it("produces a 2-column section from 300/300", () => {
    const { content } = convertChamaileonTemplate(NEWSLETTER);
    const two = sectionsOf(content.blocks).find(
      (section) =>
        section.columns === "2" &&
        section.children[0]?.some(
          (b) =>
            b.type === "paragraph" &&
            (b as ParagraphBlock).content === "<p>Left</p>",
        ),
    );
    expect(two?.columns).toBe("2");
    expect(two?.children).toHaveLength(2);
  });

  it("folds a 4-col section onto columns 3 as approximated", () => {
    const { content, report } = convertChamaileonTemplate(NEWSLETTER);
    const folded = sectionsOf(content.blocks).find(
      (section) => section.columns === "3",
    );
    expect(folded?.columns).toBe("3");
    expect(folded?.children).toHaveLength(3);
    expect(folded?.children[2]).toHaveLength(2);

    const entry = report.entries.find(
      (e) =>
        e.sourceTag === "fullwidth" &&
        e.status === "approximated" &&
        (e.note ?? "").includes("150px"),
    );
    expect(entry?.templaticalBlockType).toBe("section");
    expect(entry?.status).toBe("approximated");
  });

  it("does not produce a nested type: section for a nested multicolumn", () => {
    const { content, report } = convertChamaileonTemplate(NEWSLETTER);
    for (const block of content.blocks) {
      if (block.type !== "section") continue;
      expect(
        (block as SectionBlock).children.flat().map((child) => child.type),
      ).not.toContain("section");
    }
    const nested = report.entries.find(
      (e) => e.note === "nested multicolumn flattened (3 columns)",
    );
    expect(nested?.sourceTag).toBe("multicolumn");
    expect(nested?.status).toBe("approximated");
  });

  it("skips an empty block-level-loop and names the type and expression", () => {
    const { report } = convertChamaileonTemplate(NEWSLETTER);
    const skipped = report.entries.find(
      (e) => e.sourceTag === "block-level-loop",
    );
    expect(skipped?.status).toBe("skipped");
    expect(skipped?.templaticalBlockType).toBeNull();
    expect(skipped?.note).toContain("block-level-loop");
    expect(skipped?.note).toContain("items");
  });

  it("maps a 2.0 kebab-case button in the same tree", () => {
    const { content } = convertChamaileonTemplate(NEWSLETTER);
    const kebab = leavesOf(sectionsOf(content.blocks)).find(
      (b): b is ButtonBlock =>
        b.type === "button" && (b as ButtonBlock).text === "Download the App",
    );
    expect(kebab?.backgroundColor).toBe("#00a591");
    expect(kebab?.borderRadius).toBe(5);
    expect(kebab?.url).toBe("https://x.test");
  });

  it("maps a sole h1 text node to a title", () => {
    const { content } = convertChamaileonTemplate(NEWSLETTER);
    const title = leavesOf(sectionsOf(content.blocks)).find(
      (b): b is TitleBlock => b.type === "title",
    );
    expect(title?.content).toBe("Welcome");
    expect(title?.level).toBe(1);
  });

  it("does not keep factory #333333 on the outlined button", () => {
    const { content, report } = convertChamaileonTemplate(NEWSLETTER);
    const outlined = leavesOf(sectionsOf(content.blocks)).find(
      (b): b is ButtonBlock =>
        b.type === "button" && (b as ButtonBlock).text === "Outline",
    );
    expect(outlined?.backgroundColor).toBe("#ffffff");
    expect(outlined?.backgroundColor).not.toBe("#333333");
    const entry = report.entries.find(
      (e) => e.sourceTag === "button" && e.status === "approximated",
    );
    expect(entry?.note).toMatch(/outlined/i);
  });

  it("unwraps a { reference, default } colour and warns once", () => {
    const { content, report } = convertChamaileonTemplate(NEWSLETTER);
    const details = leavesOf(sectionsOf(content.blocks)).find(
      (b): b is ButtonBlock =>
        b.type === "button" && (b as ButtonBlock).text === "Details",
    );
    expect(details?.backgroundColor).toBe("#5c9aeb");
    expect(report.warnings).toEqual([
      "Resolved 1 colour/image variables to their default values.",
    ]);
  });
});

describe("convertChamaileonTemplate loops", () => {
  it("converts a loop's fullwidth child and marks produced entries approximated", () => {
    const { content, report } = convertChamaileonTemplate({
      body: {
        eid: "root",
        type: "body",
        children: [
          {
            type: "block-level-loop",
            attrs: { expression: "products" },
            children: [
              {
                type: "fullwidth",
                children: [{ type: "text", attrs: { text: "<p>Row</p>" } }],
              },
            ],
          },
        ],
      },
    });

    expect(content.blocks).toHaveLength(1);
    expect(content.blocks[0].type).toBe("section");
    const paragraph = (content.blocks[0] as SectionBlock).children[0][0] as
      ParagraphBlock | undefined;
    expect(paragraph?.content).toBe("<p>Row</p>");

    const fullwidth = report.entries.find((e) => e.sourceTag === "fullwidth");
    expect(fullwidth?.status).toBe("approximated");
    expect(fullwidth?.note).toContain("block-level-loop");
    expect(fullwidth?.note).toContain("products");
    expect(
      report.entries.filter((e) => e.sourceTag === "block-level-loop"),
    ).toEqual([]);
  });

  it("converts a loop inside a column as if the wrapper were absent", () => {
    const { content, report } = convertChamaileonTemplate({
      body: {
        eid: "root",
        type: "body",
        children: [
          {
            type: "fullwidth",
            children: [
              {
                type: "loop",
                attrs: { expression: "user.vip" },
                children: [{ type: "text", attrs: { text: "<p>VIP</p>" } }],
              },
            ],
          },
        ],
      },
    });

    const paragraph = (content.blocks[0] as SectionBlock).children[0][0] as
      ParagraphBlock | undefined;
    expect(paragraph?.type).toBe("paragraph");
    expect(paragraph?.content).toBe("<p>VIP</p>");
    const textEntry = report.entries.find((e) => e.sourceTag === "text");
    expect(textEntry?.status).toBe("approximated");
    expect(textEntry?.note).toContain("loop");
    expect(textEntry?.note).toContain("user.vip");
    expect(textEntry?.templaticalBlockType).toBe("paragraph");
  });
});

describe("convertChamaileonTemplate document warnings", () => {
  it("warns once when subjectLine is non-empty", () => {
    const { report } = convertChamaileonTemplate({
      subjectLine: "Welcome",
      body: { eid: "root", type: "body", children: [] },
    });
    expect(report.warnings).toEqual([
      'Dropped subjectLine ("Welcome") — Templatical templates have no subject-line field.',
      "No convertible content was found in the Chamaileon document. Check that body.children holds at least one fullwidth.",
    ]);
  });

  it("warns once when fontFiles is a non-empty object", () => {
    const { report } = convertChamaileonTemplate({
      fontFiles: { Custom: "https://cdn.test/custom.woff2" },
      body: { eid: "root", type: "body", children: [] },
    });
    expect(report.warnings).toEqual([
      "Dropped fontFiles — Templatical templates have no document-level font-file table.",
      "No convertible content was found in the Chamaileon document. Check that body.children holds at least one fullwidth.",
    ]);
  });

  it("converts a top-level leaf that is not a fullwidth", () => {
    const { content, report } = convertChamaileonTemplate({
      body: {
        eid: "root",
        type: "body",
        children: [
          {
            type: "button",
            attrs: { text: "Hi", href: "https://x.test" },
            style: { backgroundColor: "#00a591" },
          },
        ],
      },
    });
    const button = content.blocks[0] as ButtonBlock;
    expect(button.type).toBe("button");
    expect(button.backgroundColor).toBe("#00a591");
    expect(report.entries[0]).toEqual({
      sourceTag: "button",
      templaticalBlockType: "button",
      status: "converted",
    });
  });
});

describe("convertChamaileonTemplate corpus smoke", () => {
  it.skipIf(!existsSync(CORPUS))(
    "imports welcome-email into 10 sections with a teal hero button",
    () => {
      const doc = JSON.parse(
        readFileSync(CORPUS, "utf8"),
      ) as ChamaileonDocument;
      const { content } = convertChamaileonTemplate(doc);
      const sections = sectionsOf(content.blocks);
      expect(sections).toHaveLength(10);
      const hero = leavesOf(sections).find(
        (b): b is ButtonBlock =>
          b.type === "button" &&
          (b as ButtonBlock).backgroundColor === "#00a591" &&
          (b as ButtonBlock).textColor === "#ffffff" &&
          (b as ButtonBlock).borderRadius === 5,
      );
      expect(hero?.backgroundColor).toBe("#00a591");
      expect(hero?.textColor).toBe("#ffffff");
      expect(hero?.borderRadius).toBe(5);
    },
  );
});
