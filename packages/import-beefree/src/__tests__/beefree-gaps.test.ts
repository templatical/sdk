import { describe, expect, it } from "vitest";
import { sourceHash, type Block, type SectionBlock } from "@templatical/types";
import { convertModule } from "../block-mapper";
import { convertBeeFreeTemplate } from "../converter";
import type { BeeFreeeModule, BeeFreeTemplate } from "../types";
import { expectLinear } from "./expectLinear";

function textModule(html: string): BeeFreeeModule {
  return {
    type: "mailup-bee-newsletter-modules-text",
    descriptor: { text: { html } },
  };
}

function imageModule(flags: Record<string, unknown>): BeeFreeeModule {
  return {
    type: "mailup-bee-newsletter-modules-image",
    descriptor: {
      image: {
        alt: "",
        src: "https://example.com/portrait.png",
        href: "",
      },
      computedStyle: {
        class: "left fixedwidth",
        width: "114px",
        ...flags,
      },
    },
  };
}

function paragraphModule(
  html: string,
  paragraphStyle: Record<string, string>,
  moduleStyle: Record<string, string>,
  flags?: Record<string, unknown>,
): BeeFreeeModule {
  return {
    type: "mailup-bee-newsletter-modules-paragraph",
    descriptor: {
      ...(flags ? { computedStyle: flags } : {}),
      paragraph: { html, style: paragraphStyle },
      style: moduleStyle,
    },
  };
}

const PADDING_10 = {
  "padding-top": "10px",
  "padding-right": "10px",
  "padding-bottom": "10px",
  "padding-left": "10px",
  "background-color": "#112233",
};

function column(
  modules: BeeFreeeModule[],
  grid = 12,
): BeeFreeTemplate["page"]["rows"][number]["columns"][number] {
  return { "grid-columns": grid, modules };
}

function template(
  columns: BeeFreeTemplate["page"]["rows"][number]["columns"],
  rowFlags?: Record<string, string | boolean>,
): BeeFreeTemplate {
  return {
    page: {
      rows: [
        {
          ...(rowFlags ? { content: { computedStyle: rowFlags } } : {}),
          columns,
        },
      ],
    },
  };
}

function imported(source: BeeFreeTemplate) {
  return convertBeeFreeTemplate(source);
}

function sectionBlock(block: Block): SectionBlock {
  if (block.type !== "section") {
    throw new Error(`expected a section, got ${block.type}`);
  }
  return block;
}

function paragraphContent(html: string): string {
  const { content } = imported(template([column([textModule(html)])]));
  const block = content.blocks[0];
  if (block?.type !== "paragraph") {
    throw new Error(`expected a paragraph, got ${block?.type}`);
  }
  return block.content;
}

const CORPUS_TEXT =
  '<div class="txtTinyMce-wrapper" style="font-size: 14px; line-height: 28px; font-family: inherit;"><p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;">Lorem ipsum dolor sit amet:</p><p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;"><span style="font-size: 16px; line-height: 32px;"><span style="font-size: 18px; line-height: 36px;"><strong><code spellcheck="false" data-bee-type="mergetag" data-bee-code="" data-bee-name="Event Name">{{event.name}}</code></strong></span></span></p><p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;"><span style="font-size: 16px; line-height: 32px;"><span style="font-size: 18px; line-height: 36px;"><strong></strong></span></span></p><p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;">Datum: <em>{{event.starts_at}}</em></p><p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;">&nbsp;</p><p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;">Dolor sit amet.</p></div>';

const CORPUS_TEXT_IMPORTED =
  '<div class="txtTinyMce-wrapper" style="font-size: 14px; line-height: 28px; font-family: inherit;"><p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;">Lorem ipsum dolor sit amet:</p><p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;"><span style="font-size: 16px; line-height: 32px;"><span style="font-size: 18px; line-height: 36px;"><strong>{{event.name}}</strong></span></span></p><p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;">Datum: <em>{{event.starts_at}}</em></p><p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;">&nbsp;</p><p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;">Dolor sit amet.</p></div>';

const GREETING =
  '<p style="font-size:16px;line-height:19px;word-break:break-word;text-align:left;"><strong><span style="font-size:16px;line-height:19px;"><code spellcheck="false" data-bee-type="mergetag" data-bee-code="" data-bee-name="First name">Dear </code><code spellcheck="false" data-bee-type="mergetag" data-bee-code="" data-bee-name="First name">{{contact.first_name}}</code><code spellcheck="false" data-bee-type="mergetag" data-bee-code="" data-bee-name="First name">&nbsp;</code><code spellcheck="false" data-bee-type="mergetag" data-bee-code="" data-bee-name="Last name">{{contact.last_name}}</code><code spellcheck="false" data-bee-type="mergetag" data-bee-code="" data-bee-name="First name">,</code></span></strong></p>';

