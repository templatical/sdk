import { describe, expect, it } from "vitest";
import type { Block, SectionBlock } from "@templatical/types";
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

    it("copies module visibility onto every extra block", () => {
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

      expect(blocks.map((block) => block.type)).toEqual(["image", "social"]);
      expect(blocks.map((block) => block.visibility)).toEqual([
        { desktop: true, mobile: false },
        { desktop: true, mobile: false },
      ]);
      expect(section.visibility).toBeUndefined();
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
    it("drops a paragraph of empty inline elements and keeps text and nbsp paragraphs", () => {
      expect(paragraphContent(CORPUS_TEXT)).toBe(CORPUS_TEXT_IMPORTED);
    });

    it("keeps a paragraph whose only content is a break", () => {
      expect(paragraphContent("<p>Before</p><p><br></p><p>After</p>")).toBe(
        "<p>Before</p><p><br></p><p>After</p>",
      );
    });

    it("drops a paragraph whose only content is an empty merge-tag chip", () => {
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

    it("drops an empty paragraph when other visible content remains", () => {
      expect(paragraphContent("<p></p><div>Hi</div>")).toBe("<div>Hi</div>");
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
    });

    it("drops an empty paragraph between well-formed siblings", () => {
      expect(paragraphContent("<p>a</p><p></p><p>b</p>")).toBe(
        "<p>a</p><p>b</p>",
      );
    });

    it("ignores a paragraph tag inside a comment", () => {
      expect(paragraphContent("<p></p><!-- <p> --><p>x</p>")).toBe(
        "<!-- <p> --><p>x</p>",
      );
      expect(paragraphContent("<p></p><!-- <p> -->")).toBe(
        "<p></p><!-- <p> -->",
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
      expect(negative.entry.note).toBe(
        "Blank paragraph imported as a 37px spacer.",
      );
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
  });

  describe("html module alignment", () => {
    function htmlContent(
      html: string,
      type = "mailup-bee-newsletter-modules-html",
    ) {
      const { content, report } = imported(
        template([
          column([
            {
              type,
              descriptor: { html: { html } },
            },
          ]),
        ]),
      );
      const block = content.blocks[0];
      if (block?.type !== "html") {
        throw new Error(`expected html, got ${block?.type}`);
      }
      return { content: block.content, entry: report.entries[0] };
    }

    it("centres a Twig control tag the way BeeFree's export wraps it", () => {
      const { content, entry } = htmlContent(
        "{% for companion in guest.companions %}",
      );

      expect(content).toBe(
        '<div style="text-align:center" align="center">{% for companion in guest.companions %}</div>',
      );
      expect(entry).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-html",
        templaticalBlockType: "html",
        status: "converted",
      });
    });

    it("centres real HTML content", () => {
      const { content } = htmlContent("<p>Hello</p>");

      expect(content).toBe(
        '<div style="text-align:center" align="center"><p>Hello</p></div>',
      );
    });

    it("leaves blank HTML content unwrapped", () => {
      expect(htmlContent("").content).toBe("");
      expect(htmlContent(" \n\t ").content).toBe(" \n\t ");
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
