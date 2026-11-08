import { describe, it, expect } from "vitest";
import { HEADING_LEVEL_FONT_SIZE } from "@templatical/types";
import {
  convertModule,
  findStyleAttr,
  skippedModuleEntry,
} from "../block-mapper";
import type { BeeFreeeImageContent, BeeFreeeModule } from "../types";
import { expectLinear } from "./expectLinear";

function makeModule(
  type: string,
  descriptor: BeeFreeeModule["descriptor"],
): BeeFreeeModule {
  return { type, descriptor };
}

/** The first `<tag …>` in `html`. A quoted value is not split on `>`. */
function firstOpenTag(html: string, tag: string): string {
  const start = html.indexOf(`<${tag}`);
  if (start === -1) return "";
  let i = start + tag.length + 1;
  let quote = "";
  while (i < html.length) {
    const char = html[i] ?? "";
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return html.slice(start, i + 1);
    }
    i++;
  }
  return html.slice(start);
}

/** Attributes on one open tag. A quoted value stays a single attribute. */
function attributesOf(openTag: string): { name: string; value: string }[] {
  const attrs: { name: string; value: string }[] = [];
  let i = openTag[1] === "/" ? 2 : 1;
  while (i < openTag.length && /[a-z0-9]/i.test(openTag[i] ?? "")) i++;
  while (i < openTag.length && openTag[i] !== ">") {
    while (i < openTag.length && /[\s/]/.test(openTag[i] ?? "")) i++;
    if (i >= openTag.length || openTag[i] === ">") break;
    const nameStart = i;
    while (i < openTag.length && !/[\s=/>]/.test(openTag[i] ?? "")) i++;
    const name = openTag.slice(nameStart, i).toLowerCase();
    while (i < openTag.length && /\s/.test(openTag[i] ?? "")) i++;
    if (openTag[i] !== "=") {
      attrs.push({ name, value: "" });
      continue;
    }
    i++;
    while (i < openTag.length && /\s/.test(openTag[i] ?? "")) i++;
    const quote = openTag[i];
    if (quote === '"' || quote === "'") {
      const end = openTag.indexOf(quote, i + 1);
      attrs.push({
        name,
        value: end === -1 ? openTag.slice(i + 1) : openTag.slice(i + 1, end),
      });
      i = end === -1 ? openTag.length : end + 1;
      continue;
    }
    const valueStart = i;
    while (
      i < openTag.length &&
      !/\s/.test(openTag[i] ?? "") &&
      openTag[i] !== ">"
    )
      i++;
    attrs.push({ name, value: openTag.slice(valueStart, i) });
  }
  return attrs;
}

/** One `style` attribute, and no attribute the payload tried to inject. */
function expectClosedStyle(html: string, tag: string): string {
  expect(html).not.toContain('" onmouseover=');
  expect(html).not.toContain('"onmouseover=');
  expect(html).toContain("&quot;");
  const open = firstOpenTag(html, tag);
  const attrs = attributesOf(open);
  const styles = attrs.filter((attr) => attr.name === "style");
  expect(styles).toHaveLength(1);
  expect(attrs.some((attr) => attr.name === "onmouseover")).toBe(false);
  return styles[0]?.value ?? "";
}