describe("BeeFree module gaps", () => {
  describe("module visibility", () => {
    it("hides one module on mobile inside a two-column row and leaves the section unset", () => {
      const { content, report } = imported(
        template([
          column([textModule("<p>Copy</p>")], 6),
          column(
            [
              imageModule({
                hideContentOnMobile: true,
                hideContentOnDesktop: false,
                hideContentOnAmp: true,
                hideContentOnHtml: true,
              }),
            ],
            6,
          ),
        ]),
      );
      const section = sectionBlock(content.blocks[0]);

      expect(section.visibility).toBeUndefined();
      expect(section.children[0][0].visibility).toBeUndefined();
      expect(section.children[1][0].type).toBe("image");
      expect(section.children[1][0].visibility).toEqual({
        desktop: true,
        mobile: false,
      });
      expect(report.entries[1]).toMatchObject({
        beeFreeModuleType: "mailup-bee-newsletter-modules-image",
        templaticalBlockType: "image",
        status: "converted",
      });
    });

    it("hides a module on desktop", () => {
      const { content } = imported(
        template([
          column([imageModule({ hideContentOnDesktop: true })], 6),
          column([textModule("<p>Copy</p>")], 6),
        ]),
      );
      const section = sectionBlock(content.blocks[0]);

      expect(section.visibility).toBeUndefined();
      expect(section.children[0][0].visibility).toEqual({
        desktop: false,
        mobile: true,
      });
    });

    it("hides a module on both desktop and mobile", () => {
      const { content } = imported(
        template([
          column([
            textModule("<p>Shown</p>"),
            {
              type: "mailup-bee-newsletter-modules-text",
              descriptor: {
                text: { html: "<p>Hidden</p>" },
                computedStyle: {
                  hideContentOnMobile: true,
                  hideContentOnDesktop: true,
                },
              },
            },
          ]),
        ]),
      );
      const shown = content.blocks[0];
      const hidden = content.blocks[1];

      expect(shown.visibility).toBeUndefined();
      expect(hidden.type).toBe("paragraph");
      expect(hidden.visibility).toEqual({ desktop: false, mobile: false });
    });

    it('reads hide flags written as the string "true"', () => {
      const { content } = imported(
        template([
          column([
            imageModule({
              hideContentOnMobile: "true",
              hideContentOnDesktop: "false",
            }),
          ]),
        ]),
      );

      expect(content.blocks[0].type).toBe("image");
      expect(content.blocks[0].visibility).toEqual({
        desktop: true,
        mobile: false,
      });
    });

    it("keeps module visibility on the one social block", () => {
      const social: BeeFreeeModule = {
        type: "mailup-bee-newsletter-modules-social",
        descriptor: {
          computedStyle: { hideContentOnMobile: true },
          iconsList: {
            icons: [
              {
                name: "myspace",
                image: {
                  alt: "Myspace",
                  href: "https://myspace.com/band",
                  src: "https://cdn.example.com/myspace.png",
                },
              },
              {
                name: "facebook",
                image: { href: "https://facebook.com/page" },
              },
            ],
          },
        },
      };
      const { content } = imported(
        template([column([textModule("<p>Copy</p>")], 6), column([social], 6)]),
      );
      const section = sectionBlock(content.blocks[0]);
      const blocks = section.children[1];
      const socialBlock = blocks[0];

      expect(blocks.map((block) => block.type)).toEqual(["social"]);
      expect(socialBlock.type).toBe("social");
      if (socialBlock.type !== "social") return;
      expect(socialBlock.icons.map((icon) => icon.platform)).toEqual([
        "website",
        "facebook",
      ]);
      expect(socialBlock.visibility).toEqual({ desktop: true, mobile: false });
      expect(JSON.stringify(socialBlock)).not.toContain("myspace.png");
      expect(section.visibility).toBeUndefined();
    });

    it("gives the social block its own visibility object", () => {
      const social: BeeFreeeModule = {
        type: "mailup-bee-newsletter-modules-social",
        descriptor: {
          computedStyle: { hideContentOnMobile: true },
          iconsList: {
            icons: [
              {
                name: "myspace",
                image: {
                  alt: "Myspace",
                  href: "https://myspace.com/band",
                  src: "https://cdn.example.com/myspace.png",
                },
              },
              {
                name: "facebook",
                image: { href: "https://facebook.com/page" },
              },
            ],
          },
        },
      };
      const source = template([
        column([textModule("<p>Copy</p>")], 6),
        column([social], 6),
      ]);
      const first = sectionBlock(imported(source).content.blocks[0])
        .children[1];
      const second = sectionBlock(imported(source).content.blocks[0])
        .children[1];
      const block = first[0];
      const again = second[0];
      if (!block.visibility || !again.visibility) {
        throw new Error("expected visibility on the social block");
      }

      expect(first.map((item) => item.type)).toEqual(["social"]);
      expect(block.visibility).toEqual({ desktop: true, mobile: false });
      block.visibility.mobile = true;
      expect(again.visibility).toEqual({ desktop: true, mobile: false });
      expect(block.visibility).toEqual({ desktop: true, mobile: true });
    });

    it("keeps a module flag on a block left bare in a flattened row", () => {
      const { content } = imported(
        template([
          column([textModule("<p>A</p>")], 2),
          column([textModule("<p>B</p>")], 2),
          column([imageModule({ hideContentOnDesktop: true })], 2),
          column([textModule("<p>D</p>")], 2),
          column([textModule("<p>E</p>")], 2),
        ]),
      );

      expect(content.blocks.map((block) => block.type)).toEqual([
        "paragraph",
        "paragraph",
        "image",
        "paragraph",
        "paragraph",
      ]);
      expect(content.blocks[2].visibility).toEqual({
        desktop: false,
        mobile: true,
      });
      expect(content.blocks[0].visibility).toBeUndefined();
    });

    it("sets a row flag only on the section", () => {
      const { content } = imported(
        template([column([textModule("<p>Hi</p>")])], {
          hideContentOnMobile: true,
          hideContentOnDesktop: false,
        }),
      );
      const section = sectionBlock(content.blocks[0]);

      expect(section.visibility).toEqual({ desktop: true, mobile: false });
      expect(section.children[0][0].visibility).toBeUndefined();
    });
  });

  describe("empty paragraphs", () => {
    const keptBlankLines = [
      '<p style="font-size:16px;line-height:32px;word-break:break-word;text-align:center;"></p>',
      '<p style="font-size:14px;line-height:28px;"><span style="font-size:14px;line-height:28px;color:#273960;"></span></p>',
      "<p><span><span></span></span></p>",
    ];

    it("keeps an empty paragraph and a span-only paragraph as written", () => {
      for (const html of keptBlankLines) {
        expect(paragraphContent(`<p>Before</p>${html}<p>After</p>`)).toBe(
          `<p>Before</p>${html}<p>After</p>`,
        );
      }
    });

    it("keeps a blank line as a paragraph block so the renderer can draw it", () => {
      const html =
        '<p>Before</p><p style="font-size:16px;line-height:32px;word-break:break-word;text-align:center;"></p><p>After</p>';
      const { content } = imported(template([column([textModule(html)])]));
      const block = content.blocks[0];

      expect(block?.type).toBe("paragraph");
      if (block?.type !== "paragraph") return;
      expect(block.content).toBe(html);
    });

    it("drops a paragraph that holds only an empty formatting element", () => {
      for (const html of [
        "<p><span><span><strong></strong></span></span></p>",
        "<p><span><strong></strong></span></p>",
        "<p><em></em></p>",
        "<p><strong></strong></p>",
      ]) {
        expect(paragraphContent(`<p>Before</p>${html}<p>After</p>`)).toBe(
          "<p>Before</p><p>After</p>",
        );
      }
    });

    it("keeps a paragraph whose formatting element holds a non-breaking space", () => {
      for (const html of [
        "<p><strong>&nbsp;</strong></p>",
        "<p><span>&nbsp;</span></p>",
      ]) {
        expect(paragraphContent(`<p>Before</p>${html}<p>After</p>`)).toBe(
          `<p>Before</p>${html}<p>After</p>`,
        );
      }
    });

    it("drops a paragraph of empty inline elements and keeps text and nbsp paragraphs", () => {
      expect(paragraphContent(CORPUS_TEXT)).toBe(CORPUS_TEXT_IMPORTED);
    });

    it("keeps a paragraph whose only content is a break", () => {
      expect(paragraphContent("<p>Before</p><p><br></p><p>After</p>")).toBe(
        "<p>Before</p><p><br></p><p>After</p>",
      );
    });

    it("drops a paragraph whose only content is an empty merge-tag chip", () => {
      // The chip is still in the source when the drop is decided, so the
      // empty `<code>` is a non-span element and the paragraph goes.
      expect(
        paragraphContent(
          '<p>Before</p><p><code data-bee-type="mergetag" data-bee-code="" data-bee-name="Empty"></code></p><p>After</p>',
        ),
      ).toBe("<p>Before</p><p>After</p>");
    });

    it("leaves a text module that has no paragraph after the drop as blank text", () => {
      expect(
        paragraphContent(
          '<p><code data-bee-type="mergetag" data-bee-code=""></code></p>',
        ),
      ).toBe("<p></p>");
    });

    it("keeps an empty paragraph when other visible content remains", () => {
      expect(paragraphContent("<p></p><div>Hi</div>")).toBe(
        "<p></p><div>Hi</div>",
      );
      expect(paragraphContent("<p><em></em></p><div>Hi</div>")).toBe(
        "<div>Hi</div>",
      );
    });

    it("leaves a module whose only paragraph is empty inline elements", () => {
      expect(paragraphContent("<p><span></span></p>")).toBe(
        "<p><span></span></p>",
      );
    });

    it("leaves a malformed nested paragraph as written", () => {
      expect(paragraphContent("<p>one<p></p>two</p>")).toBe(
        "<p>one<p></p>two</p>",
      );
      expect(paragraphContent("<p><p></p></p>")).toBe("<p><p></p></p>");
    });

    it("keeps an empty paragraph between well-formed siblings", () => {
      expect(paragraphContent("<p>a</p><p></p><p>b</p>")).toBe(
        "<p>a</p><p></p><p>b</p>",
      );
    });

    it("keeps a paragraph whose border paints a box", () => {
      expect(
        paragraphContent(
          '<p style="border-top:2px solid red;padding-top:12px"><em></em></p><p>Text</p>',
        ),
      ).toBe(
        '<p style="border-top:2px solid red;padding-top:12px"><em></em></p><p>Text</p>',
      );
    });

    it("keeps a paragraph whose padding paints a box", () => {
      expect(
        paragraphContent('<p style="padding:12px"><em></em></p><p>Text</p>'),
      ).toBe('<p style="padding:12px"><em></em></p><p>Text</p>');
    });

    it("keeps a paragraph whose height paints a box", () => {
      expect(
        paragraphContent('<p style="height:20px"><em></em></p><p>Text</p>'),
      ).toBe('<p style="height:20px"><em></em></p><p>Text</p>');
    });

    it("drops a formatting sibling of a box-styled paragraph and keeps an empty one", () => {
      expect(
        paragraphContent('<p style="height:20px"></p><p><em></em></p>'),
      ).toBe('<p style="height:20px"></p>');
      expect(paragraphContent('<p style="height:20px"></p><p></p>')).toBe(
        '<p style="height:20px"></p><p></p>',
      );
    });

    it("keeps a paragraph whose min-height paints a box", () => {
      expect(
        paragraphContent('<p style="min-height:8px"><em></em></p><p>Text</p>'),
      ).toBe('<p style="min-height:8px"><em></em></p><p>Text</p>');
    });

    it("keeps a paragraph whose margin is not zero", () => {
      expect(
        paragraphContent('<p style="margin:10px"><em></em></p><p>Text</p>'),
      ).toBe('<p style="margin:10px"><em></em></p><p>Text</p>');
    });

    it("drops a paragraph whose padding is zero", () => {
      expect(
        paragraphContent('<p style="padding:0"><em></em></p><p>Text</p>'),
      ).toBe("<p>Text</p>");
    });

    it("drops a paragraph when a later padding declaration is zero", () => {
      expect(
        paragraphContent(
          '<p style="padding:12px;padding:0"><em></em></p><p>Text</p>',
        ),
      ).toBe("<p>Text</p>");
    });

    it("keeps a paragraph when a later padding declaration paints", () => {
      expect(
        paragraphContent(
          '<p style="padding:0;padding:12px"><em></em></p><p>Text</p>',
        ),
      ).toBe('<p style="padding:0;padding:12px"><em></em></p><p>Text</p>');
    });

    it("drops a paragraph when an earlier !important padding is zero", () => {
      expect(
        paragraphContent(
          '<p style="padding:0 !important;padding:12px"><em></em></p><p>Text</p>',
        ),
      ).toBe("<p>Text</p>");
    });

    it("drops a paragraph when a later border declaration is none", () => {
      expect(
        paragraphContent(
          '<p style="border:1px solid red;border:none"><em></em></p><p>Text</p>',
        ),
      ).toBe("<p>Text</p>");
    });

    it("keeps a shorthand when a later longhand does not replace it", () => {
      expect(
        paragraphContent(
          '<p style="padding:12px;padding-top:0"><em></em></p><p>Text</p>',
        ),
      ).toBe('<p style="padding:12px;padding-top:0"><em></em></p><p>Text</p>');
    });

    it("drops a paragraph whose border is none", () => {
      expect(
        paragraphContent('<p style="border:none"><em></em></p><p>Text</p>'),
      ).toBe("<p>Text</p>");
    });

    it("drops a border that does not paint", () => {
      for (const style of [
        "border:0 solid red",
        "border:1px none red",
        "border-color:red",
        "border-width:2px",
        "border-radius:4px",
      ]) {
        expect(
          paragraphContent(`<p style="${style}"><em></em></p><p>Text</p>`),
        ).toBe("<p>Text</p>");
      }
    });

    it("keeps a border shorthand or style that paints", () => {
      for (const style of [
        "border:1px solid red",
        "border-top:2px dashed #000",
        "border-style:solid",
        "border:solid",
      ]) {
        expect(
          paragraphContent(`<p style="${style}"><em></em></p><p>Text</p>`),
        ).toBe(`<p style="${style}"><em></em></p><p>Text</p>`);
      }
    });

    it("drops an inert box value written with !important or a colour function", () => {
      for (const style of [
        "margin:0!important",
        "padding:0px!IMPORTANT",
        "border:none !important",
        "padding:0 ! important",
        "border:0 solid rgb(0 0 0)",
      ]) {
        expect(
          paragraphContent(`<p style="${style}"><em></em></p><p>Text</p>`),
        ).toBe("<p>Text</p>");
      }
    });

    it("keeps a painting box value written with !important or a colour function", () => {
      for (const style of [
        "padding:4px!important",
        "border:1px solid rgb(0 0 0)",
        "border:2px dashed rgba(0, 0, 0, 0.5)",
        "border-top:1px solid hsl(0 0% 0%)",
      ]) {
        expect(
          paragraphContent(`<p style="${style}"><em></em></p><p>Text</p>`),
        ).toBe(`<p style="${style}"><em></em></p><p>Text</p>`);
      }
    });

    it("treats a truncated < or </ at the end of the string as not a tag", () => {
      expect(paragraphContent("<p>Stay</p><")).toBe("<p>Stay</p><");
      expect(paragraphContent("<p>Stay</p></")).toBe("<p>Stay</p></");
    });

    it("reads a slash after whitespace as a self-closing paragraph", () => {
      expect(
        paragraphContent('<p style="padding:4px" /><p><em></em></p>'),
      ).toBe('<p style="padding:4px" />');
      expect(paragraphContent("<p /><p><em></em></p>After")).toBe("<p />After");
      expect(
        paragraphContent('<p style="padding:4px" / ><p><em></em></p>'),
      ).toBe('<p style="padding:4px" / >');
      expect(paragraphContent("<p / ><p><em></em></p>After")).toBe(
        "<p / >After",
      );
    });

    it("drops a zero length written with a decimal or leading zeros", () => {
      expect(
        paragraphContent('<p style="padding:0.0px"><em></em></p><p>Text</p>'),
      ).toBe("<p>Text</p>");
      expect(
        paragraphContent('<p style="margin:00"><em></em></p><p>Text</p>'),
      ).toBe("<p>Text</p>");
      expect(
        paragraphContent('<p style="padding:0.1px"><em></em></p><p>Text</p>'),
      ).toBe('<p style="padding:0.1px"><em></em></p><p>Text</p>');
    });

    it("drops a zero length in em, rem, percent and viewport units", () => {
      for (const style of [
        "padding:0em",
        "margin:0rem",
        "padding:0%",
        "padding:0vw",
      ]) {
        expect(
          paragraphContent(`<p style="${style}"><em></em></p><p>Text</p>`),
        ).toBe("<p>Text</p>");
      }
      expect(
        paragraphContent('<p style="padding:0q"><em></em></p><p>Text</p>'),
      ).toBe('<p style="padding:0q"><em></em></p><p>Text</p>');
    });

    it("collapses repeated spaces between box tokens", () => {
      expect(
        paragraphContent(
          '<p style="padding:4px  8px"><em></em></p><p>Text</p>',
        ),
      ).toBe('<p style="padding:4px  8px"><em></em></p><p>Text</p>');
      expect(
        paragraphContent('<p style="margin:0  0"><em></em></p><p>Text</p>'),
      ).toBe("<p>Text</p>");
    });

    it("leaves a self-closing paragraph nested in another as written", () => {
      expect(paragraphContent("<p>a<p/>b</p><p><em></em></p>c")).toBe(
        "<p>a<p/>b</p>c",
      );
    });

    it("keeps the markup when an unclosed comment is the only remainder", () => {
      expect(paragraphContent("<p></p><!-- <p>hidden")).toBe(
        "<p></p><!-- <p>hidden",
      );
      expect(paragraphContent("<p><em></em></p><!-- <p>hidden")).toBe(
        "<p><em></em></p><!-- <p>hidden",
      );
    });

    it("drops a paragraph whose style declaration is empty", () => {
      expect(
        paragraphContent('<p style=";;padding:0;"><em></em></p><p>Text</p>'),
      ).toBe("<p>Text</p>");
      expect(
        paragraphContent('<p style=";;padding:;"><em></em></p><p>Text</p>'),
      ).toBe("<p>Text</p>");
    });

    it("leaves an unclosed paragraph at the end of the string", () => {
      expect(paragraphContent("<p>Hello")).toBe("<p>Hello");
      expect(paragraphContent("<p> \t")).toBe("<p> \t");
    });

    it("leaves a closing tag that never reaches >", () => {
      expect(paragraphContent("<p></p></p")).toBe("<p></p></p");
      expect(paragraphContent("<p><em></em></p></p")).toBe(
        "<p><em></em></p></p",
      );
    });

    it("keeps a self-closing paragraph whether or not its style paints a box", () => {
      expect(paragraphContent('<p style="padding:4px"/><p>Text</p>')).toBe(
        '<p style="padding:4px"/><p>Text</p>',
      );
      expect(paragraphContent("<p/><p>Text</p>")).toBe("<p/><p>Text</p>");
    });

    it("keeps an empty paragraph and restores a formatting paragraph that leaves nothing visible", () => {
      expect(paragraphContent("<p></p>tail")).toBe("<p></p>tail");
      expect(paragraphContent("<p></p> < 3")).toBe("<p></p> < 3");
      expect(paragraphContent('<p></p><img src="x">')).toBe(
        '<p></p><img src="x">',
      );
      expect(paragraphContent("<p></p></div>")).toBe("<p></p></div>");
      expect(paragraphContent("<p></p></div")).toBe("<p></p></div");
      expect(paragraphContent("<p></p><div")).toBe("<p></p><div");
      expect(paragraphContent("<p><em></em></p>tail")).toBe("tail");
      expect(paragraphContent("<p><em></em></p> < 3")).toBe(" < 3");
      expect(paragraphContent('<p><em></em></p><img src="x">')).toBe(
        '<img src="x">',
      );
      expect(paragraphContent("<p><em></em></p></div>")).toBe(
        "<p><em></em></p></div>",
      );
      expect(paragraphContent("<p><em></em></p></div")).toBe(
        "<p><em></em></p></div",
      );
      expect(paragraphContent("<p><em></em></p><div")).toBe("<div");
    });

    it("drops the corpus paragraph that only sets typography", () => {
      expect(
        paragraphContent(
          '<p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;"><span style="font-size: 16px; line-height: 32px;"><span style="font-size: 18px; line-height: 36px;"><strong></strong></span></span></p><p>Text</p>',
        ),
      ).toBe("<p>Text</p>");
    });

    it("ignores a paragraph tag inside a comment", () => {
      expect(paragraphContent("<p></p><!-- <p> --><p>x</p>")).toBe(
        "<p></p><!-- <p> --><p>x</p>",
      );
      expect(paragraphContent("<p><em></em></p><!-- <p> --><p>x</p>")).toBe(
        "<!-- <p> --><p>x</p>",
      );
      expect(paragraphContent("<p></p><!-- <p> -->")).toBe(
        "<p></p><!-- <p> -->",
      );
      expect(paragraphContent("<p><em></em></p><!-- <p> -->")).toBe(
        "<p><em></em></p><!-- <p> -->",
      );
    });

    it("keeps a paragraph whose descendant draws a box and drops a zero box", () => {
      const drawn =
        '<p><a style="display:inline-block;width:24px;height:24px;background:red"></a></p>';
      expect(paragraphContent(`<p>Alpha</p>${drawn}<p>Omega</p>`)).toBe(
        `<p>Alpha</p>${drawn}<p>Omega</p>`,
      );
      expect(paragraphContent(`<p><em></em></p>${drawn}`)).toBe(drawn);
      expect(
        paragraphContent(
          '<p>Alpha</p><p><a style="display:inline-block;width:0;height:0"></a></p><p>Omega</p>',
        ),
      ).toBe("<p>Alpha</p><p>Omega</p>");
      expect(
        paragraphContent(
          '<p>Alpha</p><p><em style="padding:4px"></em></p><p>Omega</p>',
        ),
      ).toBe('<p>Alpha</p><p><em style="padding:4px"></em></p><p>Omega</p>');
      expect(
        paragraphContent(
          '<p>Alpha</p><p><a style="display:block;width:24px;height:24px"></a></p><p>Omega</p>',
        ),
      ).toBe(
        '<p>Alpha</p><p><a style="display:block;width:24px;height:24px"></a></p><p>Omega</p>',
      );
      expect(
        paragraphContent(
          '<p>Alpha</p><p><a style="display:block;width:24px;height:0"></a></p><p>Omega</p>',
        ),
      ).toBe("<p>Alpha</p><p>Omega</p>");
      expect(
        paragraphContent(
          '<p>Alpha</p><p><a style="display:block;height:24px"></a></p><p>Omega</p>',
        ),
      ).toBe(
        '<p>Alpha</p><p><a style="display:block;height:24px"></a></p><p>Omega</p>',
      );
      expect(
        paragraphContent(
          '<p>Alpha</p><p><a style="display:block;width:24px"></a></p><p>Omega</p>',
        ),
      ).toBe("<p>Alpha</p><p>Omega</p>");
      expect(
        paragraphContent(
          '<p>Alpha</p><p><a style="display:inline;width:24px;height:24px"></a></p><p>Omega</p>',
        ),
      ).toBe(
        '<p>Alpha</p><p><a style="display:inline;width:24px;height:24px"></a></p><p>Omega</p>',
      );
      expect(
        paragraphContent(
          '<p>Alpha</p><p><a style="display:block;width:auto;height:24px"></a></p><p>Omega</p>',
        ),
      ).toBe(
        '<p>Alpha</p><p><a style="display:block;width:auto;height:24px"></a></p><p>Omega</p>',
      );
      expect(
        paragraphContent(
          '<p>Alpha</p><p><a style="display:block;width:24q;height:24px"></a></p><p>Omega</p>',
        ),
      ).toBe(
        '<p>Alpha</p><p><a style="display:block;width:24q;height:24px"></a></p><p>Omega</p>',
      );
      expect(
        paragraphContent(
          '<p>Alpha</p><p><a style="display:block;width:0;height:24px"></a></p><p>Omega</p>',
        ),
      ).toBe(
        '<p>Alpha</p><p><a style="display:block;width:0;height:24px"></a></p><p>Omega</p>',
      );
    });

    it("drops empty paragraphs in linear time", () => {
      const adversarial = (n: number) => "<p<p".repeat(n);
      const block = convertModule(textModule(adversarial(32)), []).block;
      if (block.type !== "paragraph") throw new Error("expected a paragraph");
      expect(block.content).toBe(adversarial(32));
      expectLinear((n) => {
        const html = adversarial(n);
        return () => convertModule(textModule(html), []);
      }, 1_000);
    }, 30_000);
  });

  describe("empty paragraphs decided on the source HTML", () => {
    // The module line-height is what runs the style pass. That pass strips
    // an empty inline subtree, so the decision has to happen on this markup.
    const textStyle = { "line-height": "120%" };
    const strong =
      '<p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;" data-mce-style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;"><span style="font-size: 16px; line-height: 32px;" data-mce-style="font-size: 16px; line-height: 32px;"><span style="font-size: 18px; line-height: 36px;" data-mce-style="font-size: 18px; line-height: 36px;"><strong></strong></span></span></p>';
    const blank =
      '<p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;" data-mce-style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;"></p>';
    const spanOnly =
      '<p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;" data-mce-style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;"><span style="font-size: 16px; line-height: 32px; color: #273960;" data-mce-style="font-size: 16px; line-height: 32px; color: #273960;"></span></p>';
    const emph =
      '<p style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;" data-mce-style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;"><span style="font-size: 16px; line-height: 32px;" data-mce-style="font-size: 16px; line-height: 32px;"><span style="font-size: 18px; line-height: 36px;" data-mce-style="font-size: 18px; line-height: 36px;"><em></em></span></span></p>';
    const keptBlank =
      '<p style="font-size: 16px; word-break: break-word; text-align: center; line-height: 1.2" data-mce-style="font-size: 16px; line-height: 32px; word-break: break-word; text-align: center;"></p>';
    const sides =
      '<p style="line-height: 1.2">Alpha</p><p style="line-height: 1.2">Omega</p>';
    const withBlank = `<p style="line-height: 1.2">Alpha</p>${keptBlank}<p style="line-height: 1.2">Omega</p>`;

    function textContent(html: string): string {
      const { content } = imported(
        template([
          column([
            {
              type: "mailup-bee-newsletter-modules-text",
              descriptor: { text: { html, style: textStyle } },
            },
          ]),
        ]),
      );
      const block = content.blocks[0];
      if (block?.type !== "paragraph") {
        throw new Error(`expected a paragraph, got ${block?.type}`);
      }
      return block.content;
    }

    function paragraphHtml(html: string): string {
      const { content } = imported(
        template([
          column([
            paragraphModule(html, textStyle, {
              "padding-top": "10px",
              "padding-right": "10px",
              "padding-bottom": "10px",
              "padding-left": "10px",
            }),
          ]),
        ]),
      );
      const block = content.blocks[0];
      if (block?.type !== "paragraph") {
        throw new Error(`expected a paragraph, got ${block?.type}`);
      }
      return block.content;
    }

    it("drops a TinyMCE paragraph that holds only an empty strong", () => {
      expect(textContent(`<p>Alpha</p>${strong}<p>Omega</p>`)).toBe(sides);
    });

    it("keeps an empty paragraph as a blank line", () => {
      expect(textContent(`<p>Alpha</p>${blank}<p>Omega</p>`)).toBe(withBlank);
    });

    it("keeps a paragraph that holds only an empty span", () => {
      expect(textContent(`<p>Alpha</p>${spanOnly}<p>Omega</p>`)).toBe(
        withBlank,
      );
    });

    it("drops a paragraph that holds only an empty em", () => {
      expect(textContent(`<p>Alpha</p>${emph}<p>Omega</p>`)).toBe(sides);
    });

    it("drops and keeps the same shapes in a paragraph module", () => {
      expect(paragraphHtml(`<p>Alpha</p>${blank}<p>Omega</p>`)).toBe(withBlank);
      expect(paragraphHtml(`<p>Alpha</p>${spanOnly}<p>Omega</p>`)).toBe(
        withBlank,
      );
      expect(paragraphHtml(`<p>Alpha</p>${emph}<p>Omega</p>`)).toBe(sides);
      expect(paragraphHtml(`<p>Alpha</p>${strong}<p>Omega</p>`)).toBe(sides);
    });

    it("keeps a drawn box through the style pass and still empties a zero box and an empty span", () => {
      const drawn =
        '<p><a style="display:inline-block;width:24px;height:24px;background:red"></a></p><p>Text</p>';
      const drawnKept =
        '<p style="line-height: 1.2"><a style="display:inline-block; width:24px; height:24px; background:red"></a></p><p style="line-height: 1.2">Text</p>';
      const zero =
        '<p><a style="display:inline-block;width:0;height:0"></a></p><p>Text</p>';
      const zeroEmptied = '<p style="line-height: 1.2">Text</p>';
      const span = "<p><span></span></p>";
      const spanEmptied = '<p style="line-height: 1.2"></p>';

      expect(textContent(drawn)).toBe(drawnKept);
      expect(paragraphHtml(drawn)).toBe(drawnKept);
      expect(textContent(zero)).toBe(zeroEmptied);
      expect(paragraphHtml(zero)).toBe(zeroEmptied);
      expect(textContent(span)).toBe(spanEmptied);
      // A paragraph module whose only markup is that span is blank after the
      // style pass, so it imports as the same spacer it does today.
      const spanParagraph = imported(
        template([
          column([
            paragraphModule(span, textStyle, {
              "padding-top": "10px",
              "padding-right": "10px",
              "padding-bottom": "10px",
              "padding-left": "10px",
            }),
          ]),
        ]),
      );
      const spanBlock = spanParagraph.content.blocks[0];
      expect(spanBlock.type).toBe("spacer");
      if (spanBlock.type !== "spacer") return;
      expect(spanBlock.height).toBe(37);
      expect(spanBlock.styles.padding).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
      expect(spanParagraph.report.entries[0]).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-paragraph",
        templaticalBlockType: "spacer",
        status: "converted",
        note: "Blank paragraph imported as a 37px spacer.",
      });
    });
  });

  describe("blank paragraph modules", () => {
    function blank(options: {
      html?: string;
      fontSize?: string;
      lineHeight?: string;
      paddingTop?: string;
      paddingBottom?: string;
      flags?: Record<string, unknown>;
    }) {
      const style: Record<string, string> = {};
      if (options.fontSize !== undefined) style["font-size"] = options.fontSize;
      if (options.lineHeight !== undefined) {
        style["line-height"] = options.lineHeight;
      }
      const { content, report } = imported(
        template([
          column([
            paragraphModule(
              options.html ?? "",
              style,
              {
                ...PADDING_10,
                "padding-top": options.paddingTop ?? "10px",
                "padding-bottom": options.paddingBottom ?? "10px",
              },
              options.flags,
            ),
          ]),
        ]),
      );
      return { block: content.blocks[0], entry: report.entries[0] };
    }

    it("imports an empty paragraph module as a 37px spacer", () => {
      const { block, entry } = blank({
        fontSize: "14px",
        lineHeight: "120%",
      });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(block.styles.padding).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
      expect(block.styles.backgroundColor).toBe("#112233");
      expect(block.visibility).toBeUndefined();
      expect(entry).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-paragraph",
        templaticalBlockType: "spacer",
        status: "converted",
        note: "Blank paragraph imported as a 37px spacer.",
      });
    });

    it("uses a px line-height as the line box", () => {
      const { block, entry } = blank({
        fontSize: "14px",
        lineHeight: "22px",
      });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(42);
      expect(entry.note).toBe("Blank paragraph imported as a 42px spacer.");
    });

    it("uses a unitless line-height as a ratio", () => {
      const { block } = blank({ fontSize: "14px", lineHeight: "1.5" });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(41);
    });

    it("honours a zero line-height and a zero font-size", () => {
      for (const lineHeight of ["0", "0%"]) {
        const { block } = blank({ fontSize: "14px", lineHeight });
        expect(block.type).toBe("spacer");
        if (block.type !== "spacer") return;
        expect(block.height).toBe(20);
      }

      const zeroFont = blank({ fontSize: "0px", lineHeight: "120%" });
      expect(zeroFont.block.type).toBe("spacer");
      if (zeroFont.block.type !== "spacer") return;
      expect(zeroFont.block.height).toBe(20);

      const negative = blank({ fontSize: "14px", lineHeight: "-1" });
      expect(negative.block.type).toBe("spacer");
      if (negative.block.type !== "spacer") return;
      expect(negative.block.height).toBe(37);
      expect(negative.entry.status).toBe("approximated");
      expect(negative.entry.note).toBe(
        "Blank paragraph imported as a 37px spacer; line-height -1 is not read, 1.2 is used.",
      );
    });

    it("reads an em line-height as a multiple of the font size", () => {
      const { block, entry } = blank({ fontSize: "14px", lineHeight: "2em" });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(48);
      expect(entry.status).toBe("converted");
      expect(entry.note).toBe("Blank paragraph imported as a 48px spacer.");
    });

    it("approximates a line-height it cannot read", () => {
      const { block, entry } = blank({ fontSize: "14px", lineHeight: "2rem" });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "Blank paragraph imported as a 37px spacer; line-height 2rem is not read, 1.2 is used.",
      );
    });

    it("approximates a font-size it cannot read and uses 14px", () => {
      const { block, entry } = blank({ fontSize: "1.2em" });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "Blank paragraph imported as a 37px spacer; font-size 1.2em is not read, 14px is used.",
      );
    });

    it("uses the 14px default when the font size is not in px", () => {
      const { block, entry } = blank({ fontSize: "1em" });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(entry).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-paragraph",
        templaticalBlockType: "spacer",
        status: "approximated",
        note: "Blank paragraph imported as a 37px spacer; font-size 1em is not read, 14px is used.",
      });
    });

    it("stays converted when font-size and line-height are missing", () => {
      const { block, entry } = blank({});

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(entry.status).toBe("converted");
      expect(entry.note).toBe("Blank paragraph imported as a 37px spacer.");
    });

    it("uses 14px and 1.2 when font-size and line-height are missing", () => {
      const { block, entry } = blank({
        paddingTop: "4px",
        paddingBottom: "6px",
      });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(27);
      expect(entry.note).toBe("Blank paragraph imported as a 27px spacer.");
      expect(entry.templaticalBlockType).toBe("spacer");
      expect(entry.status).toBe("converted");
    });

    it("keeps module visibility on the spacer for a blank paragraph hidden on mobile", () => {
      const { block, entry } = blank({
        fontSize: "14px",
        lineHeight: "120%",
        flags: {
          hideContentOnMobile: true,
          hideContentOnDesktop: false,
          hideContentOnAmp: true,
        },
      });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(block.visibility).toEqual({ desktop: true, mobile: false });
      expect(block.styles.padding).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
      expect(entry).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-paragraph",
        templaticalBlockType: "spacer",
        status: "converted",
        note: "Blank paragraph imported as a 37px spacer.",
      });
    });

    it("keeps text that arrives on the text payload of a paragraph module", () => {
      const { content, report } = imported(
        template([
          column([
            {
              type: "mailup-bee-newsletter-modules-paragraph",
              descriptor: {
                text: { html: "Sale" },
                style: PADDING_10,
              },
            },
          ]),
        ]),
      );
      const block = content.blocks[0];

      expect(block.type).toBe("paragraph");
      if (block.type !== "paragraph") return;
      expect(block.content).toBe("Sale");
      expect(content.blocks.some((item) => item.type === "spacer")).toBe(false);
      expect(report.entries[0]).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-paragraph",
        templaticalBlockType: "paragraph",
        status: "converted",
      });
    });

    it("imports empty, whitespace, and missing paragraph payloads as a 37px spacer", () => {
      const payloads: Array<Record<string, unknown>> = [
        { paragraph: { html: "" } },
        { paragraph: { html: "   " } },
        {},
      ];

      for (const payload of payloads) {
        const { content, report } = imported(
          template([
            column([
              {
                type: "mailup-bee-newsletter-modules-paragraph",
                descriptor: { ...payload, style: PADDING_10 },
              },
            ]),
          ]),
        );
        const block = content.blocks[0];

        expect(block.type).toBe("spacer");
        if (block.type !== "spacer") return;
        expect(block.height).toBe(37);
        expect(report.entries[0]).toEqual({
          beeFreeModuleType: "mailup-bee-newsletter-modules-paragraph",
          templaticalBlockType: "spacer",
          status: "converted",
          note: "Blank paragraph imported as a 37px spacer.",
        });
      }
    });

    it("leaves a non-blank paragraph module as a paragraph", () => {
      const { content, report } = imported(
        template([
          column([
            paragraphModule(
              "<p>Hello</p>",
              { "font-size": "14px", "line-height": "120%" },
              PADDING_10,
            ),
          ]),
        ]),
      );
      const block = content.blocks[0];

      expect(block.type).toBe("paragraph");
      if (block.type !== "paragraph") return;
      expect(block.content).toBe(
        '<p style="font-size: 14px; line-height: 1.2"><span style="font-size: 14px">Hello</span></p>',
      );
      expect(block.visibility).toBeUndefined();
      expect(report.entries[0]).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-paragraph",
        templaticalBlockType: "paragraph",
        status: "converted",
      });
    });

    it("drops a blank paragraph translation and warns once per locale", () => {
      const { content, report } = imported(
        template([
          column([
            {
              type: "mailup-bee-newsletter-modules-paragraph",
              translations: { de: { html: "<p>Nochmals</p>" } },
              descriptor: {
                paragraph: {
                  html: "",
                  style: { "font-size": "14px", "line-height": "120%" },
                  translations: {
                    de: { html: "<p>Hallo</p>" },
                    fr: { html: "<p>Bonjour</p>" },
                  },
                },
                style: PADDING_10,
              },
            },
          ]),
        ]),
      );
      const block = content.blocks[0];

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(block.l10n).toBeUndefined();
      expect(content.settings.locales).toBeUndefined();
      expect(content.blocks.some((item) => item.type !== "spacer")).toBe(false);
      expect(report.warnings).toEqual([
        'Dropped language "de" on module "mailup-bee-newsletter-modules-paragraph": the default paragraph is blank and imported as a spacer.',
        'Dropped language "fr" on module "mailup-bee-newsletter-modules-paragraph": the default paragraph is blank and imported as a spacer.',
      ]);
      expect(report.entries[0].status).toBe("approximated");
      expect(report.entries[0].note).toBe(
        "Blank paragraph imported as a 37px spacer. Translations de, fr dropped: the default paragraph is blank and imported as a spacer.",
      );
    });

    it("reports a plain blank paragraph as converted", () => {
      const { block, entry } = blank({
        html: "<p></p>",
        fontSize: "14px",
        lineHeight: "120%",
      });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(entry.status).toBe("converted");
      expect(entry.note).toBe("Blank paragraph imported as a 37px spacer.");
    });

    it("approximates a blank paragraph whose box styling is not carried", () => {
      const { block, entry } = blank({
        html: '<p style="height:100px"></p>',
        fontSize: "14px",
        lineHeight: "120%",
      });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "Blank paragraph imported as a 37px spacer; its box styling is not carried.",
      );
    });

    it("names a lost box and an unread line-height in one sentence", () => {
      const { block, entry } = blank({
        html: '<p style="height:100px"></p>',
        fontSize: "14px",
        lineHeight: "2rem",
      });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "Blank paragraph imported as a 37px spacer; its box styling is not carried; line-height 2rem is not read, 1.2 is used.",
      );
    });

    it("approximates a blank paragraph whose uppercase tag paints a box", () => {
      const { block, entry } = blank({
        html: '<P style="height:100px"></P>',
        fontSize: "14px",
        lineHeight: "120%",
      });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "Blank paragraph imported as a 37px spacer; its box styling is not carried.",
      );
    });

    it("does not treat an unclosed style quote as a painted box", () => {
      const { block, entry } = blank({
        html: '<p style="height:100px>',
        fontSize: "14px",
        lineHeight: "120%",
      });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(entry.status).toBe("converted");
      expect(entry.note).toBe("Blank paragraph imported as a 37px spacer.");
    });

    it("approximates a non-finite em line-height", () => {
      const lineHeight = `${"9".repeat(400)}em`;
      const { block, entry } = blank({ fontSize: "14px", lineHeight });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        `Blank paragraph imported as a 37px spacer; line-height ${lineHeight} is not read, 1.2 is used.`,
      );
    });

    it("approximates a non-finite px line-height", () => {
      const lineHeight = `${"9".repeat(400)}px`;
      const { block, entry } = blank({ fontSize: "14px", lineHeight });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        `Blank paragraph imported as a 37px spacer; line-height ${lineHeight} is not read, 1.2 is used.`,
      );
    });

    it("reads a non-finite padding-top as 0", () => {
      const { block, entry } = blank({
        fontSize: "14px",
        lineHeight: "120%",
        paddingTop: `${"9".repeat(400)}px`,
      });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(0 + 17 + 10);
      expect(Number.isInteger(block.height)).toBe(true);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "Blank paragraph imported as a 27px spacer; its padding is not read.",
      );
    });

    it("reads both non-finite vertical paddings as 0", () => {
      const padding = `${"9".repeat(400)}px`;
      const { block, entry } = blank({
        fontSize: "14px",
        lineHeight: "120%",
        paddingTop: padding,
        paddingBottom: padding,
      });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(17);
      expect(Number.isInteger(block.height)).toBe(true);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "Blank paragraph imported as a 17px spacer; its padding is not read.",
      );
    });

    it("reads vertical padding whose sum is not finite as unreadable", () => {
      const padding = `1${"0".repeat(308)}px`;
      const { block, entry } = blank({
        fontSize: "14px",
        lineHeight: "120%",
        paddingTop: padding,
        paddingBottom: padding,
      });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(17);
      expect(Number.isInteger(block.height)).toBe(true);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "Blank paragraph imported as a 17px spacer; its padding is not read.",
      );
    });

    it("uses the fallback line box alone when the height sum is not finite", () => {
      const huge = `1${"0".repeat(308)}px`;
      const { block, entry } = blank({
        fontSize: huge,
        lineHeight: "1",
        paddingTop: huge,
        paddingBottom: "0px",
      });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(17);
      expect(Number.isInteger(block.height)).toBe(true);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "Blank paragraph imported as a 17px spacer; its height overflows, 17px is used.",
      );
    });

    it("approximates a blank paragraph whose line box overflows", () => {
      const { block, entry } = blank({
        fontSize: `1${"0".repeat(308)}px`,
        lineHeight: "2",
      });

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "Blank paragraph imported as a 37px spacer; its line box overflows, 1.2 × 14px is used.",
      );
    });

    it("approximates a blank paragraph whose empty tag sets typography", () => {
      const sized = (
        html: string,
      ): { height: number; status: string; note: string | undefined } => {
        const { block, entry } = blank({
          html,
          fontSize: "14px",
          lineHeight: "120%",
        });
        expect(block.type).toBe("spacer");
        if (block.type !== "spacer") {
          throw new Error(`expected a spacer, got ${block.type}`);
        }
        return {
          height: block.height,
          status: entry.status,
          note: entry.note,
        };
      };

      expect(sized('<p style="font-size:24px;line-height:36px"></p>')).toEqual({
        height: 37,
        status: "approximated",
        note: "Blank paragraph imported as a 37px spacer; its paragraph typography is not read.",
      });
      expect(sized('<p style="font-size:24px"></p>')).toEqual({
        height: 37,
        status: "approximated",
        note: "Blank paragraph imported as a 37px spacer; its paragraph typography is not read.",
      });
      expect(sized('<p style="line-height:36px"></p>')).toEqual({
        height: 37,
        status: "approximated",
        note: "Blank paragraph imported as a 37px spacer; its paragraph typography is not read.",
      });
      expect(sized('<p style="color:#ffffff"></p>')).toEqual({
        height: 37,
        status: "converted",
        note: "Blank paragraph imported as a 37px spacer.",
      });
    });

    it("treats a paragraph module that omits html as blank", () => {
      const { content, report } = imported(
        template([
          column([
            {
              type: "mailup-bee-newsletter-modules-paragraph",
              descriptor: {
                paragraph: JSON.parse(
                  '{"style":{"font-size":"14px","line-height":"120%"}}',
                ),
                style: PADDING_10,
              },
            },
          ]),
        ]),
      );
      const block = content.blocks[0];

      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(37);
      expect(report.entries[0]).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-paragraph",
        templaticalBlockType: "spacer",
        status: "converted",
        note: "Blank paragraph imported as a 37px spacer.",
      });
    });

    it("keeps a blank translation on a paragraph that has text", () => {
      const { content, report } = imported(
        template([
          column([
            {
              type: "mailup-bee-newsletter-modules-paragraph",
              translations: { de: { html: "<p></p>" } },
              descriptor: {
                paragraph: { html: "<p>Hello</p>" },
              },
            },
          ]),
        ]),
      );
      const block = content.blocks[0];

      expect(block.type).toBe("paragraph");
      if (block.type !== "paragraph") return;
      expect(block.content).toBe("<p>Hello</p>");
      expect(block.l10n?.de.text?.content).toEqual({
        value: "<p></p>",
        sourceHash: sourceHash("<p>Hello</p>"),
      });
      expect(content.blocks.some((item) => item.type === "spacer")).toBe(false);
      expect(content.settings.locales).toEqual(["de"]);
      expect(report.warnings).toEqual([]);
      expect(report.entries[0]).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-paragraph",
        templaticalBlockType: "paragraph",
        status: "converted",
      });
    });
  });

  describe("html module alignment", () => {
    function htmlContent(
      html: string,
      type = "mailup-bee-newsletter-modules-html",
      fontFamily?: string,
    ) {
      const source = template([
        column([
          {
            type,
            descriptor: { html: { html } },
          },
        ]),
      ]);
      if (fontFamily !== undefined) {
        source.page.body = {
          content: { style: { "font-family": fontFamily } },
        };
      }
      const { content, report } = imported(source);
      const block = content.blocks[0];
      if (block?.type !== "html") {
        throw new Error(`expected html, got ${block?.type}`);
      }
      return {
        content: block.content,
        entry: report.entries[0],
        fontFamily: content.settings.fontFamily,
      };
    }

    it("centres a Twig control tag the way BeeFree's export wraps it", () => {
      const { content, entry } = htmlContent(
        "{% for companion in guest.companions %}",
      );

      expect(content).toBe(
        '<div style="font-size:16px;line-height:normal;word-break:normal;text-align:center" align="center">{% for companion in guest.companions %}</div>',
      );
      expect(entry).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-html",
        templaticalBlockType: "html",
        status: "converted",
      });
    });

    it("sets 16px and no font-family when the body sets no font", () => {
      const { content, fontFamily } = htmlContent("<p>Hello</p>");

      expect(content).toBe(
        '<div style="font-size:16px;line-height:normal;word-break:normal;text-align:center" align="center"><p>Hello</p></div>',
      );
      expect(fontFamily).toBe("Arial");
    });

    it("restores normal word breaking around a flex row of short links", () => {
      const row =
        '<div style="display:flex"><a href="https://example.com/impressum">Impressum</a><a href="https://example.com/datenschutz">Datenschutz</a><a href="https://example.com/kontakt">Kontakt</a></div>';
      const { content } = htmlContent(row);

      expect(content).toBe(
        `<div style="font-size:16px;line-height:normal;word-break:normal;text-align:center" align="center">${row}</div>`,
      );
    });

    it("copies the page body font and the 16px browser default onto the wrapper", () => {
      const font = "Arial, Helvetica Neue, Helvetica, sans-serif";
      const { content, entry, fontFamily } = htmlContent(
        "<p>Hello</p>",
        "mailup-bee-newsletter-modules-html",
        font,
      );

      expect(content).toBe(
        '<div style="font-family:Arial, Helvetica Neue, Helvetica, sans-serif;font-size:16px;line-height:normal;word-break:normal;text-align:center" align="center"><p>Hello</p></div>',
      );
      expect(fontFamily).toBe(font);
      expect(entry).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-html",
        templaticalBlockType: "html",
        status: "converted",
      });
    });

    it("escapes a quoted body font inside the wrapper attribute", () => {
      const { content } = htmlContent(
        "<p>Hello</p>",
        "mailup-bee-newsletter-modules-html",
        "'Helvetica Neue', Helvetica, Arial, sans-serif",
      );

      expect(content).toBe(
        `<div style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;line-height:normal;word-break:normal;text-align:center" align="center"><p>Hello</p></div>`,
      );
    });

    it("escapes a double quote in a quoted body font", () => {
      const { content } = htmlContent(
        "<p>Hello</p>",
        "mailup-bee-newsletter-modules-html",
        `'Foo"Bar', sans-serif`,
      );

      expect(content).toBe(
        `<div style="font-family:'Foo&quot;Bar', sans-serif;font-size:16px;line-height:normal;word-break:normal;text-align:center" align="center"><p>Hello</p></div>`,
      );
    });

    it("copies the body font onto an HTML module in a two-column row", () => {
      const { content } = imported({
        page: {
          body: {
            content: {
              style: {
                "font-family": "Arial, Helvetica Neue, Helvetica, sans-serif",
              },
            },
          },
          rows: [
            {
              columns: [
                column(
                  [
                    {
                      type: "mailup-bee-newsletter-modules-html",
                      descriptor: { html: { html: "<p>Hello</p>" } },
                    },
                  ],
                  6,
                ),
                column(
                  [
                    {
                      type: "mailup-bee-newsletter-modules-text",
                      descriptor: { text: { html: "<p>Side</p>" } },
                    },
                  ],
                  6,
                ),
              ],
            },
          ],
        },
      });
      const block = sectionBlock(content.blocks[0]).children[0][0];

      expect(block.type).toBe("html");
      if (block.type !== "html") return;
      expect(block.content).toBe(
        '<div style="font-family:Arial, Helvetica Neue, Helvetica, sans-serif;font-size:16px;line-height:normal;word-break:normal;text-align:center" align="center"><p>Hello</p></div>',
      );
    });

    it("leaves blank HTML content unwrapped", () => {
      expect(htmlContent("").content).toBe("");
      expect(htmlContent(" \n\t ").content).toBe(" \n\t ");
      expect(
        htmlContent(
          "",
          "mailup-bee-newsletter-modules-html",
          "Arial, Helvetica Neue, Helvetica, sans-serif",
        ).content,
      ).toBe("");
    });

    it("leaves an html module with no html field blank and unwrapped", () => {
      const { content, report } = imported(
        template([
          column([
            {
              type: "mailup-bee-newsletter-modules-html",
              descriptor: {},
            },
          ]),
        ]),
      );
      const block = content.blocks[0];

      expect(block.type).toBe("html");
      if (block.type !== "html") return;
      expect(block.content).toBe("");
      expect(report.entries[0]).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-html",
        templaticalBlockType: "html",
        status: "converted",
      });
    });

    it("leaves an html module whose html string is missing blank and unwrapped", () => {
      const { content, report } = imported(
        template([
          column([
            {
              type: "mailup-bee-newsletter-modules-html",
              descriptor: { html: JSON.parse("{}") },
            },
          ]),
        ]),
      );
      const block = content.blocks[0];

      expect(block.type).toBe("html");
      if (block.type !== "html") return;
      expect(block.content).toBe("");
      expect(report.entries[0]).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-html",
        templaticalBlockType: "html",
        status: "converted",
      });
    });

    it("leaves an unknown module's fallback HTML unwrapped", () => {
      const { content, entry } = htmlContent(
        "<p>Field</p>",
        "mailup-bee-newsletter-modules-form",
      );

      expect(content).toBe("<p>Field</p>");
      expect(entry).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-form",
        templaticalBlockType: "html",
        status: "html-fallback",
        note: 'Unknown module type "mailup-bee-newsletter-modules-form" converted to HTML block.',
      });
    });
  });

  describe("merge-tag non-breaking spaces", () => {
    it("keeps the non-breaking space between two names", () => {
      expect(paragraphContent(GREETING)).toBe(
        '<p style="font-size:16px;line-height:19px;word-break:break-word;text-align:left;"><strong><span style="font-size:16px;line-height:19px;">Dear {{contact.first_name}}&nbsp;{{contact.last_name}},</span></strong></p>',
      );
    });

    it("keeps &#160; and a literal non-breaking space", () => {
      expect(
        paragraphContent(
          '<p>A<code data-bee-type="mergetag">&#160;</code>B</p>',
        ),
      ).toBe("<p>A&nbsp;B</p>");
      expect(
        paragraphContent(
          `<p>A<code data-bee-type="mergetag">${"\u00A0"}</code>B</p>`,
        ),
      ).toBe("<p>A&nbsp;B</p>");
      expect(
        paragraphContent(
          '<p>A<code data-bee-type="mergetag">&#xa0;</code>B</p>',
        ),
      ).toBe("<p>A&nbsp;B</p>");
    });

    it("keeps each non-breaking space and collapses the plain spaces between them", () => {
      expect(
        paragraphContent(
          '<p>A<code data-bee-type="mergetag">&nbsp; &nbsp;</code>B</p>',
        ),
      ).toBe("<p>A&nbsp; &nbsp;B</p>");
    });

    it("drops a merge-tag chip that has no text between two tokens", () => {
      expect(
        paragraphContent(
          '<p>{{left}}<code data-bee-type="mergetag"></code>{{right}}</p>',
        ),
      ).toBe("<p>{{left}}{{right}}</p>");
    });

    it("turns a plain-space chip into one plain space", () => {
      expect(
        paragraphContent(
          '<p>A<code data-bee-type="mergetag"> \n\t </code>B</p>',
        ),
      ).toBe("<p>A B</p>");
    });

    it("rewrites a whitespace-only merge-tag chip in linear time", () => {
      const chip = (n: number) =>
        `<p><code data-bee-type="mergetag">${"&nbsp; ".repeat(n)}</code></p>`;
      expect(paragraphContent(chip(4))).toBe(`<p>${"&nbsp; ".repeat(4)}</p>`);
      expectLinear((n) => {
        const html = chip(n);
        return () => convertModule(textModule(html), []);
      }, 1_000);
    }, 30_000);
  });
});