describe("convertModule", () => {
  describe("text", () => {
    it("converts text module with HTML content and inline styles", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-text", {
        style: {
          "padding-top": "5px",
          "padding-right": "10px",
          "padding-bottom": "5px",
          "padding-left": "10px",
        },
        text: {
          style: {
            color: "#555555",
            "font-size": "14px",
            "text-align": "center",
          },
          html: "<p>Hello World</p>",
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("paragraph");
      if (block.type === "paragraph") {
        expect(block.content).toContain("Hello World");
        expect(block.content).toContain("color: #555555");
        expect(block.content).toContain("font-size: 14px");
        expect(block.content).toContain("text-align: center");
        // Styles should be on <p> and <span>, not on a <div> wrapper
        expect(block.content).not.toContain("<div");
      }
      expect(entry.status).toBe("converted");
      expect(entry.templaticalBlockType).toBe("paragraph");
      expect(warnings).toHaveLength(0);
    });

    it("uses plain content when no non-default text style provided", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-text", {
        text: {
          html: "<p>Plain</p>",
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("paragraph");
      if (block.type === "paragraph") {
        // No inline wrapper when all styles are defaults
        expect(block.content).toBe("<p>Plain</p>");
      }
    });

    // Regression: the old `/<p([^>]*)>([\s\S]*?)<\/p>/g` wrap pattern was
    // polynomial-ReDoS — every `<p` start re-scanned the rest of the input
    // for `</p>`. Adversarial input with many `<p>a` chunks but no `</p>`
    // used to stall the regex. The manual scanner is strictly linear.
    it("wraps paragraph content in linear time on `<p>a<p>a<p>a…` input (ReDoS regression)", () => {
      const wrap = (chunks: number) =>
        makeModule("mailup-bee-newsletter-modules-text", {
          text: {
            style: {
              // Non-default style triggers the wrap branch
              color: "#123456",
            },
            html: "<p>a".repeat(chunks),
          },
        });
      expect(convertModule(wrap(10_000), []).block.type).toBe("paragraph");
      expectLinear((n) => {
        const mod = wrap(n);
        return () => convertModule(mod, []);
      }, 4_000);
    });

    // Unclosed roots stay nested. Styling that chain has to stay linear.
    it.each([
      ["<li>a", "list"],
      ["<h1>a", "text"],
      ["<ul>a", "list"],
    ] as const)("styles unclosed %s in linear time", (chunk, kind) => {
      const styled = (tags: number) => {
        const payload = {
          style: { color: "#123456" },
          html: chunk.repeat(tags),
        };
        return makeModule(
          `mailup-bee-newsletter-modules-${kind}`,
          kind === "list" ? { list: payload } : { text: payload },
        );
      };
      expect(convertModule(styled(20_000), []).block.type).toBe("paragraph");
      expectLinear((n) => {
        const mod = styled(n);
        return () => convertModule(mod, []);
      }, 4_000);
    });
  });

  // BeeFree paragraphs are margin 0. An absent `paragraphSpacing` renders as
  // the 8px default, so every text or list block states its gap.
  describe("paragraph spacing", () => {
    function spacing(
      kind: "text" | "paragraph" | "list",
      html: string,
    ): number | undefined {
      const descriptor =
        kind === "text"
          ? { text: { html } }
          : kind === "paragraph"
            ? { paragraph: { html } }
            : { list: { html } };
      const { block } = convertModule(
        makeModule(`mailup-bee-newsletter-modules-${kind}`, descriptor),
        [],
      );
      if (block.type !== "paragraph") {
        throw new Error(`expected a paragraph, got ${block.type}`);
      }
      return block.paragraphSpacing;
    }

    it("uses 0 when no paragraph states a margin", () => {
      expect(spacing("text", "<p>One</p><p>Two</p>")).toBe(0);
      expect(spacing("paragraph", "<p>One</p><p>Two</p>")).toBe(0);
      expect(spacing("list", "<ul><li>One</li><li>Two</li></ul>")).toBe(0);
    });

    it("reads a paragraph module's computed paragraphSpacing", () => {
      const { block } = convertModule(
        makeModule("mailup-bee-newsletter-modules-paragraph", {
          paragraph: {
            html: "<p>One</p>\n<p>Two</p>",
            computedStyle: { paragraphSpacing: "16px" },
          },
        }),
        [],
      );
      expect(block.type).toBe("paragraph");
      if (block.type !== "paragraph") return;
      expect(block.paragraphSpacing).toBe(16);
    });

    it("lets computed paragraphSpacing win over a margin in the html", () => {
      const { block } = convertModule(
        makeModule("mailup-bee-newsletter-modules-paragraph", {
          paragraph: {
            html: '<p style="margin-bottom: 4px">One</p><p>Two</p>',
            computedStyle: { paragraphSpacing: "15.6px" },
          },
        }),
        [],
      );
      expect(block.type).toBe("paragraph");
      if (block.type !== "paragraph") return;
      expect(block.paragraphSpacing).toBe(16);
    });

    it("falls through to the html margin when paragraphSpacing is not px", () => {
      const { block } = convertModule(
        makeModule("mailup-bee-newsletter-modules-paragraph", {
          paragraph: {
            html: '<p style="margin-bottom: 12px">One</p>',
            computedStyle: { paragraphSpacing: "1em" },
          },
        }),
        [],
      );
      expect(block.type).toBe("paragraph");
      if (block.type !== "paragraph") return;
      expect(block.paragraphSpacing).toBe(12);
    });

    it("reads margin-bottom from the style attribute, not from text that merely contains style", () => {
      expect(
        spacing(
          "text",
          `<p title="x style='margin-bottom: 9px'" data-style="margin-bottom: 7px" style="margin-bottom: 4px">One</p>`,
        ),
      ).toBe(4);
      expect(
        spacing("text", "<p style=margin-bottom:6px>One</p><p>Two</p>"),
      ).toBe(6);
    });

    it("reads an explicit px margin-bottom", () => {
      expect(
        spacing("text", '<p style="margin-bottom: 12px">One</p><p>Two</p>'),
      ).toBe(12);
      expect(
        spacing(
          "list",
          '<ul><li><p style="margin-bottom: 9px">One</p></li></ul>',
        ),
      ).toBe(9);
    });

    it.each([
      ['<p style="margin: 4px 8px 6px">A</p>', 6],
      ['<p style="margin: 10px 20px">A</p>', 10],
      ['<p style="margin: 0 0 14px 0">A</p>', 14],
      ['<p style="margin: 8px">A</p>', 8],
      ["<p style='margin-bottom: 5px'>A</p>", 5],
    ])("reads the bottom of %s as %i", (html, gap) => {
      expect(spacing("paragraph", html)).toBe(gap);
    });

    it("lets a later margin-bottom replace the shorthand", () => {
      expect(
        spacing("text", '<p style="margin: 10px; margin-bottom: 3px">A</p>'),
      ).toBe(3);
    });

    it("ignores a non-px margin, including one that overrides a px shorthand", () => {
      expect(spacing("text", '<p style="margin-bottom: 1.5em">A</p>')).toBe(0);
      expect(
        spacing("text", '<p style="margin: 10px; margin-bottom: 2em">A</p>'),
      ).toBe(0);
      expect(spacing("text", '<p style="margin-bottom: -4px">A</p>')).toBe(0);
    });

    it("keeps the first explicit px margin when later paragraphs differ", () => {
      expect(
        spacing(
          "text",
          '<p style="margin-bottom: 0px">A</p><p style="margin-bottom: 14px">B</p>',
        ),
      ).toBe(0);
      expect(
        spacing(
          "text",
          '<p>A</p><p style="margin-bottom: 14px">B</p><p style="margin-bottom: 4px">C</p>',
        ),
      ).toBe(14);
    });

    it("rounds a fractional px margin the way other lengths are rounded", () => {
      expect(spacing("text", '<p style="margin-bottom: 8.6px">A</p>')).toBe(9);
      expect(spacing("text", '<p style="margin-bottom: 8.4px">A</p>')).toBe(8);
    });

    it("ignores style when it is only part of another attribute name", () => {
      expect(spacing("text", '<p mystyle="margin-bottom: 12px">A</p>')).toBe(0);
      expect(spacing("text", '<p stylesheet="margin-bottom: 12px">A</p>')).toBe(
        0,
      );
      expect(spacing("text", "<p style>A</p>")).toBe(0);
      expect(
        spacing(
          "text",
          '<p mystyle="margin-bottom: 12px">A</p><p style="margin-bottom: 7px">B</p>',
        ),
      ).toBe(7);
    });
  });

  describe("heading", () => {
    it("converts heading module to title block with level and styles", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        heading: {
          title: "h1",
          text: "Big Title",
          style: {
            "font-size": "32px",
            color: "#111111",
            "text-align": "center",
            "font-weight": "bold",
          },
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("title");
      if (block.type === "title") {
        expect(block.content).toBe(
          '<p><span style="font-size: 32px; font-weight: bold">Big Title</span></p>',
        );
        expect(block.level).toBe(1);
        expect(block.color).toBe("#111111");
        expect(block.textAlign).toBe("center");
      }
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe("h1 chosen for 32px; line box differs");
    });

    it("keeps text-align from the module when the heading style omits it", () => {
      const { block } = convertModule(
        makeModule("mailup-bee-newsletter-modules-heading", {
          style: { "text-align": "center" },
          heading: {
            title: "h1",
            text: "Welcome",
            style: {
              color: "#222222",
              "font-size": "18px",
              "line-height": "120%",
              "letter-spacing": "1px",
              "font-weight": "700",
              "font-family": "'Open Sans', sans-serif",
            },
          },
        }),
        [],
      );

      expect(block.type).toBe("title");
      if (block.type !== "title") return;
      expect(block.level).toBe(4);
      expect(block.color).toBe("#222222");
      expect(block.textAlign).toBe("center");
      expect(block.fontFamily).toBe("'Open Sans', sans-serif");
      expect(block.content).toBe(
        '<p><span style="font-size: 18px; line-height: 1.2; font-weight: 700; letter-spacing: 1px">Welcome</span></p>',
      );
    });

    it("keeps text-align written on the heading tag", () => {
      const { block } = convertModule(
        makeModule("mailup-bee-newsletter-modules-heading", {
          heading: {
            title: "h2",
            text: '<h2 style="font-size: 23px; text-align: right">Hi</h2>',
          },
        }),
        [],
      );

      expect(block.type).toBe("title");
      if (block.type !== "title") return;
      expect(block.textAlign).toBe("right");
      expect(block.content).toBe(
        '<p><span style="font-size: 23px">Hi</span></p>',
      );
      expect(block.level).toBe(3);
    });

    it("writes font size, line-height and weight onto the heading text", () => {
      const { block } = convertModule(
        makeModule("mailup-bee-newsletter-modules-heading", {
          heading: {
            title: "h1",
            text: "© Scherer Gruppe 2026",
            style: {
              color: "#ffffff",
              "font-size": "16px",
              "font-weight": "400",
              "line-height": "120%",
              "letter-spacing": "0px",
            },
          },
        }),
        [],
      );

      expect(block.type).toBe("title");
      if (block.type !== "title") return;
      expect(block.level).toBe(4);
      expect(block.color).toBe("#ffffff");
      expect(block.content).toBe(
        '<p><span style="font-size: 16px; line-height: 1.2; font-weight: 400">© Scherer Gruppe 2026</span></p>',
      );
    });

    it("reads font size from the heading tag when the style omits it", () => {
      const { block } = convertModule(
        makeModule("mailup-bee-newsletter-modules-heading", {
          heading: {
            title: "h1",
            text: '<h1 style="font-size: 18px; line-height: 150%; letter-spacing: 1px">Location</h1>',
          },
        }),
        [],
      );

      expect(block.type).toBe("title");
      if (block.type !== "title") return;
      expect(block.level).toBe(4);
      expect(block.content).toBe(
        '<p><span style="font-size: 18px; line-height: 1.5; letter-spacing: 1px">Location</span></p>',
      );
    });

    it("escapes a quote, an ampersand and a less-than in heading typography", () => {
      const heading = (style: Record<string, string>) => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-heading", {
            heading: { title: "h2", text: "Hi", style },
          }),
          [],
        );
        if (block.type !== "title") throw new Error("expected a title");
        return block.content;
      };

      const quoted = heading({
        "letter-spacing": '1px" onmouseover="x',
        "font-weight": 'bold" onmouseover="y',
      });
      expect(expectClosedStyle(quoted, "span")).toBe(
        "font-weight: bold&quot; onmouseover=&quot;y; letter-spacing: 1px&quot;onmouseover=&quot;x",
      );
      expect(findStyleAttr(firstOpenTag(quoted, "span"))?.value).toBe(
        'font-weight: bold" onmouseover="y; letter-spacing: 1px"onmouseover="x',
      );

      const marked = heading({ "letter-spacing": "1px&<" });
      expect(marked).toBe(
        '<p><span style="letter-spacing: 1px&amp;&lt;">Hi</span></p>',
      );
      expect(marked).not.toContain("&amp;amp;");
    });

    it("keeps an encoded quote inside heading typography and decodes one in the text", () => {
      const { block } = convertModule(
        makeModule("mailup-bee-newsletter-modules-heading", {
          heading: {
            title: "h2",
            text: "{{ say &quot;hi&quot; }}",
            style: {
              "font-weight":
                "{% if a == &#39;x&#39; &gt; 1 %}{{ b(&quot;c&quot;) onmouseover=&quot;y&quot; }}",
              "letter-spacing": "{{ x&quot; onmouseover=&quot;y }}",
            },
          },
        }),
        [],
      );
      if (block.type !== "title") throw new Error("expected a title");
      const style =
        "font-weight: {% if a == 'x' > 1 %}{{ b(&quot;c&quot;) onmouseover=&quot;y&quot; }}; letter-spacing: {{x&quot;onmouseover=&quot;y}}";
      expect(block.content).toBe(
        `<p><span style="${style}">{{ say "hi" }}</span></p>`,
      );
      expect(expectClosedStyle(block.content, "span")).toBe(style);
      expect(
        attributesOf(firstOpenTag(block.content, "span")).some(
          (attr) => attr.name === "onmouseover",
        ),
      ).toBe(false);
    });

    // The title line box is the level size from HEADING_LEVEL_FONT_SIZE
    // (h1 36, h2 28, h3 22, h4 18). The span keeps BeeFree's exact size.
    it.each([
      { px: 18, title: "h1", level: 4, lineBox: 18, note: undefined },
      { px: 23, title: "h1", level: 3, lineBox: 22, note: undefined },
      { px: 28, title: "h1", level: 2, lineBox: 28, note: undefined },
      {
        px: 32,
        title: "h1",
        level: 1,
        lineBox: 36,
        note: "h1 chosen for 32px; line box differs",
      },
      { px: 36, title: "h1", level: 1, lineBox: 36, note: undefined },
      {
        px: 48,
        title: "h2",
        level: 1,
        lineBox: 36,
        note: "h1 chosen for 48px (source h2); line box differs",
      },
      {
        px: 32,
        title: "h3",
        level: 2,
        lineBox: 28,
        note: "h2 chosen for 32px (source h3); line box differs",
      },
    ] as const)(
      "uses h$level for a $px px $title so the line box is $lineBox px",
      ({ px, title, level, lineBox, note }) => {
        const { block, entry } = convertModule(
          makeModule("mailup-bee-newsletter-modules-heading", {
            heading: {
              title,
              text: "Hello",
              style: { "font-size": `${px}px` },
            },
          }),
          [],
        );

        expect(block.type).toBe("title");
        if (block.type !== "title") return;
        expect(block.level).toBe(level);
        expect(HEADING_LEVEL_FONT_SIZE[block.level]).toBe(lineBox);
        expect(block.content).toBe(
          `<p><span style="font-size: ${px}px">Hello</span></p>`,
        );
        expect(entry.note).toBe(note);
        expect(entry.status).toBe(note ? "approximated" : "converted");
      },
    );
  });

  describe("image", () => {
    it("converts image with src, alt, width", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-image", {
        image: {
          src: "https://example.com/photo.jpg",
          alt: "A photo",
          width: "300px",
          href: "https://example.com",
          style: {
            "text-align": "center",
          },
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("image");
      if (block.type === "image") {
        expect(block.src).toBe("https://example.com/photo.jpg");
        expect(block.alt).toBe("A photo");
        expect(block.width).toBe(300);
        expect(block.linkUrl).toBe("https://example.com");
        expect(block.align).toBe("center");
      }
      expect(entry.status).toBe("converted");
    });

    // `image.width` × `image.height` is the file BeeFree was given (1920 × 466
    // for the hero in a real export), so carrying the height over pins the
    // file's height under a narrower shown width and stretches the image.
    it("never carries image.height over", () => {
      const warnings: string[] = [];
      const withHeight = convertModule(
        makeModule("mailup-bee-newsletter-modules-image", {
          image: { src: "https://x/p.jpg", width: "300px", height: "180px" },
        }),
        warnings,
      ).block;
      const auto = convertModule(
        makeModule("mailup-bee-newsletter-modules-image", {
          image: { src: "https://x/p.jpg", height: "auto" },
        }),
        warnings,
      ).block;

      if (withHeight.type !== "image" || auto.type !== "image")
        throw new Error("expected image blocks");
      expect(withHeight.width).toBe(300);
      expect(withHeight.height).toBeUndefined();
      expect(auto.height).toBeUndefined();
    });

    describe("shown width", () => {
      function shown(
        descriptor: BeeFreeeModule["descriptor"],
        columnWidth?: number,
      ) {
        const block = convertModule(
          makeModule("mailup-bee-newsletter-modules-image", descriptor),
          [],
          { columnWidth },
        ).block;
        if (block.type !== "image") throw new Error("expected an image block");
        return block;
      }

      // The two images of the real export in fixtures/example-1.json.
      it("reads computedStyle, not the file's size", () => {
        const logo = shown(
          {
            image: { src: "l.png", width: "254px", height: "59px" },
            computedStyle: { class: "left fixedwidth", width: "172.5px" },
          },
          600,
        );
        expect([logo.width, logo.height, logo.align]).toEqual([
          173,
          undefined,
          "left",
        ]);

        const hero = shown(
          {
            image: { src: "h.jpg", width: "1920px", height: "466px" },
            computedStyle: { class: "center autowidth", width: "600px" },
          },
          600,
        );
        expect([hero.width, hero.height, hero.align]).toEqual([
          "full",
          undefined,
          "center",
        ]);
      });

      it("stores the file's size as the natural size, only when both are stated", () => {
        const both = shown({
          image: { src: "p.jpg", width: "1920px", height: "466px" },
        });
        expect([both.naturalWidth, both.naturalHeight]).toEqual([1920, 466]);
        const auto = shown({
          image: { src: "p.jpg", width: "1920px", height: "auto" },
        });
        expect([auto.naturalWidth, auto.naturalHeight]).toEqual([
          undefined,
          undefined,
        ]);
      });

      // BeeFree shows an autowidth image at its file's width, capped at the
      // column, and records that in computedStyle.width: a 111px logo stays
      // 111px in an 800px template (#1069).
      it("shows an autowidth image at its computed width", () => {
        const logo = shown(
          {
            image: { src: "logo.png", alt: "Logo" },
            computedStyle: { class: "center autowidth", width: "111px" },
          },
          800,
        );
        expect([logo.width, logo.align]).toEqual([111, "center"]);
      });

      it("is full when an autowidth image's computed width reaches the room", () => {
        const at = (px: number) =>
          shown(
            {
              image: { src: "p.png" },
              computedStyle: { class: "autowidth", width: `${px}px` },
            },
            600,
          ).width;
        expect(at(600)).toBe("full");
        expect(at(599)).toBe(599);
      });

      it("falls back to the file's width for an autowidth image without a computed width", () => {
        const at = (file: string) =>
          shown(
            {
              image: { src: "p.png", width: file },
              computedStyle: { class: "center autowidth" },
            },
            600,
          ).width;
        expect(at("240px")).toBe(240);
        expect(at("1920px")).toBe("full");
      });

      // Older exports mark an image that fills its column `fullwidth`, and
      // record a computed width that leaves out the column's padding.
      it("imports a fullwidth image as full", () => {
        const image = shown(
          {
            image: { src: "p.png" },
            computedStyle: {
              class: "center  autowidth  fullwidth",
              width: 230,
            },
          },
          250,
        );
        expect(image.width).toBe("full");
      });

      // Older exports write computedStyle.width as a number of pixels.
      it("reads a numeric computed width", () => {
        const at = (width: number, columnWidth: number) =>
          shown(
            {
              image: { src: "p.png" },
              computedStyle: { class: "center fixedwidth", width },
            },
            columnWidth,
          ).width;
        expect(at(187.5, 250)).toBe(188);
        expect(at(500, 500)).toBe("full");
      });

      // The block stores px, which keeps its size on a phone where a
      // percentage would shrink, so a percentage under 100% is approximated.
      it("converts a computed percentage to px of the room", () => {
        const at = (width: string) => {
          const { block, entry } = convertModule(
            makeModule("mailup-bee-newsletter-modules-image", {
              image: { src: "p.png", width: "1920px" },
              computedStyle: { class: "center fixedwidth", width },
              style: { "padding-left": "10px", "padding-right": "10px" },
            }),
            [],
            { columnWidth: 600 },
          );
          if (block.type !== "image") throw new Error("expected an image");
          return { width: block.width, status: entry.status, note: entry.note };
        };
        expect(at("50%")).toEqual({
          width: 290,
          status: "approximated",
          note: "Image width 50% was converted to 290px.",
        });
        expect(at("33.3%").width).toBe(193);
        expect(at("100%")).toEqual({
          width: "full",
          status: "converted",
          note: undefined,
        });
        expect(at(" 120% ").width).toBe("full");

        // Without a column width there is no room to take a share of.
        const { block, entry } = convertModule(
          makeModule("mailup-bee-newsletter-modules-image", {
            image: { src: "p.png" },
            computedStyle: { width: "50%" },
          }),
          [],
          { columnWidth: undefined },
        );
        expect([block.type === "image" && block.width, entry.note]).toEqual([
          "full",
          "Image width 50% was converted to full width.",
        ]);
      });

      it("is full at exactly the room inside the image's padding", () => {
        const at = (px: number) =>
          shown(
            {
              style: { "padding-left": "20px", "padding-right": "20px" },
              image: { src: "p.jpg", width: "1200px" },
              computedStyle: { class: "fixedwidth", width: `${px}px` },
            },
            600,
          ).width;
        expect(at(560)).toBe("full");
        expect(at(559)).toBe(559);
      });

      it("falls back to image.width without computedStyle", () => {
        expect(
          shown({ image: { src: "p.jpg", width: "300px" } }, 600).width,
        ).toBe(300);
        expect(
          shown({ image: { src: "p.jpg", width: "600px" } }, 600).width,
        ).toBe("full");
      });

      it("keeps a px width as stated when the column is unknown", () => {
        expect(shown({ image: { src: "p.jpg", width: "900px" } }).width).toBe(
          900,
        );
      });

      it("imports an image with no width as full width", () => {
        expect(shown({ image: { src: "p.jpg" } }, 600).width).toBe("full");
      });

      it("prefers the image style's alignment over the class", () => {
        expect(
          shown({
            image: {
              src: "p.jpg",
              width: "100px",
              style: { "text-align": "right" },
            },
            computedStyle: { class: "left fixedwidth", width: "100px" },
          }).align,
        ).toBe("right");
      });

      it("resolves a percentage radius against the shown size", () => {
        const avatar = shown(
          {
            image: {
              src: "a.png",
              width: "400px",
              height: "400px",
              style: { "border-radius": "50%" },
            },
            computedStyle: { class: "center fixedwidth", width: "120px" },
          },
          600,
        );
        expect(avatar.borderRadius).toBe(60);
      });
    });

    // BeeFree keeps the radius in the image's own `style` map rather than
    // alongside width/height, so it is read from a different place than every
    // other image property here.
    it("carries a px corner radius from the image style", () => {
      const warnings: string[] = [];
      const rounded = convertModule(
        makeModule("mailup-bee-newsletter-modules-image", {
          image: {
            src: "https://x/p.jpg",
            width: "120px",
            style: { "border-radius": "60px" },
          },
        }),
        warnings,
      ).block;
      const square = convertModule(
        makeModule("mailup-bee-newsletter-modules-image", {
          image: { src: "https://x/p.jpg", width: "120px" },
        }),
        warnings,
      ).block;

      if (rounded.type !== "image" || square.type !== "image")
        throw new Error("expected image blocks");
      expect(rounded.borderRadius).toBe(60);
      expect(square.borderRadius).toBeUndefined();
    });

    function imageWith(image: BeeFreeeImageContent) {
      const block = convertModule(
        makeModule("mailup-bee-newsletter-modules-image", { image }),
        [],
      ).block;
      if (block.type !== "image") throw new Error("expected an image block");
      return block;
    }

    // `border-radius: 50%` is the idiomatic way to write a circular avatar, so
    // it resolves against the width the template stated — a 120px square lands
    // on 60, the same block a literal `60px` produces.
    it("resolves a percentage radius against the stated width", () => {
      expect(
        imageWith({
          src: "https://x/p.jpg",
          width: "120px",
          style: { "border-radius": "50%" },
        }).borderRadius,
      ).toBe(60);
    });

    // 600 is `convertImage`'s fallback, not something BeeFree said.
    it("drops a percentage radius when no width was stated", () => {
      expect(
        imageWith({
          src: "https://x/p.jpg",
          style: { "border-radius": "50%" },
        }).borderRadius,
      ).toBeUndefined();
    });

    it("drops a negative radius", () => {
      expect(
        imageWith({
          src: "https://x/p.jpg",
          width: "120px",
          style: { "border-radius": "-5px" },
        }).borderRadius,
      ).toBeUndefined();
    });

    it("creates default block when no image descriptor", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-image", {});

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("image");
      if (block.type === "image") {
        expect(block.src).toBe("");
      }
    });
  });

  describe("button", () => {
    it("strips HTML tags from button label", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-button", {
        button: {
          label: "<span>Click <b>Me</b></span>",
          href: "https://example.com",
          style: {
            "background-color": "#ff0000",
            color: "#ffffff",
            "border-radius": "8px",
            "font-size": "18px",
          },
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("button");
      if (block.type === "button") {
        expect(block.text).toBe("Click Me");
        expect(block.url).toBe("https://example.com");
        expect(block.backgroundColor).toBe("#ff0000");
        expect(block.textColor).toBe("#ffffff");
        expect(block.borderRadius).toBe(8);
        expect(block.fontSize).toBe(18);
      }
    });

    it("carries the button's alignment across", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-button", {
        button: {
          label: "Click Me",
          href: "https://example.com",
          style: { "text-align": "left" },
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("button");
      if (block.type === "button") {
        expect(block.align).toBe("left");
      }
    });

    it("falls back to center when the button has no alignment", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-button", {
        button: { label: "Click Me", href: "https://example.com", style: {} },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("button");
      if (block.type === "button") {
        expect(block.align).toBe("center");
      }
    });

    it("uses default styles when no button descriptor", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-button", {});

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("button");
      if (block.type === "button") {
        expect(block.backgroundColor).toBe("#333333");
        expect(block.textColor).toBe("#ffffff");
      }
    });

    // Regression: the old `.replace(/<[^>]*>/g, "")` was both incomplete
    // sanitization (left an unterminated `<script` in the label) and
    // polynomial-ReDoS on `<<<<…` inputs. The new `stripTagsPlain` walks
    // the string linearly and discards trailing unterminated tags.
    it("strips unterminated `<script` from the button label (sanitizer regression)", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-button", {
        button: { label: "Hello <script", href: "https://x.test" },
      });
      const { block } = convertModule(mod, warnings);
      if (block.type === "button") {
        expect(block.text).toBe("Hello ");
        expect(block.text).not.toContain("<");
        expect(block.text).not.toContain(">");
      }
    });

    function buttonWith(
      style: Record<string, string | number>,
      moduleStyle?: Record<string, string>,
      label = "Go",
    ) {
      const { block, entry } = convertModule(
        makeModule("mailup-bee-newsletter-modules-button", {
          ...(moduleStyle ? { style: moduleStyle } : {}),
          button: {
            label,
            href: "https://example.com",
            // BeeFree JSON stores a numeric font-weight; the descriptor type
            // only names strings.
            style: style as Record<string, string>,
          },
        }),
        [],
      );
      if (block.type !== "button") throw new Error("expected a button block");
      return { block, entry };
    }

    it("keeps explicit zero padding on every button side", () => {
      const { block } = buttonWith({
        "padding-top": "0px",
        "padding-right": "0px",
        "padding-bottom": "0px",
        "padding-left": "0px",
      });
      expect(block.buttonPadding).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
    });

    it("adds only line-height compensation to zero vertical padding", () => {
      const { block } = buttonWith({
        "font-size": "16px",
        "line-height": "200%",
        "padding-top": "0px",
        "padding-bottom": "0px",
      });
      expect(block.buttonPadding).toEqual({
        top: 6,
        right: 24,
        bottom: 6,
        left: 24,
      });
    });

    it("keeps one-pixel padding on every button side", () => {
      const { block } = buttonWith({
        "padding-top": "1px",
        "padding-right": "1px",
        "padding-bottom": "1px",
        "padding-left": "1px",
      });
      expect(block.buttonPadding).toEqual({
        top: 1,
        right: 1,
        bottom: 1,
        left: 1,
      });
    });

    it.each([
      ["0px", { top: 0, right: 0, bottom: 0, left: 0 }],
      ["4px 8px", { top: 4, right: 8, bottom: 4, left: 8 }],
      ["1px 2px 3px", { top: 1, right: 2, bottom: 3, left: 2 }],
      ["1px 2px 3px 4px", { top: 1, right: 2, bottom: 3, left: 4 }],
    ] as const)("expands button padding shorthand %s", (padding, expected) => {
      expect(buttonWith({ padding }).block.buttonPadding).toEqual(expected);
    });

    it("lets a readable longhand override its shorthand side", () => {
      expect(
        buttonWith({ padding: "4px 8px", "padding-left": "0px" }).block
          .buttonPadding,
      ).toEqual({
        top: 4,
        right: 8,
        bottom: 4,
        left: 0,
      });
    });

    it("uses defaults for missing, unreadable, and negative padding", () => {
      expect(buttonWith({}).block.buttonPadding).toEqual({
        top: 12,
        right: 24,
        bottom: 12,
        left: 24,
      });
      expect(
        buttonWith({
          "padding-top": "auto",
          "padding-right": "-1px",
          "padding-bottom": "-0.4px",
          "padding-left": "2em",
        }).block.buttonPadding,
      ).toEqual({
        top: 12,
        right: 24,
        bottom: 12,
        left: 24,
      });
      expect(buttonWith({ padding: "auto" }).block.buttonPadding).toEqual({
        top: 12,
        right: 24,
        bottom: 12,
        left: 24,
      });
    });

    it("drops a whole shorthand with a negative side but keeps valid longhands", () => {
      expect(
        buttonWith({ padding: "4px -0.4px", "padding-left": "3px" }).block
          .buttonPadding,
      ).toEqual({
        top: 12,
        right: 24,
        bottom: 12,
        left: 3,
      });
      expect(
        buttonWith({ padding: "4px 8px", "padding-left": "-0.4px" }).block
          .buttonPadding,
      ).toEqual({
        top: 4,
        right: 8,
        bottom: 4,
        left: 8,
      });
    });

    // The renderer's button label line box is 1.2× the font size (MJML's
    // `line-height: 120%`). Beefree's usual 200% is taller, and that extra
    // half goes into the top and bottom padding.
    it("folds a 200% line-height into the top and bottom padding", () => {
      const { block } = buttonWith({
        "font-size": "14px",
        "line-height": "200%",
        "padding-top": "10px",
        "padding-right": "20px",
        "padding-bottom": "10px",
        "padding-left": "20px",
      });
      // (28 - 1.2×14) / 2 = 5.6, rounded to 6.
      expect(block.buttonPadding).toEqual({
        top: 16,
        right: 20,
        bottom: 16,
        left: 20,
      });
    });

    it("folds a unitless line-height the same way as a percentage", () => {
      const { block } = buttonWith({
        "font-size": "16px",
        "line-height": "2",
        "padding-top": "5px",
        "padding-bottom": "5px",
      });
      // (32 - 1.2×16) / 2 = 6.4, rounded to 6. Side padding stays the default.
      expect(block.buttonPadding.top).toBe(11);
      expect(block.buttonPadding.bottom).toBe(11);
    });

    it("reads a px line-height as that many pixels", () => {
      const { block } = buttonWith({
        "font-size": "14px",
        "line-height": "28px",
        "padding-top": "10px",
        "padding-bottom": "10px",
      });
      expect(block.buttonPadding.top).toBe(16);
      expect(block.buttonPadding.bottom).toBe(16);
    });

    it("leaves padding alone when the line-height is already 120%", () => {
      const { block } = buttonWith({
        "font-size": "14px",
        "line-height": "120%",
        "padding-top": "10px",
        "padding-bottom": "10px",
      });
      expect(block.buttonPadding.top).toBe(10);
      expect(block.buttonPadding.bottom).toBe(10);
    });

    it("does not shrink padding when the line-height is under 120%", () => {
      const { block } = buttonWith({
        "font-size": "14px",
        "line-height": "100%",
        "padding-top": "10px",
        "padding-bottom": "10px",
      });
      expect(block.buttonPadding.top).toBe(10);
      expect(block.buttonPadding.bottom).toBe(10);
    });

    // Nearest of 400, 500 and 700. A tie takes the lighter stop, so 450 is
    // regular and 600 is medium. Bold is the renderer's own weight, so it
    // leaves the field unset.
    it.each([
      ["400", "regular"],
      ["450", "regular"],
      ["normal", "regular"],
      [400, "regular"],
      ["451", "medium"],
      ["500", "medium"],
      ["599", "medium"],
      ["600", "medium"],
      [600, "medium"],
    ] as const)("maps font-weight %s to %s", (raw, weight) => {
      const { block, entry } = buttonWith({ "font-weight": raw });
      expect(block.fontWeight).toBe(weight);
      expect(entry.status).toBe("converted");
      expect(entry.note).toBeUndefined();
    });

    it.each([
      "601",
      "700",
      "800",
      "bold",
      "BOLD",
      "bolder",
      " 700 ",
      700,
    ] as const)(
      "leaves font-weight %s unset because the label already renders bold",
      (raw) => {
        const { block, entry } = buttonWith({ "font-weight": raw });
        expect(block.fontWeight).toBeUndefined();
        expect(entry.status).toBe("converted");
        expect(entry.note).toBeUndefined();
      },
    );

    it("imports a missing or unreadable weight as regular without a note", () => {
      for (const raw of [undefined, "", "inherit", "lighter"]) {
        const { block, entry } = buttonWith(
          raw === undefined ? {} : { "font-weight": raw },
        );
        expect(block.fontWeight).toBe("regular");
        expect(entry.status).toBe("converted");
        expect(entry.note).toBeUndefined();
      }
    });

    it.each([
      ["<p><strong>Go</strong></p>", undefined],
      ["<p><b>Go</b></p>", undefined],
      ['<p><span style="font-weight:700">Go</span></p>', undefined],
      ['<p><span style="font-weight:bold">Go</span></p>', undefined],
      ['<p><span style="font-weight:bolder">Go</span></p>', undefined],
      ['<p><span style="font-weight:600">Go</span></p>', undefined],
      ['<p><span style="color:red; font-weight: 700">Go</span></p>', undefined],
      ["<p> \n <strong>Go</strong> </p>", undefined],
      ["<p><!-- plain --><strong>Go</strong></p>", undefined],
      ["<p><strong>Go</strong></p><!-- unclosed", undefined],
      ["<p>Go</p>", "regular"],
    ] as const)("maps missing weight for label %s", (label, expected) => {
      const { block, entry } = buttonWith({}, undefined, label);
      expect(block.fontWeight).toBe(expected);
      expect(entry.status).toBe("converted");
      expect(entry.note).toBeUndefined();
    });

    it.each([
      "<p><strong>Go</strong><x:y></p>",
      "<p><strong>Go</strong><!doctype x></p>",
      "<p><strong>Go</strong>></p>",
      "<p><strong>Go</strong>< unclosed",
    ])("counts only text the label keeps in %s", (label) => {
      const { block, entry } = buttonWith({}, undefined, label);
      expect(block.text).toBe("Go");
      expect(block.fontWeight).toBeUndefined();
      expect(entry.status).toBe("converted");
      expect(entry.note).toBeUndefined();
    });

    it("notes partial bold once when a missing weight flattens a mixed label", () => {
      const { block, entry } = buttonWith(
        {},
        undefined,
        "<p>Pay <strong>now</strong></p>",
      );
      expect(block.text).toBe("Pay now");
      expect(block.fontWeight).toBe("regular");
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "partial bold in the label is not carried; button imports at regular weight",
      );
    });

    it("keeps one note when partial bold and letter spacing are both dropped", () => {
      const { block, entry } = buttonWith(
        { "letter-spacing": "1px" },
        undefined,
        "Pay <b>now</b>",
      );
      expect(block.fontWeight).toBe("regular");
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "letter spacing 1px, partial bold in the label are not carried; button imports at regular weight",
      );
    });

    it("keeps an all-strong label bold when the style weight is 400", () => {
      const { block, entry } = convertModule(
        makeModule("mailup-bee-newsletter-modules-button", {
          button: {
            label:
              '<div class="txtTinyMce-wrapper"><p style="word-break:break-word;"><strong>REGISTER NOW</strong></p></div>',
            href: "https://example.com",
            style: { "font-weight": "400", "font-size": "14px" },
          },
        }),
        [],
      );
      expect(block.type).toBe("button");
      if (block.type !== "button") return;
      expect(block.text).toBe("REGISTER NOW");
      expect(block.fontWeight).toBeUndefined();
      expect(entry.status).toBe("converted");
      expect(entry.note).toBeUndefined();
    });

    it("keeps an all-b label bold when the style weight is 500", () => {
      const { block, entry } = buttonWith(
        { "font-weight": "500" },
        undefined,
        "<p><b>Go</b></p>",
      );
      expect(block.fontWeight).toBeUndefined();
      expect(entry.status).toBe("converted");
      expect(entry.note).toBeUndefined();
    });

    it("notes lost partial bold when weight 400 is set", () => {
      const { block, entry } = convertModule(
        makeModule("mailup-bee-newsletter-modules-button", {
          button: {
            label: "<p>Pay <strong>now</strong></p>",
            href: "https://example.com",
            style: { "font-weight": "400" },
          },
        }),
        [],
      );
      expect(block.type).toBe("button");
      if (block.type !== "button") return;
      expect(block.text).toBe("Pay now");
      expect(block.fontWeight).toBe("regular");
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "partial bold in the label is not carried; button imports at regular weight",
      );
    });

    it("keeps a readable medium weight and notes lost partial bold", () => {
      const { block, entry } = buttonWith(
        { "font-weight": "500" },
        undefined,
        "Go <strong>now</strong>",
      );
      expect(block.fontWeight).toBe("medium");
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "partial bold in the label is not carried; button imports at medium weight",
      );
    });

    it("does not note partial bold when the style weight is already bold", () => {
      const { block, entry } = buttonWith(
        { "font-weight": "700" },
        undefined,
        "Go <strong>now</strong>",
      );
      expect(block.fontWeight).toBeUndefined();
      expect(entry.status).toBe("converted");
      expect(entry.note).toBeUndefined();
    });

    it("imports a 100% width as full and keeps the module alignment", () => {
      const { block, entry } = buttonWith(
        { width: "100%" },
        { "text-align": "left" },
      );
      expect(block.width).toBe("full");
      expect(block.align).toBe("left");
      expect(entry.status).toBe("converted");
      expect(entry.note).toBeUndefined();
    });

    it("notes a percentage width other than 100% and sizes the button to its label", () => {
      const { block, entry } = buttonWith(
        { width: "50%" },
        { "text-align": "right" },
      );
      expect(block.width).toBeUndefined();
      expect(block.align).toBe("right");
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe("width 50% is not carried");
    });

    it("keeps a px width and leaves auto width unset", () => {
      expect(buttonWith({ width: "240px" }).block.width).toBe(240);
      expect(buttonWith({ width: "auto" }).block.width).toBeUndefined();
      expect(buttonWith({}).block.width).toBeUndefined();
    });

    it("maps a drawn border and drops one that paints nothing", () => {
      const drawn = buttonWith({
        "border-top": "2px solid #112233",
        "border-right": "2px solid #112233",
        "border-bottom": "2px solid #112233",
        "border-left": "2px solid #112233",
      });
      expect(drawn.block.border).toEqual({
        top: { width: 2, style: "solid", color: "#112233" },
        right: { width: 2, style: "solid", color: "#112233" },
        bottom: { width: 2, style: "solid", color: "#112233" },
        left: { width: 2, style: "solid", color: "#112233" },
      });
      expect(drawn.entry.status).toBe("converted");

      const ghost = buttonWith({
        "border-top": "0px solid transparent",
        "border-right": "0px solid transparent",
        "border-bottom": "0px solid transparent",
        "border-left": "0px solid transparent",
      });
      expect(ghost.block.border).toBeUndefined();
    });

    it("keeps a single drawn side and reads double as solid", () => {
      const { block } = buttonWith({
        "border-bottom": "1px dashed #abcdef",
        "border-top": "3px double #000000",
      });
      expect(block.border).toEqual({
        top: { width: 3, style: "solid", color: "#000000" },
        right: { width: 0, style: "solid", color: "#000000" },
        bottom: { width: 1, style: "dashed", color: "#abcdef" },
        left: { width: 0, style: "solid", color: "#000000" },
      });
    });

    it("names a letter-spacing in one note and drops a zero", () => {
      const spaced = buttonWith({
        "font-weight": "bold",
        "letter-spacing": "1px",
      });
      expect(spaced.block).not.toHaveProperty("letterSpacing");
      expect(spaced.entry.status).toBe("approximated");
      expect(spaced.entry.note).toBe("letter spacing 1px is not carried");

      const tight = buttonWith({
        "font-weight": "700",
        "letter-spacing": "-1px",
      });
      expect(tight.entry.note).toBe("letter spacing -1px is not carried");

      const em = buttonWith({
        "font-weight": "bold",
        "letter-spacing": "0.05em",
      });
      expect(em.entry.note).toBe("letter spacing 0.05em is not carried");

      for (const letterSpacing of ["0px", "0", "normal"]) {
        const { block, entry } = buttonWith({
          "font-weight": "bold",
          "letter-spacing": letterSpacing,
        });
        expect(block).not.toHaveProperty("letterSpacing");
        expect(entry.status).toBe("converted");
        expect(entry.note).toBeUndefined();
      }
    });

    it("names letter-spacing and a percentage width, and still maps the weight", () => {
      const { block, entry } = buttonWith({
        "font-weight": "400",
        "letter-spacing": "1px",
        width: "50%",
      });
      expect(block.fontWeight).toBe("regular");
      expect(block).not.toHaveProperty("letterSpacing");
      expect(block.width).toBeUndefined();
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe("letter spacing 1px, width 50% are not carried");
    });

    it("maps a non-bold weight and drops a zero letter-spacing without a note", () => {
      const { block, entry } = buttonWith({
        "font-weight": "400",
        "letter-spacing": "0px",
      });
      expect(block.fontWeight).toBe("regular");
      expect(entry.status).toBe("converted");
      expect(entry.note).toBeUndefined();
    });

    it("strips button label in linear time on adversarial `<<<<…` input (ReDoS regression)", () => {
      const button = (opens: number) =>
        makeModule("mailup-bee-newsletter-modules-button", {
          button: { label: "<".repeat(opens) + "Buy", href: "https://x.test" },
        });
      const { block } = convertModule(button(50_000), []);
      // First `<` opens a tag that never closes — stripper bails and
      // discards the rest, leaving an empty label.
      expect(block).toMatchObject({ type: "button", text: "" });
      expectLinear((n) => {
        const mod = button(n);
        return () => convertModule(mod, []);
      }, 2_000);
    });
  });

  describe("divider", () => {
    it("parses border-top from divider style", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-divider", {
        divider: {
          style: {
            "border-top": "3px dashed #aabbcc",
            width: "75%",
          },
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("divider");
      if (block.type === "divider") {
        expect(block.thickness).toBe(3);
        expect(block.lineStyle).toBe("dashed");
        expect(block.color).toBe("#aabbcc");
        expect(block.width).toBe("75%");
      }
      expect(entry.status).toBe("converted");
      expect(entry.note).toBeUndefined();
    });

    function dividerWith(
      descriptor: BeeFreeeModule["descriptor"],
      context?: Parameters<typeof convertModule>[2],
    ) {
      const { block, entry } = convertModule(
        makeModule("mailup-bee-newsletter-modules-divider", descriptor),
        [],
        context,
      );
      if (block.type !== "divider") throw new Error("expected a divider block");
      return { block, entry };
    }

    // A numeric width means pixels, so a percentage must never come through
    // as a bare number: 100% would render as a 100px stub.
    it("imports 100% as full, not as 100 pixels", () => {
      const { block, entry } = dividerWith({
        divider: {
          style: { "border-top": "1px solid #aaaaaa", width: "100%" },
        },
      });
      expect(block.width).toBe("full");
      expect(entry.status).toBe("converted");
    });

    it("imports a divider with no width as full", () => {
      const { block } = dividerWith({
        divider: { style: { "border-top": "1px solid #aaaaaa" } },
      });
      expect(block.width).toBe("full");
    });

    it("keeps a px width as pixels when the column is unknown", () => {
      const { block, entry } = dividerWith({
        divider: { style: { width: "580px" } },
      });
      expect(block.width).toBe(580);
      expect(entry.status).toBe("converted");
    });

    // MJML draws a full divider across the column minus the divider's own
    // padding, so a px width that reaches that already renders as full.
    it("reads a px width that reaches the column's content width as full", () => {
      const descriptor = (width: string): BeeFreeeModule["descriptor"] => ({
        divider: { style: { width } },
        style: { "padding-left": "10px", "padding-right": "10px" },
      });
      expect(
        dividerWith(descriptor("580px"), { columnWidth: 600 }).block.width,
      ).toBe("full");
      expect(
        dividerWith(descriptor("700px"), { columnWidth: 600 }).block.width,
      ).toBe("full");
      expect(
        dividerWith(descriptor("579px"), { columnWidth: 600 }).block.width,
      ).toBe(579);
    });

    it("clamps an out-of-range percentage and says so in the note", () => {
      const over = dividerWith({ divider: { style: { width: "150%" } } });
      expect(over.block.width).toBe("full");
      expect(over.entry.status).toBe("approximated");
      expect(over.entry.note).toBe("Divider width 150% was clamped to 100%.");

      const under = dividerWith({ divider: { style: { width: "-10%" } } });
      expect(under.block.width).toBe("0%");
      expect(under.entry.status).toBe("approximated");
      expect(under.entry.note).toBe("Divider width -10% was clamped to 0%.");
    });

    it("clamps a negative px width to zero and says so in the note", () => {
      const { block, entry } = dividerWith({
        divider: { style: { width: "-5px" } },
      });
      expect(block.width).toBe(0);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe("Divider width -5px was clamped to 0px.");
    });

    // A float printed in exponent form ("1e-7%") would fall outside
    // `DividerPercentWidth`'s pattern and fail validation.
    it("keeps a percentage to two decimals", () => {
      expect(
        dividerWith({ divider: { style: { width: "37.5%" } } }).block.width,
      ).toBe("37.5%");
      expect(
        dividerWith({ divider: { style: { width: "33.3333%" } } }).block.width,
      ).toBe("33.33%");
      expect(
        dividerWith({ divider: { style: { width: "0.0000001%" } } }).block
          .width,
      ).toBe("0%");
    });

    it("imports an unreadable width as full, and says so in the note", () => {
      const { block, entry } = dividerWith({
        divider: { style: { width: "auto" } },
      });
      expect(block.width).toBe("full");
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        'Divider width "auto" could not be read; imported as full width.',
      );
    });

    // Templatical centres every divider, so only a divider narrower than its
    // column loses anything by it.
    it("approximates a left- or right-aligned partial divider", () => {
      const left = dividerWith({
        divider: { style: { width: "50%" } },
        computedStyle: { align: "left" },
      });
      expect(left.block.width).toBe("50%");
      expect(left.entry.status).toBe("approximated");
      expect(left.entry.note).toBe(
        "BeeFree aligns this divider left; Templatical centres every divider.",
      );

      const right = dividerWith({
        divider: { style: { width: "200px" } },
        computedStyle: { align: "right" },
      });
      expect(right.entry.status).toBe("approximated");
      expect(right.entry.note).toBe(
        "BeeFree aligns this divider right; Templatical centres every divider.",
      );
    });

    it("reads the alignment from the module style when computedStyle has none", () => {
      const { entry } = dividerWith({
        divider: { style: { width: "50%" } },
        style: { "text-align": "right" },
      });
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "BeeFree aligns this divider right; Templatical centres every divider.",
      );
    });

    it("keeps a centred partial divider and an aligned full one converted", () => {
      const centred = dividerWith({
        divider: { style: { width: "50%" } },
        computedStyle: { align: "center" },
      });
      expect(centred.entry.status).toBe("converted");

      const full = dividerWith({
        divider: { style: { width: "100%" } },
        computedStyle: { align: "left" },
      });
      expect(full.block.width).toBe("full");
      expect(full.entry.status).toBe("converted");
      expect(full.entry.note).toBeUndefined();
    });
  });

  // BeeFree templates space content with dividers that draw nothing: only
  // their padding, and a transparent border's width, take up room (#1070).
  describe("divider that draws no line", () => {
    function invisible(
      borderTop: string,
      style: Record<string, string> = {
        "padding-top": "15px",
        "padding-right": "10px",
        "padding-bottom": "15px",
        "padding-left": "10px",
      },
    ) {
      return convertModule(
        makeModule("mailup-bee-newsletter-modules-divider", {
          divider: { style: { "border-top": borderTop, width: "100%" } },
          style,
        }),
        [],
        { columnWidth: 600 },
      );
    }

    function spacerHeight(borderTop: string): number {
      const { block } = invisible(borderTop);
      if (block.type !== "spacer") throw new Error(`expected a spacer`);
      return block.height;
    }

    it("imports a 0px border as a spacer as tall as the padding", () => {
      const { block, entry } = invisible("0px solid transparent");
      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(30);
      expect(block.styles.padding).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
      expect(entry).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-divider",
        templaticalBlockType: "spacer",
        status: "converted",
        note: "The divider draws no line; imported as a 30px spacer.",
      });
    });

    it("adds a transparent border's width to the height", () => {
      expect(spacerHeight("10px solid transparent")).toBe(40);
      expect(spacerHeight("1px solid rgba(0, 0, 0, 0)")).toBe(31);
      expect(spacerHeight("2px solid #ffffff00")).toBe(32);
      expect(spacerHeight("2px solid hsl(0 0% 100% / 0%)")).toBe(32);
    });

    it("leaves out a 0px, none or hidden border's width", () => {
      expect(spacerHeight("0px solid #BBBBBB")).toBe(30);
      expect(spacerHeight("0 solid #BBBBBB")).toBe(30);
      expect(spacerHeight("3px none #BBBBBB")).toBe(30);
      expect(spacerHeight("3px hidden #BBBBBB")).toBe(30);
    });

    // CSS drops a negative padding, so it takes no room and takes none away.
    it("leaves out a negative padding", () => {
      const mixed = invisible("20px solid transparent", {
        "padding-top": "-30px",
        "padding-bottom": "5px",
      });
      expect(mixed.block.type === "spacer" && mixed.block.height).toBe(25);
      expect(
        skippedModuleEntry(
          makeModule("mailup-bee-newsletter-modules-divider", {
            divider: { style: { "border-top": "0px solid transparent" } },
            style: { "padding-top": "-10px" },
          }),
        )?.status,
      ).toBe("skipped");
    });

    it("keeps the module's background colour on the spacer", () => {
      const { block } = invisible("0px solid transparent", {
        "padding-top": "10px",
        "padding-bottom": "10px",
        "background-color": "#F0F0F0",
      });
      expect(block.styles.backgroundColor).toBe("#f0f0f0");
    });

    it("keeps a divider whose border is drawn", () => {
      for (const borderTop of [
        "1px solid #BBBBBB",
        "1px solid rgba(0, 0, 0, 0.5)",
        "2px solid #ffffff80",
      ]) {
        const { block, entry } = invisible(borderTop);
        expect([block.type, entry.status]).toEqual(["divider", "converted"]);
      }
      const { block } = invisible("1px solid rgba(0, 0, 0, 0.5)");
      if (block.type !== "divider") throw new Error("expected a divider");
      expect([block.thickness, block.color]).toEqual([1, "rgba(0, 0, 0, 0.5)"]);
    });
  });

  describe("icons", () => {
    const ICONS = "mailup-bee-newsletter-modules-icons";

    function iconsModule(
      icons: Array<Record<string, string>>,
      overrides: Partial<BeeFreeeModule["descriptor"]> = {},
    ): BeeFreeeModule {
      return makeModule(ICONS, {
        iconsList: { icons },
        computedStyle: {
          iconHeight: "32px",
          iconSpacing: {
            "padding-top": "5px",
            "padding-right": "6px",
            "padding-bottom": "5px",
            "padding-left": "5px",
          },
          itemSpacing: "0px",
        } as unknown as Record<string, string>,
        style: {
          color: "#9d9d9d",
          "font-family": "inherit",
          "font-size": "15px",
          "padding-top": "5px",
          "padding-right": "0px",
          "padding-bottom": "5px",
          "padding-left": "0px",
          "text-align": "center",
        },
        ...overrides,
      });
    }

    const gift = {
      image: "https://example.com/gift.png",
      alt: "Gift",
      href: "https://example.com/gift",
      target: "_blank",
      text: "",
      textPosition: "right",
      width: "48px",
      height: "48px",
    };

    it("imports a single icon without text as an image at the icon height", () => {
      const { block, entry } = convertModule(iconsModule([gift]), [], {
        columnWidth: 600,
      });
      expect(block.type).toBe("image");
      if (block.type !== "image") return;
      expect(block).toMatchObject({
        src: "https://example.com/gift.png",
        alt: "Gift",
        width: 32,
        naturalWidth: 48,
        naturalHeight: 48,
        align: "center",
        linkUrl: "https://example.com/gift",
      });
      // The module's padding plus the space BeeFree keeps around each icon.
      expect(block.styles.padding).toEqual({
        top: 10,
        right: 6,
        bottom: 10,
        left: 5,
      });
      expect(entry).toEqual({
        beeFreeModuleType: ICONS,
        templaticalBlockType: "image",
        status: "converted",
      });
    });

    it("keeps the icon's px width when the column is unknown", () => {
      const { block } = convertModule(iconsModule([gift]), []);
      expect(block.type === "image" && block.width).toBe(32);
    });

    it("keeps the icon's aspect ratio at the icon height", () => {
      const { block } = convertModule(
        iconsModule([{ ...gift, width: "325px", height: "303px" }]),
        [],
        { columnWidth: 600 },
      );
      expect(block.type === "image" && block.width).toBe(34);
    });

    function html(module: BeeFreeeModule): { content: string; entry: unknown } {
      const { block, entry } = convertModule(module, [], { columnWidth: 600 });
      if (block.type !== "html") throw new Error("expected an html block");
      return { content: block.content, entry };
    }

    it("rebuilds an icon with text as an HTML table", () => {
      const { content, entry } = html(
        iconsModule([{ ...gift, text: "Free gift", textPosition: "right" }]),
      );
      expect(entry).toEqual({
        beeFreeModuleType: ICONS,
        templaticalBlockType: "html",
        status: "html-fallback",
        note: "Icons module rebuilt as an HTML table.",
      });
      expect(content).toContain('align="center"');
      expect(content).toContain(
        '<a href="https://example.com/gift" target="_blank" style="text-decoration: none;"><img src="https://example.com/gift.png" alt="Gift" width="32" height="32" style="display: block; width: 32px; height: 32px; border: 0;"></a>',
      );
      expect(content).toContain(
        "padding: 5px 6px 5px 5px; vertical-align: middle;",
      );
      expect(content).toContain(
        '<a href="https://example.com/gift" target="_blank" style="color: #9d9d9d; text-decoration: none;">Free gift</a>',
      );
      expect(content).toContain("font-size: 15px");
      expect(content).not.toContain("inherit");
    });

    it("places the text on the side textPosition names", () => {
      const order = (textPosition: string) => {
        const { content } = html(
          iconsModule([{ ...gift, text: "Gift", textPosition }]),
        );
        return content.indexOf("<img") < content.indexOf(">Gift</a>")
          ? "icon first"
          : "text first";
      };
      expect(order("right")).toBe("icon first");
      expect(order("bottom")).toBe("icon first");
      expect(order("left")).toBe("text first");
      expect(order("top")).toBe("text first");

      // top and bottom stack the text on its own row.
      const rows = (textPosition: string) =>
        html(
          iconsModule([{ ...gift, text: "Gift", textPosition }]),
        ).content.split("<tr>").length - 1;
      expect(rows("bottom")).toBe(rows("right") + 1);
      expect(rows("top")).toBe(rows("left") + 1);
    });

    it("rebuilds a row of icons with the items spacing between them", () => {
      const { content } = html(
        iconsModule(
          [
            { ...gift, image: "https://example.com/a.png", alt: "A" },
            { ...gift, image: "https://example.com/b.png", alt: "B" },
            { ...gift, image: "https://example.com/c.png", alt: "C" },
          ],
          {
            computedStyle: {
              iconHeight: "64px",
              itemsSpacing: "15px",
            },
          },
        ),
      );
      const srcs = [...content.matchAll(/<img src="([^"]+)"/g)].map(
        (m) => m[1],
      );
      expect(srcs).toEqual([
        "https://example.com/a.png",
        "https://example.com/b.png",
        "https://example.com/c.png",
      ]);
      expect(content.match(/height="64"/g)).toHaveLength(3);
      expect(content.match(/padding-left: 15px/g)).toHaveLength(2);
    });

    it("sizes an icon by height alone when its file size is unknown", () => {
      const { content } = html(
        iconsModule([{ image: "https://example.com/x.png", alt: "X" }]),
      );
      expect(content).toContain(
        '<img src="https://example.com/x.png" alt="X" height="32" style="display: block; height: 32px; border: 0;">',
      );
    });

    it("escapes what it writes into the HTML", () => {
      const { content } = html(
        iconsModule([
          {
            ...gift,
            alt: 'Say "hi"',
            href: "https://example.com/?a=1&b=2",
            text: "<b>Bold</b> & co",
          },
        ]),
      );
      expect(content).toContain('alt="Say &quot;hi&quot;"');
      expect(content).toContain('href="https://example.com/?a=1&amp;b=2"');
      expect(content).toContain("&lt;b&gt;Bold&lt;/b&gt; &amp; co");
      expect(content).not.toContain("<b>");
    });

    it("escapes quotes in icon text styles and leaves an existing entity", () => {
      const { content } = html(
        iconsModule([{ ...gift, text: "Gift", textPosition: "right" }], {
          style: {
            color: "red&amp;",
            "font-family": "'Evil\"X', sans-serif",
            "font-weight": 'bold" onmouseover="x',
            "font-size": "15px",
            "text-align": "left",
          },
        }),
      );
      const textCell =
        [...content.matchAll(/<td\b[^>]*>/g)].find((match) =>
          match[0].includes("font-family"),
        )?.[0] ?? "";
      expect(expectClosedStyle(textCell, "td")).toBe(
        "vertical-align: middle; color: red&amp;; font-family: 'Evil&quot;X', sans-serif; font-size: 15px;",
      );
      expect(findStyleAttr(textCell)?.value).toBe(
        "vertical-align: middle; color: red&; font-family: 'Evil\"X', sans-serif; font-size: 15px;",
      );
      expect(content).not.toContain("onmouseover");
      expect(content).not.toContain("&amp;amp;");
      expect(content).toContain(
        'style="color: red&amp;; text-decoration: none;"',
      );
    });

    it("keeps a CSS font-weight in icon text styles and drops any other", () => {
      const cell = (weight: string): string => {
        const { content } = html(
          iconsModule([{ ...gift, text: "Gift", textPosition: "right" }], {
            style: { "font-weight": weight, "font-size": "15px" },
          }),
        );
        return (
          [...content.matchAll(/<td\b[^>]*>/g)].find((match) =>
            match[0].includes("font-size"),
          )?.[0] ?? ""
        );
      };
      expect(findStyleAttr(cell(" 700 "))?.value).toBe(
        "vertical-align: middle; font-size: 15px; font-weight: 700;",
      );
      expect(findStyleAttr(cell("heavy"))?.value).toBe(
        "vertical-align: middle; font-size: 15px;",
      );
    });

    it("drops a quote in an icon width, padding or gap and escapes the title", () => {
      const attack = '10px" onmouseover="x';
      const { content } = html(
        iconsModule(
          [
            {
              ...gift,
              text: "Gift",
              width: attack,
              height: attack,
              title: 't" onmouseover="x',
            },
            { ...gift, image: "https://example.com/b.png", alt: "B" },
          ],
          {
            computedStyle: {
              iconHeight: attack,
              itemsSpacing: attack,
              iconSpacing: {
                "padding-top": attack,
                "padding-right": "6px",
                "padding-bottom": "5px",
                "padding-left": "5px",
              },
            } as unknown as Record<string, string>,
          },
        ),
      );
      expect(content).not.toContain('" onmouseover=');
      expect(content).toContain('title="t&quot; onmouseover=&quot;x"');
      expect(content).toContain(' width="10"');
      expect(content).toContain(' height="10"');
      expect(content).toContain(
        'style="display: block; width: 10px; height: 10px; border: 0;"',
      );
      expect(content).toContain(
        'style="padding: 10px 6px 5px 5px; vertical-align: middle;"',
      );
      expect(content).toContain(
        'style="padding-left: 10px; vertical-align: middle;"',
      );
      const titleTag = firstOpenTag(content, "img");
      expect(
        attributesOf(titleTag).some((attr) => attr.name === "onmouseover"),
      ).toBe(false);
      expect(
        attributesOf(titleTag).filter((attr) => attr.name === "style"),
      ).toHaveLength(1);
    });

    it("keeps an encoded quote inside icon attributes and decodes one in the text", () => {
      const { content } = html(
        iconsModule([
          {
            ...gift,
            href: "https://example.com/{% if a == &#39;x&#39; &gt; 1 %}{{ d(&quot;e&quot;) }}",
            alt: "{{ b&#34;c&#x22; }}",
            title: "{{ a(&quot;x&quot;) onmouseover=&quot;y&quot; }}",
            target: "{{ t&#39; }}",
            text: "{% if a == &#39;x&#39; &gt; 1 %}{{ say &quot;hi&quot; }}",
            textPosition: "right",
          },
        ]),
      );

      expect(content).toContain(
        "href=\"https://example.com/{% if a == 'x' > 1 %}{{ d(&quot;e&quot;) }}\"",
      );
      expect(content).toContain('alt="{{ b&quot;c&quot; }}"');
      expect(content).toContain(
        'title="{{ a(&quot;x&quot;) onmouseover=&quot;y&quot; }}"',
      );
      expect(content).toContain('target="{{ t\' }}"');
      expect(content).toContain("{% if a == 'x' > 1 %}{{ say \"hi\" }}");
      expect(content).not.toContain('" onmouseover=');

      const img = attributesOf(firstOpenTag(content, "img"));
      expect(img.filter((attr) => attr.name === "title")).toHaveLength(1);
      expect(img.filter((attr) => attr.name === "alt")).toHaveLength(1);
      expect(img.filter((attr) => attr.name === "src")).toHaveLength(1);
      expect(img.some((attr) => attr.name === "onmouseover")).toBe(false);
      const anchor = attributesOf(firstOpenTag(content, "a"));
      expect(anchor.filter((attr) => attr.name === "href")).toHaveLength(1);
      expect(anchor.some((attr) => attr.name === "onmouseover")).toBe(false);
    });

    it("rebuilds an item without an image as its text alone", () => {
      const { content } = html(
        iconsModule([{ text: "Call us", textPosition: "right", href: "" }]),
      );
      expect(content).not.toContain("<img");
      expect(content).toContain(">Call us</td>");
    });

    // The table is markup the importer writes, and an HTML block is rendered
    // unsanitized, so an unsafe URL must never reach it.
    it("drops an unsafe icon link or image and says so", () => {
      const warnings: string[] = [];
      const { block } = convertModule(
        iconsModule([
          {
            ...gift,
            href: "javascript:alert(1)",
            text: "Free gift",
          },
          {
            ...gift,
            image: "javascript:alert(2)",
            href: "data:text/html,<b>x</b>",
          },
        ]),
        warnings,
        { columnWidth: 600 },
      );
      if (block.type !== "html") throw new Error("expected an html block");
      expect(block.content).not.toMatch(/javascript:|data:/);
      expect(block.content).not.toContain("<a ");
      expect(block.content).toContain(">Free gift</td>");
      expect(block.content.match(/<img /g)).toHaveLength(1);
      expect(warnings).toEqual([
        'Dropped the unsafe link "javascript:alert(1)" on an Icons item.',
        'Dropped the unsafe image "javascript:alert(2)" on an Icons item.',
        'Dropped the unsafe link "data:text/html,<b>x</b>" on an Icons item.',
      ]);
    });

    it("drops an unsafe link on a lone icon imported as an image", () => {
      const warnings: string[] = [];
      const { block } = convertModule(
        iconsModule([{ ...gift, href: " JavaScript:alert(1)" }]),
        warnings,
        { columnWidth: 600 },
      );
      expect(block.type === "image" && block.linkUrl).toBeUndefined();
      expect(warnings).toEqual([
        'Dropped the unsafe link " JavaScript:alert(1)" on an Icons item.',
      ]);
    });

    it("keeps safe and relative icon links", () => {
      for (const href of [
        "https://example.com",
        "mailto:hi@example.com",
        "/offers",
      ]) {
        const warnings: string[] = [];
        const { block } = convertModule(
          iconsModule([{ ...gift, href }]),
          warnings,
          {
            columnWidth: 600,
          },
        );
        expect([block.type === "image" && block.linkUrl, warnings]).toEqual([
          href,
          [],
        ]);
      }
    });

    it("links nothing when the icon has no href", () => {
      const { content } = html(
        iconsModule([{ ...gift, href: "", text: "Plain" }]),
      );
      expect(content).not.toContain("<a ");
      expect(content).toContain(">Plain</td>");
    });
  });

  // An addon keeps the payload of the module it stands in for, so it converts
  // as that module (#1071).
  describe("addon", () => {
    const ADDON = "mailup-bee-newsletter-modules-addon";

    // The shape of a GIPHY addon in a real export.
    it("converts an addon carrying an image as an image", () => {
      const { block, entry } = convertModule(
        makeModule(ADDON, {
          image: {
            alt: "Image",
            src: "https://media.giphy.com/cat.gif",
            href: "",
            url: "https://giphy.com/gifs/cat",
            width: "480px",
            height: "480px",
          } as BeeFreeeImageContent,
          style: { width: "100%" },
          computedStyle: { class: "center fixedwidth", width: "354.75px" },
        }),
        [],
        { columnWidth: 600 },
      );
      expect(block.type).toBe("image");
      if (block.type !== "image") return;
      expect([block.src, block.width, block.align]).toEqual([
        "https://media.giphy.com/cat.gif",
        355,
        "center",
      ]);
      // `url` is the GIF's page on giphy.com, not a link the author set.
      expect(block.linkUrl).toBeUndefined();
      expect(entry).toEqual({
        beeFreeModuleType: ADDON,
        templaticalBlockType: "image",
        status: "converted",
      });
    });

    it("reads a numeric computed width on an image addon", () => {
      const { block } = convertModule(
        makeModule(ADDON, {
          image: { src: "https://example.com/sticker.gif" },
          computedStyle: { class: "center fixedwidth", width: 256 },
          style: { width: "100%" },
        }),
        [],
        { columnWidth: 600 },
      );
      expect(block.type === "image" && block.width).toBe(256);
    });

    it("converts an addon carrying HTML as an HTML block", () => {
      const { block, entry } = convertModule(
        makeModule(ADDON, { html: { html: "<p>Countdown</p>" } }),
        [],
      );
      expect(block.type === "html" && block.content).toBe("<p>Countdown</p>");
      expect(entry.status).toBe("converted");
    });

    it("converts an addon carrying text, a button or icons as that module", () => {
      const typeOf = (descriptor: BeeFreeeModule["descriptor"]) =>
        convertModule(makeModule(ADDON, descriptor), [], { columnWidth: 600 })
          .block.type;
      expect(typeOf({ paragraph: { html: "<p>Hi</p>" } })).toBe("paragraph");
      expect(typeOf({ heading: { title: "h2", text: "Hi" } })).toBe("title");
      expect(typeOf({ button: { label: "Go" } })).toBe("button");
      expect(
        typeOf({
          iconsList: {
            icons: [
              {
                image: "https://example.com/i.png",
                width: "8px",
                height: "8px",
              },
            ],
          },
          computedStyle: { iconHeight: "16px" },
        }),
      ).toBe("image");
    });

    it("falls back to an HTML comment for an addon with nothing to read", () => {
      const { block, entry } = convertModule(makeModule(ADDON, {}), []);
      expect(block.type === "html" && block.content).toBe(
        `<!-- Unsupported BeeFree module: ${ADDON} -->`,
      );
      expect(entry).toEqual({
        beeFreeModuleType: ADDON,
        templaticalBlockType: "html",
        status: "html-fallback",
        note: "The addon carries no content Templatical reads; converted to an HTML block.",
      });
    });
  });

  describe("spacer", () => {
    it("uses height from descriptor or defaults to 24", () => {
      const warnings: string[] = [];

      const withHeight = makeModule("mailup-bee-newsletter-modules-spacer", {
        spacer: { style: { height: "40px" } },
      });
      const { block: b1 } = convertModule(withHeight, warnings);
      expect(b1.type).toBe("spacer");
      if (b1.type === "spacer") {
        expect(b1.height).toBe(40);
      }

      const noHeight = makeModule("mailup-bee-newsletter-modules-spacer", {});
      const { block: b2 } = convertModule(noHeight, warnings);
      expect(b2.type).toBe("spacer");
      if (b2.type === "spacer") {
        expect(b2.height).toBe(24);
      }
    });
  });

  describe("social", () => {
    it("maps known platform names to SocialPlatform values", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-social", {
        iconsList: {
          icons: [
            {
              name: "facebook",
              image: { href: "https://facebook.com/page" },
            },
            {
              name: "twitter",
              image: { href: "https://twitter.com/user" },
            },
            {
              id: "instagram",
              image: { href: "https://instagram.com/user" },
            },
          ],
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("social");
      if (block.type === "social") {
        expect(block.icons).toHaveLength(3);
        expect(block.icons[0].platform).toBe("facebook");
        expect(block.icons[0].url).toBe("https://facebook.com/page");
        expect(block.icons[1].platform).toBe("twitter");
        expect(block.icons[2].platform).toBe("instagram");
      }
      expect(warnings).toHaveLength(0);
    });

    it("reads the network from the name when the id is a UUID", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-social", {
        iconsList: {
          icons: [
            {
              id: "f232c9a3-1c03-4a9f-abf7-93fae3155a76",
              name: "youtube",
              image: {
                href: "https://www.youtube.com/channel/example",
                alt: "YouTube",
              },
            },
            {
              id: "38683686-a77e-4696-9706-505089c77e03",
              name: "E-Mail",
              image: { href: "https://example.com/contact", alt: "E-Mail" },
            },
            {
              id: "",
              name: "linkedin",
              image: { href: "https://www.linkedin.com/company/example" },
            },
          ],
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("social");
      if (block.type === "social") {
        expect(block.icons.map((icon) => icon.platform)).toEqual([
          "youtube",
          "email",
          "linkedin",
        ]);
        expect(block.icons[0].url).toBe(
          "https://www.youtube.com/channel/example",
        );
      }
      expect(warnings).toHaveLength(0);
    });

    it("drops a rejected scheme on a recognised network and keeps a safe link", () => {
      const icon = (
        href: string,
      ): BeeFreeeModule["descriptor"]["iconsList"] => ({
        icons: [
          {
            id: "f232c9a3-1c03-4a9f-abf7-93fae3155a76",
            name: "youtube",
            image: { href, alt: "YouTube" },
          },
        ],
      });
      const rejected: string[] = [];
      const { block: unsafe } = convertModule(
        makeModule("mailup-bee-newsletter-modules-social", {
          iconsList: icon("javascript:alert(1)"),
        }),
        rejected,
      );
      expect(unsafe.type).toBe("social");
      if (unsafe.type !== "social") return;
      expect(unsafe.icons).toHaveLength(1);
      expect(unsafe.icons[0].platform).toBe("youtube");
      expect(unsafe.icons[0].url).toBe("#");
      expect(rejected).toEqual([
        'Dropped the unsafe link "javascript:alert(1)" on a social icon.',
      ]);

      const kept: string[] = [];
      const { block: safe } = convertModule(
        makeModule("mailup-bee-newsletter-modules-social", {
          iconsList: icon("https://www.youtube.com/channel/example"),
        }),
        kept,
      );
      expect(safe.type).toBe("social");
      if (safe.type !== "social") return;
      expect(safe.icons[0].url).toBe("https://www.youtube.com/channel/example");
      expect(kept).toEqual([]);
    });

    it("drops a rejected scheme on an unknown network's image and link", () => {
      const warnings: string[] = [];
      const { block } = convertModule(
        makeModule("mailup-bee-newsletter-modules-social", {
          iconsList: {
            icons: [
              {
                name: "myspace",
                image: {
                  alt: "Myspace",
                  href: "javascript:alert(1)",
                  src: "javascript:alert(2)",
                },
              },
            ],
          },
        }),
        warnings,
      );

      expect(block.type).toBe("social");
      if (block.type !== "social") return;
      expect(block.icons).toEqual([]);
      expect(JSON.stringify(block)).not.toMatch(/javascript:/);
      expect(warnings).toEqual([
        'Dropped the unsafe link "javascript:alert(1)" on a social icon.',
        'Dropped the unsafe image "javascript:alert(2)" on a social icon.',
        'Social network "Myspace" has no Templatical icon and no image or link to keep.',
      ]);
    });

    it("reads the network from the link host when the name is a UUID", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-social", {
        iconsList: {
          icons: [
            {
              id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
              name: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
              image: {
                href: "https://www.youtube.com/user/example",
                alt: "Channel",
              },
            },
          ],
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("social");
      if (block.type === "social") {
        expect(block.icons).toHaveLength(1);
        expect(block.icons[0].platform).toBe("youtube");
      }
      expect(warnings).toHaveLength(0);
    });

    it("maps Xing from the id, name, alt, title, or a xing.com host", () => {
      const platformsOf = (
        fields: Record<string, unknown>,
        image: Record<string, unknown>,
      ) => {
        const warnings: string[] = [];
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-social", {
            iconsList: { icons: [{ ...fields, image }] },
          }),
          warnings,
        );
        if (block.type !== "social") return { icons: [], warnings };
        return { icons: block.icons, warnings };
      };

      const mapped = (
        fields: Record<string, unknown>,
        image: Record<string, unknown>,
      ) => {
        const result = platformsOf(fields, image);
        expect(result.warnings).toEqual([]);
        expect(result.icons).toHaveLength(1);
        return result.icons[0];
      };

      expect(
        mapped({ id: "xing" }, { href: "https://example.com/profile" })
          .platform,
      ).toBe("xing");
      const named = mapped(
        { name: "Xing" },
        { href: "https://example.com/profile" },
      );
      expect(named.platform).toBe("xing");
      expect(named.url).toBe("https://example.com/profile");
      expect(
        mapped(
          { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
          { alt: "XING", href: "https://example.com/profile" },
        ).platform,
      ).toBe("xing");
      expect(
        mapped(
          { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
          { title: "Xing", href: "https://example.com/profile" },
        ).platform,
      ).toBe("xing");
      expect(
        mapped(
          {
            id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            name: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
          },
          { href: "https://www.xing.com/pages/example" },
        ),
      ).toEqual(
        expect.objectContaining({
          platform: "xing",
          url: "https://www.xing.com/pages/example",
        }),
      );
      expect(
        mapped(
          { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
          { href: "https://profile.xing.com/example" },
        ).platform,
      ).toBe("xing");

      for (const href of [
        "https://notxing.com/pages/example",
        "https://evil.example/xing.com",
        "https://xing.com.evil.example/pages",
      ]) {
        expect(
          platformsOf(
            { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
            { alt: "Channel", href },
          ).icons.map((icon) => icon.platform),
        ).not.toContain("xing");
      }
    });

    it("keeps an unknown network as an image and notes it", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-social", {
        style: { "text-align": "center" },
        computedStyle: { iconsDefaultWidth: 32 },
        iconsList: {
          icons: [
            {
              id: "facebook",
              name: "Facebook",
              image: { href: "https://facebook.com/page" },
            },
            {
              name: "adcce536-5143-4d1b-99fe-8a09dd82d583",
              image: {
                alt: "Vimeo",
                href: "https://vimeo.com/example",
                src: "https://cdn.example.com/vimeo.png",
                target: "_blank",
                width: 64,
                height: 64,
              },
            },
          ],
        },
      });

      const { block, extras, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("social");
      if (block.type === "social") {
        expect(block.icons).toHaveLength(1);
        expect(block.icons[0].platform).toBe("facebook");
      }
      expect(extras).toHaveLength(1);
      const image = extras?.[0];
      expect(image?.type).toBe("image");
      if (image?.type === "image") {
        expect(image.src).toBe("https://cdn.example.com/vimeo.png");
        expect(image.linkUrl).toBe("https://vimeo.com/example");
        expect(image.alt).toBe("Vimeo");
        expect(image.width).toBe(32);
        expect(image.naturalWidth).toBe(64);
        expect(image.naturalHeight).toBe(64);
        expect(image.align).toBe("center");
        expect(image.linkOpenInNewTab).toBe(true);
      }
      expect(warnings).toEqual([
        'Social network "Vimeo" has no Templatical icon; imported as an image.',
      ]);
      expect(entry.note).toBe(warnings[0]);
      expect(entry.status).toBe("approximated");
    });

    it("imports a social module of only unknown icons as images", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-social", {
        iconsList: {
          icons: [
            {
              name: "myspace",
              image: { href: "https://myspace.com/band", alt: "Myspace" },
            },
          ],
        },
      });

      const { block, extras } = convertModule(mod, warnings);

      expect(block.type).toBe("html");
      if (block.type === "html") {
        expect(block.content).toBe(
          '<a href="https://myspace.com/band">Myspace</a>',
        );
      }
      expect(extras ?? []).toHaveLength(0);
      expect(warnings[0]).toContain("Myspace");
      expect(warnings[0]).toContain("link");
    });

    it("keeps an encoded quote in an unknown network's link and decodes the label", () => {
      const { block } = convertModule(
        makeModule("mailup-bee-newsletter-modules-social", {
          iconsList: {
            icons: [
              {
                name: "myspace",
                image: {
                  alt: "{% if a == &#39;x&#39; %}{{ n&quot; }}",
                  href: "https://example.com/{% if a == &#39;x&#39; &gt; 1 %}{{ id(&quot;a&quot;) }}",
                },
              },
            ],
          },
        }),
        [],
      );
      expect(block.type).toBe("html");
      if (block.type !== "html") throw new Error("expected html");
      expect(block.content).toBe(
        "<a href=\"https://example.com/{% if a == 'x' > 1 %}{{ id(&quot;a&quot;) }}\">{% if a == 'x' %}{{ n\" }}</a>",
      );
      expect(block.content).not.toContain('" onmouseover=');
      const attrs = attributesOf(firstOpenTag(block.content, "a"));
      expect(attrs.filter((attr) => attr.name === "href")).toHaveLength(1);
      expect(attrs.some((attr) => attr.name === "onmouseover")).toBe(false);
    });

    it("creates default block when no iconsList", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-social", {});

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("social");
      if (block.type === "social") {
        expect(block.icons).toHaveLength(0);
      }
    });

    it("maps alignment, per-icon padding and icon width", () => {
      const { block } = convertModule(
        makeModule("mailup-bee-newsletter-modules-social", {
          style: { "text-align": "left" },
          computedStyle: {
            iconsDefaultWidth: 24,
            padding: "0 2.5px 0 2.5px",
          },
          iconsList: {
            icons: [
              {
                id: "facebook",
                image: { href: "https://facebook.com/page" },
              },
              {
                id: "instagram",
                image: { href: "https://instagram.com/user" },
              },
            ],
          },
        }),
        [],
      );

      expect(block.type).toBe("social");
      if (block.type !== "social") return;
      expect(block.align).toBe("left");
      // 2.5px on each side: the gap between icons is the two paddings.
      expect(block.spacing).toBe(5);
      expect(block.iconSize).toBe("small");
      expect(block.iconStyle).toBe("solid");
      expect(block.iconTone).toBeUndefined();
    });

    it("maps a circle dark-gray icon set to circle icons in the dark tone", () => {
      const { block } = convertModule(
        makeModule("mailup-bee-newsletter-modules-social", {
          style: { "text-align": "center" },
          computedStyle: { iconsDefaultWidth: 48, padding: "0 5px 0 5px" },
          iconsList: {
            icons: [
              {
                id: "facebook",
                image: {
                  href: "https://facebook.com/page",
                  src: "https://cdn.example.com/social-networks-icon-sets/circle-dark-gray/facebook.png",
                },
              },
            ],
          },
        }),
        [],
      );

      expect(block.type).toBe("social");
      if (block.type !== "social") return;
      expect(block.iconStyle).toBe("circle");
      expect(block.iconTone).toBe("dark");
      expect(block.iconSize).toBe("large");
      expect(block.spacing).toBe(10);
      expect(block.align).toBe("center");
    });

    it("leaves the default icon style when the set has no matching shape", () => {
      const { block } = convertModule(
        makeModule("mailup-bee-newsletter-modules-social", {
          iconsList: {
            icons: [
              {
                id: "facebook",
                image: {
                  href: "https://facebook.com/page",
                  src: "https://cdn.example.com/social-networks-icon-sets/sparkle-neon/facebook.png",
                },
              },
            ],
          },
        }),
        [],
      );

      expect(block.type).toBe("social");
      if (block.type !== "social") return;
      expect(block.iconStyle).toBe("solid");
      expect(block.iconTone).toBeUndefined();
      expect(block.iconSize).toBe("medium");
      expect(block.spacing).toBe(10);
      expect(block.align).toBe("center");
    });

    it("keeps the default icon style when the set name has a malformed percent-escape", () => {
      const { block } = convertModule(
        makeModule("mailup-bee-newsletter-modules-social", {
          iconsList: {
            icons: [
              {
                id: "facebook",
                image: {
                  href: "https://facebook.com/page",
                  src: "https://cdn.example.com/social-networks-icon-sets/circle%E0/facebook.png",
                },
              },
            ],
          },
        }),
        [],
      );

      expect(block.type).toBe("social");
      if (block.type !== "social") return;
      expect(block.iconStyle).toBe("solid");
      expect(block.iconTone).toBeUndefined();
    });

    it("names an unknown icon from the title, a non-uuid name, the id, or the host", () => {
      const uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
      const uuid2 = "11111111-2222-3333-4444-555555555555";
      const { block, extras, entry } = convertModule(
        makeModule("mailup-bee-newsletter-modules-social", {
          iconsList: {
            icons: [
              { image: { alt: "Custom", href: "not a url" } },
              { image: { title: "Room", href: "https://example.com/x" } },
              { name: "myspace", image: { href: "https://myspace.example/u" } },
              {
                name: uuid,
                id: "lobby",
                image: { href: "https://example.com/room" },
              },
              {
                name: uuid,
                id: uuid2,
                image: { href: "https://www.cdn.example/icon.png" },
              },
              { name: uuid, id: uuid2, image: { href: "not-a-url" } },
              { name: uuid, id: uuid2, image: { href: "tel:555" } },
            ],
          },
        }),
        [],
      );

      const html = [block, ...(extras ?? [])].map((item) => {
        if (item.type !== "html") return item.type;
        return item.content;
      });
      expect(html).toEqual([
        '<a href="not a url">Custom</a>',
        '<a href="https://example.com/x">Room</a>',
        '<a href="https://myspace.example/u">myspace</a>',
        '<a href="https://example.com/room">lobby</a>',
        '<a href="https://www.cdn.example/icon.png">cdn.example</a>',
        '<a href="not-a-url">custom</a>',
        '<a href="tel:555">custom</a>',
      ]);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toContain("Custom");
    });
  });

  describe("heading edge cases", () => {
    it("falls back to level 2 for out-of-range heading level (h5)", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        heading: {
          title: "h5",
          text: "Small Title",
        },
      });

      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("title");
      if (block.type === "title") {
        expect(block.level).toBe(2);
      }
    });

    it("falls back to level 2 for non-heading tag", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        heading: {
          title: "span",
          text: "Not a heading tag",
        },
      });

      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("title");
      if (block.type === "title") {
        expect(block.level).toBe(2);
      }
    });
  });

  describe("video", () => {
    it("converts video without video descriptor to empty video block", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-video", {
        style: {
          "padding-top": "10px",
          "padding-right": "10px",
          "padding-bottom": "10px",
          "padding-left": "10px",
        },
      });

      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("video");
      if (block.type === "video") {
        expect(block.url).toBe("");
      }
    });

    it("converts video with src and thumbnail", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-video", {
        video: {
          src: "https://youtube.com/watch?v=abc",
          thumbnail: "https://img.youtube.com/vi/abc/0.jpg",
          alt: "Video",
          style: { width: "500px", "text-align": "center" },
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("video");
      if (block.type === "video") {
        expect(block.url).toBe("https://youtube.com/watch?v=abc");
        expect(block.thumbnailUrl).toBe("https://img.youtube.com/vi/abc/0.jpg");
        expect(block.alt).toBe("Video");
        expect(block.width).toBe(500);
        expect(block.align).toBe("center");
      }
      expect(entry.status).toBe("converted");
    });

    // The video thumbnail ships as an mj-image, so a pinned height in the
    // source is the same fixed-box intent as on an image block.
    it("carries the thumbnail height from the style, and leaves it unset otherwise", () => {
      const warnings: string[] = [];
      const withHeight = convertModule(
        makeModule("mailup-bee-newsletter-modules-video", {
          video: {
            src: "https://youtube.com/watch?v=abc",
            style: { width: "500px", height: "280px" },
          },
        }),
        warnings,
      ).block;
      const withoutHeight = convertModule(
        makeModule("mailup-bee-newsletter-modules-video", {
          video: {
            src: "https://youtube.com/watch?v=abc",
            style: { width: "500px" },
          },
        }),
        warnings,
      ).block;

      if (withHeight.type !== "video" || withoutHeight.type !== "video")
        throw new Error("expected video blocks");
      expect(withHeight.height).toBe(280);
      expect(withoutHeight.height).toBeUndefined();
    });
  });

  describe("menu", () => {
    it("converts menu items with separator and colors", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-menu", {
        menu: {
          items: [
            { text: "Home", link: "https://example.com", target: "_blank" },
            { text: "About", href: "https://example.com/about" },
          ],
          separator: "-",
          separatorColor: "#666666",
          style: {
            "font-size": "12px",
            color: "#444444",
            "text-align": "center",
          },
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("menu");
      if (block.type === "menu") {
        expect(block.items).toHaveLength(2);
        expect(block.items[0].text).toBe("Home");
        expect(block.items[0].url).toBe("https://example.com");
        expect(block.items[0].openInNewTab).toBe(true);
        expect(block.items[1].text).toBe("About");
        expect(block.items[1].url).toBe("https://example.com/about");
        expect(block.items[1].openInNewTab).toBe(false);
        expect(block.separator).toBe("-");
        expect(block.separatorColor).toBe("#666666");
        expect(block.fontSize).toBe(12);
        expect(block.color).toBe("#444444");
      }
    });

    it("report entry has isApproximation status", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-menu", {
        menu: {
          items: [{ text: "Link", link: "#" }],
        },
      });

      const { entry } = convertModule(mod, warnings);

      expect(entry.status).toBe("approximated");
      expect(entry.templaticalBlockType).toBe("menu");
    });
  });

  describe("table", () => {
    it("converts rows and cells", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-table", {
        table: {
          rows: [
            { cells: [{ content: "A1" }, { content: "B1" }] },
            { cells: [{ html: "A2" }, { content: "B2" }] },
          ],
          style: {
            "border-color": "#eeeeee",
            "border-width": "2px",
            "font-size": "13px",
            color: "#222222",
            "text-align": "center",
          },
          cellPadding: 10,
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("table");
      if (block.type === "table") {
        expect(block.rows).toHaveLength(2);
        expect(block.rows[0].cells).toHaveLength(2);
        expect(block.rows[0].cells[0].content).toBe("A1");
        expect(block.rows[0].cells[1].content).toBe("B1");
        expect(block.rows[1].cells[0].content).toBe("A2");
        expect(block.borderColor).toBe("#eeeeee");
        expect(block.borderWidth).toBe(2);
        expect(block.cellPadding).toBe(10);
        expect(block.fontSize).toBe(13);
        expect(block.color).toBe("#222222");
        expect(block.textAlign).toBe("center");
      }
      expect(entry.status).toBe("converted");
    });

    it("respects hasHeaderRow flag", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-table", {
        table: {
          rows: [{ cells: [{ content: "Header" }] }],
          hasHeaderRow: true,
          headerBackgroundColor: "#dddddd",
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("table");
      if (block.type === "table") {
        expect(block.hasHeaderRow).toBe(true);
        expect(block.headerBackgroundColor).toBe("#dddddd");
      }
    });

    it("strips HTML in cell content to plain text and flags it as approximated", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-table", {
        table: {
          rows: [
            {
              cells: [
                { html: "<b>Weight</b>" },
                { content: '<a href="https://example.com">Buy</a>' },
              ],
            },
          ],
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("table");
      if (block.type === "table") {
        // Tags removed; the cell keeps only its text (the link URL is lost).
        expect(block.rows[0].cells[0].content).toBe("Weight");
        expect(block.rows[0].cells[1].content).toBe("Buy");
      }
      expect(entry.status).toBe("approximated");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("table cells");
    });

    it("keeps a plain-text table as a clean conversion with no warning", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-table", {
        table: {
          rows: [{ cells: [{ content: "Weight" }, { html: "10kg" }] }],
        },
      });

      const { entry } = convertModule(mod, warnings);

      expect(entry.status).toBe("converted");
      expect(warnings).toHaveLength(0);
    });
  });

  describe("html", () => {
    it("passes through HTML content", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-html", {
        html: {
          html: '<div class="custom">Custom HTML</div>',
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("html");
      if (block.type === "html") {
        expect(block.content).toBe('<div class="custom">Custom HTML</div>');
      }
      expect(entry.status).toBe("converted");
    });
  });

  describe("edge cases", () => {
    it("convertText with all content sources undefined returns empty", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-text", {});
      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("paragraph");
      if (block.type === "paragraph") {
        expect(block.content).toBe("");
      }
    });

    it("convertHeading without heading falls back to convertText (paragraph)", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        text: { html: "<p>Fallback text</p>" },
      });
      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("paragraph");
      if (block.type === "paragraph") {
        expect(block.content).toBe("<p>Fallback text</p>");
      }
    });

    it("convertHeading without title defaults to level 2", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        heading: { text: "Untitled" },
      });
      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("title");
      if (block.type === "title") {
        expect(block.content).toBe("<p>Untitled</p>");
        expect(block.level).toBe(2);
      }
    });

    it("convertHeading strips heading tags from text that already has them", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        heading: { title: "h1", text: "<h1>Already Tagged</h1>" },
      });
      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("title");
      if (block.type === "title") {
        expect(block.content).toBe("<p>Already Tagged</p>");
        expect(block.level).toBe(1);
        // Must NOT contain raw heading tags — they are rendered by the block itself
        expect(block.content).not.toContain("<h1>");
      }
    });
  });

  describe("menu — no descriptor", () => {
    it("returns default MenuBlock when menu descriptor has no .menu property", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-menu", {});

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("menu");
      if (block.type === "menu") {
        expect(block.items).toHaveLength(0);
      }
      expect(entry.status).toBe("approximated");
      expect(entry.templaticalBlockType).toBe("menu");
    });
  });

  describe("table — no descriptor", () => {
    it("returns default TableBlock when table descriptor has no .table property", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-table", {});

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("table");
      if (block.type === "table") {
        // Default table block has 3 rows from createDefaultTableRows(3, 3)
        expect(block.rows).toHaveLength(3);
        expect(block.rows[0].cells).toHaveLength(3);
      }
      expect(entry.status).toBe("converted");
      expect(entry.templaticalBlockType).toBe("table");
    });
  });

  describe("unknown type", () => {
    it("falls back to HTML block with html-fallback status", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-magic-widget", {
        text: {
          html: "<p>Some content</p>",
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("html");
      if (block.type === "html") {
        expect(block.content).toBe("<p>Some content</p>");
      }
      expect(entry.status).toBe("html-fallback");
      expect(entry.templaticalBlockType).toBe("html");
      expect(entry.note).toContain("Unknown module type");
    });

    it("tries multiple descriptor fields for content extraction", () => {
      const warnings: string[] = [];

      // Falls back to html.html
      const mod1 = makeModule("some-unknown-type", {
        html: { html: "<div>Fallback HTML</div>" },
      });
      const { block: b1 } = convertModule(mod1, warnings);
      if (b1.type === "html") {
        expect(b1.content).toBe("<div>Fallback HTML</div>");
      }

      // Falls back to heading.text
      const mod2 = makeModule("some-unknown-type", {
        heading: { text: "Heading fallback" },
      });
      const { block: b2 } = convertModule(mod2, warnings);
      if (b2.type === "html") {
        expect(b2.content).toBe("Heading fallback");
      }

      // Falls back to comment when nothing found
      const mod3 = makeModule("some-unknown-type", {});
      const { block: b3 } = convertModule(mod3, warnings);
      if (b3.type === "html") {
        expect(b3.content).toContain("Unsupported BeeFree module");
        expect(b3.content).toContain("some-unknown-type");
      }
    });
  });

  // Null-safety / malformed-input coverage for convertText's content-source
  // fan-out, the unknown-type html-fallback flow, inline font-weight emission,
  // and menu url precedence. Real exports carry partial descriptors.
  describe("malformed / null-safety", () => {
    describe("convertText with no content source", () => {
      it("returns an empty paragraph when text, paragraph, and list are all absent", () => {
        const warnings: string[] = [];
        const mod = makeModule("mailup-bee-newsletter-modules-text", {
          style: { "padding-top": "5px" },
        });

        const { block, entry } = convertModule(mod, warnings);

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          // textContent?.html ?? "" → "" with no wrapping applied.
          expect(block.content).toBe("");
        }
        expect(entry.status).toBe("converted");
        expect(entry.templaticalBlockType).toBe("paragraph");
        expect(warnings).toHaveLength(0);
      });

      it("returns an empty paragraph for a list module with no list content", () => {
        const warnings: string[] = [];
        const mod = makeModule("mailup-bee-newsletter-modules-list", {});

        const { block, entry } = convertModule(mod, warnings);

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          expect(block.content).toBe("");
        }
        expect(entry.status).toBe("converted");
        expect(entry.templaticalBlockType).toBe("paragraph");
      });
    });

    describe("unknown module type — html-fallback flow", () => {
      it("emits an html block and a fully-populated html-fallback report entry", () => {
        const warnings: string[] = [];
        const mod = makeModule("mailup-bee-newsletter-modules-brand-new", {
          html: { html: "<section>hi</section>" },
        });

        const { block, entry } = convertModule(mod, warnings);

        // Unknown type short-circuits before the switch (MODULE_TYPE_MAP miss).
        expect(block.type).toBe("html");
        if (block.type === "html") {
          // convertHtmlFallback pulls html.html since text.html is absent.
          expect(block.content).toBe("<section>hi</section>");
        }
        expect(entry.status).toBe("html-fallback");
        expect(entry.templaticalBlockType).toBe("html");
        expect(entry.beeFreeModuleType).toBe(
          "mailup-bee-newsletter-modules-brand-new",
        );
        expect(entry.note).toBe(
          'Unknown module type "mailup-bee-newsletter-modules-brand-new" converted to HTML block.',
        );
        expect(warnings).toHaveLength(0);
      });
    });

    describe("inlineStylesToHtml font-weight emission", () => {
      it.each(["heavy;x:", "2000"])(
        "drops invalid font-weight %s",
        (weight) => {
          const { block, entry } = convertModule(
            makeModule("mailup-bee-newsletter-modules-text", {
              text: { html: "<p>Hi</p>", style: { "font-weight": weight } },
            }),
            [],
          );
          expect(block.type).toBe("paragraph");
          if (block.type === "paragraph")
            expect(block.content).toBe("<p>Hi</p>");
          expect(entry.status).toBe("converted");
          expect(entry.note).toBeUndefined();
        },
      );

      it("drops a 300-character font stack and notes the approximation", () => {
        const { block, entry } = convertModule(
          makeModule("mailup-bee-newsletter-modules-text", {
            text: {
              html: "<p>Hi</p>",
              style: { "font-family": "A".repeat(300) },
            },
          }),
          [],
        );
        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") expect(block.content).toBe("<p>Hi</p>");
        expect(entry.status).toBe("approximated");
        expect(entry.note).toBe(
          "Font family longer than 256 characters was dropped.",
        );
      });

      it("reports a long family in a heading module's text fallback", () => {
        const { block, entry } = convertModule(
          makeModule("mailup-bee-newsletter-modules-heading", {
            text: {
              html: "<p>Hi</p>",
              style: { "font-family": "A".repeat(300) },
            },
          }),
          [],
        );
        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") expect(block.content).toBe("<p>Hi</p>");
        expect(entry.status).toBe("approximated");
        expect(entry.note).toBe(
          "Font family longer than 256 characters was dropped.",
        );
      });

      it("does NOT emit a weight span for empty font-weight", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-text", {
            text: { html: "<p>Hi</p>", style: { "font-weight": "" } },
          }),
          [],
        );

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          // "" is falsy → guard skips it entirely.
          expect(block.content).toBe("<p>Hi</p>");
          expect(block.content).not.toContain("font-weight");
        }
      });

      it("does NOT emit a weight span for font-weight 'normal'", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-text", {
            text: { html: "<p>Hi</p>", style: { "font-weight": "normal" } },
          }),
          [],
        );

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          expect(block.content).toBe("<p>Hi</p>");
          expect(block.content).not.toContain("font-weight");
        }
      });

      it("emits a weight span for font-weight 'bold'", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-text", {
            text: { html: "<p>Hi</p>", style: { "font-weight": "bold" } },
          }),
          [],
        );

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          expect(block.content).toBe(
            '<p><span style="font-weight: bold">Hi</span></p>',
          );
        }
      });

      it("emits a weight span for font-weight '700'", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-text", {
            text: { html: "<p>Hi</p>", style: { "font-weight": "700" } },
          }),
          [],
        );

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          expect(block.content).toBe(
            '<p><span style="font-weight: 700">Hi</span></p>',
          );
        }
      });

      it.each(["+700", "7e2", "inherit"])(
        "keeps the CSS font-weight %s",
        (weight) => {
          const { block } = convertModule(
            makeModule("mailup-bee-newsletter-modules-text", {
              text: { html: "<p>Hi</p>", style: { "font-weight": weight } },
            }),
            [],
          );

          expect(block.type).toBe("paragraph");
          if (block.type === "paragraph") {
            expect(block.content).toBe(
              `<p><span style="font-weight: ${weight}">Hi</span></p>`,
            );
          }
        },
      );

      it("trims a font-weight before checking it", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-text", {
            text: { html: "<p>Hi</p>", style: { "font-weight": " 700 " } },
          }),
          [],
        );

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          expect(block.content).toBe(
            '<p><span style="font-weight: 700">Hi</span></p>',
          );
        }
      });

      // "400" is the numeric synonym for "normal", so it must not produce a
      // redundant span — matching the import-unlayer importer.
      it("does NOT emit a weight span for font-weight '400'", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-text", {
            text: { html: "<p>Hi</p>", style: { "font-weight": "400" } },
          }),
          [],
        );

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          expect(block.content).toBe("<p>Hi</p>");
        }
      });
    });

    // BeeFree's paragraph modules write `font-family: inherit`. Carried over,
    // the keyword becomes the block's own font and the sent email falls back
    // to the client's default face instead of the template's.
    describe("CSS-wide keywords as a font", () => {
      const KEYWORDS = ["inherit", "initial", "unset", "revert"];

      it.each(KEYWORDS)("leaves a title's font unset for %s", (keyword) => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-heading", {
            heading: {
              title: "h2",
              text: "Hello",
              style: { "font-family": keyword },
            },
          }),
          [],
        );
        if (block.type !== "title") throw new Error("expected a title block");
        expect(block.fontFamily).toBeUndefined();
      });

      it.each(KEYWORDS)("leaves a button's font unset for %s", (keyword) => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-button", {
            button: { label: "Go", style: { "font-family": keyword } },
          }),
          [],
        );
        if (block.type !== "button") throw new Error("expected a button block");
        expect(block.fontFamily).toBeUndefined();
      });

      it.each(KEYWORDS)("leaves a menu's font unset for %s", (keyword) => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-menu", {
            menu: {
              items: [{ text: "Home", link: "https://x.test" }],
              style: { "font-family": keyword },
            },
          }),
          [],
        );
        if (block.type !== "menu") throw new Error("expected a menu block");
        expect(block.fontFamily).toBeUndefined();
      });

      it.each(KEYWORDS)(
        "adds no font-family span to a paragraph for %s",
        (keyword) => {
          const { block } = convertModule(
            makeModule("mailup-bee-newsletter-modules-paragraph", {
              paragraph: {
                html: "<p>Hi</p>",
                style: { "font-family": keyword },
              },
            }),
            [],
          );
          if (block.type !== "paragraph")
            throw new Error("expected a paragraph block");
          expect(block.content).toBe("<p>Hi</p>");
        },
      );

      it("still carries a named font on a title, with its fallbacks", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-heading", {
            heading: {
              text: "Hello",
              style: { "font-family": "'Open Sans', sans-serif" },
            },
          }),
          [],
        );
        if (block.type !== "title") throw new Error("expected a title block");
        expect(block.fontFamily).toBe("'Open Sans', sans-serif");
      });

      it("carries a paragraph's whole font stack into its span", () => {
        const stack =
          "Montserrat, Trebuchet MS, Lucida Grande, Lucida Sans Unicode, Lucida Sans, Tahoma, sans-serif";
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-paragraph", {
            paragraph: {
              html: "<p>Hi</p>",
              style: { "font-family": stack },
            },
          }),
          [],
        );
        if (block.type !== "paragraph")
          throw new Error("expected a paragraph block");
        expect(block.content).toContain(`font-family: ${stack}`);
      });

      it("adds no color span to a paragraph whose color is inherit", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-paragraph", {
            paragraph: { html: "<p>Hi</p>", style: { color: "inherit" } },
          }),
          [],
        );
        if (block.type !== "paragraph")
          throw new Error("expected a paragraph block");
        expect(block.content).toBe("<p>Hi</p>");
      });
    });

    // A title, menu or table without a color of its own inherits the
    // template's `textColor`, the body color the import writes.
    describe("text color", () => {
      it("leaves a title's color unset when the heading sets none", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-heading", {
            heading: { text: "Hello", style: {} },
          }),
          [],
        );
        if (block.type !== "title") throw new Error("expected a title block");
        expect("color" in block).toBe(false);
      });

      it("leaves a menu's color unset when the menu sets none", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-menu", {
            menu: { items: [{ text: "Home", link: "https://x.test" }] },
          }),
          [],
        );
        if (block.type !== "menu") throw new Error("expected a menu block");
        expect("color" in block).toBe(false);
      });

      it("leaves a table's color unset when the table sets none", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-table", {
            table: { rows: [{ cells: [{ content: "A1" }] }] },
          }),
          [],
        );
        if (block.type !== "table") throw new Error("expected a table block");
        expect("color" in block).toBe(false);
      });

      it("compares a paragraph's color with the template's text color", () => {
        const paragraph = (color: string) =>
          makeModule("mailup-bee-newsletter-modules-paragraph", {
            paragraph: { html: "<p>Hi</p>", style: { color } },
          });
        const context = { textColor: "#333333" };

        const differs = convertModule(paragraph("#1a1a1a"), [], context).block;
        const same = convertModule(paragraph("#333333"), [], context).block;
        if (differs.type !== "paragraph" || same.type !== "paragraph")
          throw new Error("expected paragraph blocks");
        expect(differs.content).toBe(
          '<p><span style="color: #1a1a1a">Hi</span></p>',
        );
        expect(same.content).toBe("<p>Hi</p>");
      });

      it("compares with #1a1a1a when the template's text color is unknown", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-paragraph", {
            paragraph: { html: "<p>Hi</p>", style: { color: "#1a1a1a" } },
          }),
          [],
        );
        if (block.type !== "paragraph")
          throw new Error("expected a paragraph block");
        expect(block.content).toBe("<p>Hi</p>");
      });
    });

    describe("menu item url precedence", () => {
      it("prefers item.link over item.href when both are present", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-menu", {
            menu: {
              items: [
                {
                  text: "Both",
                  link: "https://link.test",
                  href: "https://href.test",
                },
              ],
            },
          }),
          [],
        );

        expect(block.type).toBe("menu");
        if (block.type === "menu") {
          expect(block.items).toHaveLength(1);
          // `item.link || item.href || "#"` → link wins.
          expect(block.items[0].url).toBe("https://link.test");
        }
      });

      it("falls back to item.href when link is absent", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-menu", {
            menu: {
              items: [{ text: "HrefOnly", href: "https://href.test" }],
            },
          }),
          [],
        );

        expect(block.type).toBe("menu");
        if (block.type === "menu") {
          expect(block.items[0].url).toBe("https://href.test");
        }
      });
    });

    // BeeFree paints a text module's style as the base and the TinyMCE blob
    // on top. Line-height is the exception: the HTML export drops the blob's
    // px line-height and renders the module value as a unitless ratio.
    describe("text, list and link styles", () => {
      function textHtml(
        kind: "text" | "list",
        html: string,
        style: Record<string, string>,
        computedStyle?: Record<string, string>,
      ): string {
        const payload = { html, style, computedStyle };
        const { block } = convertModule(
          makeModule(
            `mailup-bee-newsletter-modules-${kind}`,
            kind === "text" ? { text: payload } : { list: payload },
          ),
          [],
        );
        if (block.type !== "paragraph") {
          throw new Error(`expected a paragraph, got ${block.type}`);
        }
        return block.content;
      }

      it("puts the module font-size on the paragraph so the line box is not the 14px default", () => {
        // mj-text is 14px. A 12px size only on an inner span leaves the
        // paragraph's strut at 14px, so each line is taller than BeeFree.
        expect(
          textHtml("text", "<p>Hi</p>", {
            "font-size": "12px",
            "line-height": "150%",
          }),
        ).toBe(
          '<p style="font-size: 12px; line-height: 1.5"><span style="font-size: 12px">Hi</span></p>',
        );
      });

      it("keeps a blank paragraph empty so it stays one line tall", () => {
        // BeeFree paints `<p></p>` as one line. A span inside it is content,
        // so the paragraph collapses and the following line moves up.
        const style = {
          color: "#555555",
          "font-family": "Georgia, serif",
          "line-height": "150%",
        };
        expect(
          textHtml(
            "text",
            "<p>We look forward to seeing you.</p><p></p><p>Sincerely,<br/>Your Event Team</p>",
            style,
          ),
        ).toBe(
          '<p style="line-height: 1.5"><span style="color: #555555; font-family: Georgia">We look forward to seeing you.</span></p>' +
            '<p style="line-height: 1.5"></p>' +
            '<p style="line-height: 1.5"><span style="color: #555555; font-family: Georgia">Sincerely,<br/>Your Event Team</span></p>',
        );
        expect(textHtml("text", "<p> </p>", style)).toBe(
          '<p style="line-height: 1.5"></p>',
        );
        expect(textHtml("text", "<p>&nbsp;</p>", style)).toBe(
          '<p style="line-height: 1.5"><span style="color: #555555; font-family: Georgia">&nbsp;</span></p>',
        );
        expect(textHtml("text", "<p><br/></p>", style)).toBe(
          '<p style="line-height: 1.5"><span style="color: #555555; font-family: Georgia"><br/></span></p>',
        );
      });

      it("keeps broken tag text that still has ink, and drops a tag with none", () => {
        // `<scr<b>ipt>` loses `<scr<b>` when tags are removed, leaving `ipt>`.
        // That remainder is text, so the paragraph is not blank. The check
        // never writes the stripped string back into the markup.
        expect(
          textHtml("text", "<p><scr<b>ipt></p>", { color: "#555555" }),
        ).toBe('<p><span style="color: #555555"><scr<b>ipt></span></p>');
        expect(
          textHtml("text", "<p><scr<script>ipt></p>", { color: "#555555" }),
        ).toBe('<p><span style="color: #555555"><scr<script>ipt></span></p>');
        expect(textHtml("text", "<p><b> </b></p>", { color: "#555555" })).toBe(
          "<p></p>",
        );
        expect(textHtml("text", "<p><img></p>", { color: "#555555" })).toBe(
          '<p><span style="color: #555555"><img></span></p>',
        );
      });

      it("writes the module line-height as a unitless ratio and drops the blob px value", () => {
        expect(
          textHtml(
            "text",
            '<p style="line-height: 18px; font-size: 14px">Hi</p>',
            { "line-height": "150%" },
          ),
        ).toBe('<p style="font-size: 14px; line-height: 1.5">Hi</p>');
      });

      it("drops a span line-height so a nested size inherits the module ratio", () => {
        expect(
          textHtml(
            "text",
            '<p style="line-height: 16px"><span style="font-size: 26px; line-height: 31px">Hi</span></p>',
            { "line-height": "120%" },
          ),
        ).toBe(
          '<p style="line-height: 1.2"><span style="font-size: 26px">Hi</span></p>',
        );
      });

      it("keeps a unitless module line-height and applies it when the blob sets none", () => {
        expect(textHtml("text", "<p>Hi</p>", { "line-height": "1.6" })).toBe(
          '<p style="line-height: 1.6">Hi</p>',
        );
      });

      it("keeps the blob line-height when the module sets none", () => {
        expect(
          textHtml(
            "text",
            '<p style="line-height: 18px"><span style="line-height: 31px">Hi</span></p>',
            {},
          ),
        ).toBe(
          '<p style="line-height: 18px"><span style="line-height: 31px">Hi</span></p>',
        );
      });

      // An unquoted style value ends at whitespace or `>`. Removing it must
      // drop that attribute and the space before it, and a merged value is
      // quoted so a space or semicolon stays inside the attribute.
      it("rewrites an unquoted style without eating the tag or leaving the value bare", () => {
        const lineHeight = { "line-height": "120%" };
        expect(
          textHtml(
            "text",
            "<span style=line-height:31px>Hi</span>",
            lineHeight,
          ),
        ).toBe("<span>Hi</span>");
        expect(
          textHtml(
            "text",
            "<span style=color:red;font-size:12px;line-height:31px>Hi</span>",
            lineHeight,
          ),
        ).toBe('<span style="color:red; font-size:12px">Hi</span>');
        expect(
          textHtml("text", "<p style=text-align:right>Hi</p>", {
            "line-height": "180%",
          }),
        ).toBe('<p style="text-align:right; line-height: 1.8">Hi</p>');
        expect(
          textHtml(
            "text",
            "<span class=note style=line-height:31px>Hi</span>",
            lineHeight,
          ),
        ).toBe("<span class=note>Hi</span>");
        expect(
          textHtml(
            "text",
            "<span style=line-height:31px hidden>Hi</span>",
            lineHeight,
          ),
        ).toBe("<span hidden>Hi</span>");
        expect(
          textHtml(
            "text",
            "<span hidden style=line-height:31px>Hi</span>",
            lineHeight,
          ),
        ).toBe("<span hidden>Hi</span>");
      });

      it("rewrites quoted and single-quoted styles, and a tag with no style", () => {
        const lineHeight = { "line-height": "120%" };
        expect(
          textHtml(
            "text",
            '<span style="line-height: 31px">Hi</span>',
            lineHeight,
          ),
        ).toBe("<span>Hi</span>");
        expect(
          textHtml(
            "text",
            '<span style="color: red; line-height: 31px">Hi</span>',
            lineHeight,
          ),
        ).toBe('<span style="color: red">Hi</span>');
        expect(
          textHtml(
            "text",
            "<span style='line-height: 31px'>Hi</span>",
            lineHeight,
          ),
        ).toBe("<span>Hi</span>");
        expect(
          textHtml(
            "text",
            "<span style='color: red; line-height: 31px'>Hi</span>",
            lineHeight,
          ),
        ).toBe('<span style="color: red">Hi</span>');
        expect(
          textHtml(
            "text",
            '<span class="note" style="line-height: 31px">Hi</span>',
            lineHeight,
          ),
        ).toBe('<span class="note">Hi</span>');
        expect(textHtml("text", "<p>Hi</p>", { "line-height": "150%" })).toBe(
          '<p style="line-height: 1.5">Hi</p>',
        );
      });

      // A nested block stops the paragraph from taking a fresh span, so the
      // module font is merged into the paragraph's own style. Single quotes
      // in that family must not end a single-quoted attribute.
      it("merges a quoted font-family into a single-quoted style on a paragraph and a nested span", () => {
        const html = textHtml(
          "text",
          "<p style='color: red'><span style='color: navy'>Hi</span><div>There</div></p>",
          { "font-family": "'Open Sans', sans-serif" },
        );
        expect(html).toBe(
          "<p style=\"color: red; font-family: 'Open Sans', sans-serif\"><span style='color: navy'>Hi</span><div><span style=\"font-family: 'Open Sans', sans-serif\">There</span></div></p>",
        );
        const open = html.slice(0, html.indexOf(">") + 1);
        expect(findStyleAttr(open)?.value).toBe(
          "color: red; font-family: 'Open Sans', sans-serif",
        );
      });

      it("escapes a quote and an ampersand when rewriting a double-quoted style", () => {
        const html = textHtml(
          "text",
          '<p style="font: a &lt; &quot;b&amp;c&quot;"><div></div></p>',
          { "letter-spacing": '1"&' },
        );
        const open = html.slice(0, html.indexOf(">") + 1);
        expect(open).toBe(
          '<p style="font: a &lt; &quot;b&amp;c&quot;; letter-spacing: 1&quot;&amp;">',
        );
        expect(findStyleAttr(open)?.value).toBe(
          'font: a < "b&c"; letter-spacing: 1"&',
        );
        expect(html).toBe(`${open}<div></div></p>`);
      });

      it("treats a style attribute with no value as empty", () => {
        expect(
          textHtml("text", "<p style>Hi</p>", { "line-height": "150%" }),
        ).toBe('<p style="line-height: 1.5">Hi</p>');
        expect(
          textHtml("text", "<p style hidden>Hi</p>", { "line-height": "150%" }),
        ).toBe('<p style="line-height: 1.5" hidden>Hi</p>');
        expect(
          textHtml("text", "<span style>Hi</span>", { "line-height": "120%" }),
        ).toBe("<span>Hi</span>");
      });

      it("keeps an encoded quote inside a letter-spacing span and decodes one in the text", () => {
        const html = textHtml("text", "<p>{{ say &quot;hi&quot; }}</p>", {
          "letter-spacing": "{{ x&quot; onmouseover=&quot;y }}",
        });
        expect(html).toBe(
          '<p><span style="letter-spacing: {{x&quot;onmouseover=&quot;y}}">{{ say "hi" }}</span></p>',
        );
        expect(html).not.toContain('" onmouseover=');
        const attrs = attributesOf(firstOpenTag(html, "span"));
        expect(attrs.filter((attr) => attr.name === "style")).toHaveLength(1);
        expect(attrs.some((attr) => attr.name === "onmouseover")).toBe(false);
      });

      it("carries letter-spacing on the text span and skips a zero spacing", () => {
        expect(textHtml("text", "<p>Hi</p>", { "letter-spacing": "1px" })).toBe(
          '<p><span style="letter-spacing: 1px">Hi</span></p>',
        );
        expect(textHtml("text", "<p>Hi</p>", { "letter-spacing": "0px" })).toBe(
          "<p>Hi</p>",
        );
      });

      it("keeps a single-quoted font stack inside one span style attribute", () => {
        const html = textHtml("text", "<p>Hi</p>", {
          "font-family": "'Open Sans', sans-serif",
        });
        expect(html).toBe(
          `<p><span style="font-family: 'Open Sans', sans-serif">Hi</span></p>`,
        );
        expect(findStyleAttr(firstOpenTag(html, "span"))?.value).toBe(
          "font-family: 'Open Sans', sans-serif",
        );
      });

      it("escapes a quote in the leaf span and drops an invalid weight", () => {
        const html = textHtml("text", "<p>Hi</p>", {
          "letter-spacing": '1px" onmouseover="x',
          "font-weight": 'bold" onmouseover="w',
          color: 'red" onmouseover="c',
          "font-family": "'Evil\"X', sans-serif",
        });
        expect(expectClosedStyle(html, "span")).toBe(
          "color: red&quot; onmouseover=&quot;c; font-family: 'Evil&quot;X', sans-serif; letter-spacing: 1px&quot;onmouseover=&quot;x",
        );
        expect(findStyleAttr(firstOpenTag(html, "span"))?.value).toBe(
          'color: red" onmouseover="c; font-family: \'Evil"X\', sans-serif; letter-spacing: 1px"onmouseover="x',
        );
      });

      it("escapes an ampersand and a less-than in leaf letter-spacing and keeps an entity", () => {
        expect(
          textHtml("text", "<p>Hi</p>", { "letter-spacing": "1px&<" }),
        ).toBe('<p><span style="letter-spacing: 1px&amp;&lt;">Hi</span></p>');
        const encoded = textHtml("text", "<p>Hi</p>", {
          "letter-spacing": "1&quot;px",
        });
        expect(encoded).toBe(
          '<p><span style="letter-spacing: 1&quot;px">Hi</span></p>',
        );
        expect(encoded).not.toContain("&amp;quot;");
        expect(findStyleAttr(firstOpenTag(encoded, "span"))?.value).toBe(
          'letter-spacing: 1"px',
        );
      });

      it("escapes a quote in text-align on the paragraph", () => {
        const html = textHtml("text", "<p>Hi</p>", {
          "text-align": 'center" onmouseover="x',
        });
        expect(expectClosedStyle(html, "p")).toBe(
          "text-align: center&quot; onmouseover=&quot;x",
        );
        expect(findStyleAttr(firstOpenTag(html, "p"))?.value).toBe(
          'text-align: center" onmouseover="x',
        );
      });

      it("keeps a length or normal line-height and drops a keyword that is not one", () => {
        expect(textHtml("text", "<p>Hi</p>", { "line-height": "16px" })).toBe(
          '<p style="line-height: 16px">Hi</p>',
        );
        expect(textHtml("text", "<p>Hi</p>", { "line-height": "16 px" })).toBe(
          '<p style="line-height: 16px">Hi</p>',
        );
        expect(textHtml("text", "<p>Hi</p>", { "line-height": "1.5em" })).toBe(
          '<p style="line-height: 1.5em">Hi</p>',
        );
        expect(textHtml("text", "<p>Hi</p>", { "line-height": "2REM" })).toBe(
          '<p style="line-height: 2rem">Hi</p>',
        );
        expect(textHtml("text", "<p>Hi</p>", { "line-height": "normal" })).toBe(
          '<p style="line-height: normal">Hi</p>',
        );
        expect(
          textHtml("text", "<p>Hi</p>", { "line-height": "inherit" }),
        ).toBe("<p>Hi</p>");
        expect(textHtml("text", "<p>Hi</p>", { "line-height": "  " })).toBe(
          "<p>Hi</p>",
        );
        expect(textHtml("text", "<p>Hi</p>", { "line-height": "bogus" })).toBe(
          "<p>Hi</p>",
        );
      });

      it("drops a keyword letter-spacing", () => {
        expect(
          textHtml("text", "<p>Hi</p>", { "letter-spacing": "normal" }),
        ).toBe("<p>Hi</p>");
        expect(
          textHtml("text", "<p>Hi</p>", { "letter-spacing": " inherit " }),
        ).toBe("<p>Hi</p>");
        expect(textHtml("text", "<p>Hi</p>", { "letter-spacing": "   " })).toBe(
          "<p>Hi</p>",
        );
      });

      it("keeps a comment, a bare < and an unclosed tag in the text", () => {
        const color = { color: "#555555" };
        expect(textHtml("text", "<p>Hi <!-- note --> there</p>", color)).toBe(
          '<p><span style="color: #555555">Hi <!-- note --> there</span></p>',
        );
        expect(textHtml("text", "<p>Hi <!-- note</p>", color)).toBe(
          '<p><span style="color: #555555">Hi <!-- note</p></span>',
        );
        expect(textHtml("text", "<p>1 < 2</p>", color)).toBe(
          '<p><span style="color: #555555">1 < 2</span></p>',
        );
        expect(textHtml("text", "<p>a<>b</p>", color)).toBe(
          '<p><span style="color: #555555">a<>b</span></p>',
        );
        expect(textHtml("text", "<p>Hi</p", color)).toBe(
          '<p><span style="color: #555555">Hi</p</span>',
        );
        expect(textHtml("text", '<p>Hi <span class="x"', color)).toBe(
          '<p><span style="color: #555555">Hi <span class="x"</span>',
        );
      });

      it("does not override a text-align the blob already sets", () => {
        expect(
          textHtml("text", '<p style="text-align: right">Hi</p>', {
            "text-align": "center",
            "line-height": "180%",
          }),
        ).toBe('<p style="text-align: right; line-height: 1.8">Hi</p>');
      });

      it("styles a heading and a leaf div the same way as a paragraph", () => {
        expect(
          textHtml("text", "<h2>Title</h2>", {
            color: "#222222",
            "font-size": "18px",
            "line-height": "150%",
          }),
        ).toBe(
          '<h2 style="font-size: 18px; line-height: 1.5"><span style="font-size: 18px; color: #222222">Title</span></h2>',
        );
        expect(
          textHtml("text", "<div>Hello</div>", {
            color: "#222222",
            "line-height": "150%",
          }),
        ).toBe(
          '<div style="line-height: 1.5"><span style="color: #222222">Hello</span></div>',
        );
      });

      it("writes the list box BeeFree renders onto ul, ol and li", () => {
        // Outer text sits 20px in: half of the 40px indent, which is what the
        // export's -20px wrapper does against the 40px UA padding. A nested
        // list keeps the full indent. Margins are 0, and the marker reverts
        // to the UA (disc, then circle).
        expect(textHtml("list", '<ul start="1"><li>One</li></ul>', {})).toBe(
          '<ul start="1" style="margin-top: 0; margin-bottom: 0; padding-left: 20px; list-style-type: revert"><li style="margin: 0">One</li></ul>',
        );
        expect(
          textHtml("list", "<ol><li>One<ul><li>Two</li></ul></li></ol>", {}),
        ).toBe(
          '<ol style="margin-top: 0; margin-bottom: 0; padding-left: 20px; list-style-type: revert"><li style="margin: 0">One<ul style="margin-top: 0; margin-bottom: 0; padding-left: 40px; list-style-type: revert"><li style="margin: 0">Two</li></ul></li></ol>',
        );
      });

      it("uses liIndent for the list padding and the end side when the list is rtl", () => {
        expect(
          textHtml(
            "list",
            "<ul><li>One<ul><li>Two</li></ul></li></ul>",
            {
              direction: "rtl",
            },
            { liIndent: "60px" },
          ),
        ).toBe(
          '<ul style="margin-top: 0; margin-bottom: 0; padding-right: 30px; list-style-type: revert"><li style="margin: 0">One<ul style="margin-top: 0; margin-bottom: 0; padding-right: 60px; list-style-type: revert"><li style="margin: 0">Two</li></ul></li></ul>',
        );
      });

      it("keeps a margin, padding or marker the list html already sets", () => {
        expect(
          textHtml(
            "list",
            '<ul style="margin-top: 4px; padding-left: 8px; list-style-type: square"><li style="margin-top: 2px">One</li></ul>',
            {},
          ),
        ).toBe(
          '<ul style="margin-top: 4px; padding-left: 8px; list-style-type: square; margin-bottom: 0"><li style="margin-top: 2px">One</li></ul>',
        );
      });

      it("leaves a list inside a text module on the renderer defaults", () => {
        expect(textHtml("text", "<ul><li>One</li></ul>", {})).toBe(
          "<ul><li>One</li></ul>",
        );
      });

      it("styles list items and the list root without overriding blob styles", () => {
        expect(
          textHtml("list", "<ul><li>One</li></ul>", {
            color: "#555555",
            "font-size": "14px",
            "font-family": "Georgia, serif",
            "letter-spacing": "1px",
            "line-height": "200%",
            "text-align": "center",
          }),
        ).toBe(
          '<ul style="font-size: 14px; text-align: center; line-height: 2; margin-top: 0; margin-bottom: 0; padding-left: 20px; list-style-type: revert"><li style="font-size: 14px; text-align: center; line-height: 2; margin: 0"><span style="font-size: 14px; color: #555555; font-family: Georgia; letter-spacing: 1px">One</span></li></ul>',
        );
        expect(
          textHtml(
            "list",
            '<ul><li style="text-align: right"><span style="font-size: 18px; color: #111111">One</span></li></ul>',
            {
              color: "#555555",
              "font-size": "14px",
              "line-height": "200%",
              "text-align": "center",
            },
          ),
        ).toBe(
          '<ul style="font-size: 14px; text-align: center; line-height: 2; margin-top: 0; margin-bottom: 0; padding-left: 20px; list-style-type: revert"><li style="text-align: right; font-size: 14px; line-height: 2; margin: 0"><span style="font-size: 14px; color: #555555"><span style="font-size: 18px; color: #111111">One</span></span></li></ul>',
        );
      });

      it("paints the module link color on an anchor that has none", () => {
        expect(
          textHtml(
            "text",
            '<p><a href="https://example.com" style="text-decoration: underline;">Read</a></p>',
            {},
            { linkColor: "#4397C7" },
          ),
        ).toBe(
          '<p><a href="https://example.com" style="text-decoration: underline; color: #4397c7">Read</a></p>',
        );
      });

      it("keeps a blob anchor color ahead of the module link color", () => {
        expect(
          textHtml(
            "text",
            '<p><a href="https://example.com" style="color: #ff0000; text-decoration: underline">Go</a></p>',
            { linkColor: "#4397c7" },
          ),
        ).toBe(
          '<p><a href="https://example.com" style="color: #ff0000; text-decoration: underline">Go</a></p>',
        );
      });

      it("reads link-color from the module style and leaves an anchor unset when neither is set", () => {
        expect(
          textHtml("text", '<p><a href="https://example.com">Go</a></p>', {
            "link-color": "#112233",
          }),
        ).toBe(
          '<p><a href="https://example.com" style="color: #112233">Go</a></p>',
        );
        expect(
          textHtml("text", '<p><a href="https://example.com">Go</a></p>', {}),
        ).toBe('<p><a href="https://example.com">Go</a></p>');
      });

      it("colors a list-item anchor from computedStyle", () => {
        expect(
          textHtml(
            "list",
            "<ul><li><a href=\"https://example.com\" style='text-decoration: underline'>One</a></li></ul>",
            { "line-height": "200%" },
            { linkColor: "#333333" },
          ),
        ).toBe(
          '<ul style="line-height: 2; margin-top: 0; margin-bottom: 0; padding-left: 20px; list-style-type: revert"><li style="line-height: 2; margin: 0"><a href="https://example.com" style="text-decoration: underline; color: #333333">One</a></li></ul>',
        );
      });
    });
  });
});
