import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createMenuBlock,
  createParagraphBlock,
  createTableBlock,
  createTitleBlock,
} from "@templatical/types";
import { RenderContext, renderBlock } from "../src";
import {
  addOutlookLineHeight,
  addOutlookLineHeightWithFontSize,
  outlookLineHeightPx,
} from "../src/outlook-line-height";
import { expectLinear } from "./helpers/expectLinear";

const options = { lineHeight: 1.5, fontSizePx: 14 };
const context = new RenderContext(600, [], "Arial, sans-serif", true);

describe("outlookLineHeightPx", () => {
  it.each([
    [1.8, 14, "25.2px"],
    ["1.8", 14, "25.2px"],
    ["150%", 14, "21px"],
    [1.15, 14, "16.1px"],
    ["2", 12.5, "25px"],
    ["25px", 14, null],
    ["normal", 14, null],
    ["1.5em", 14, null],
    ["1.5rem", 14, null],
    ["bogus", 14, null],
    [0, 14, null],
    [-1, 14, null],
    [Number.NaN, 14, null],
    [Number.POSITIVE_INFINITY, 14, null],
    [1.5, Number.NaN, null],
  ] as const)("converts %s at %s px to %s", (lineHeight, size, expected) => {
    expect(outlookLineHeightPx(lineHeight, size)).toBe(expected);
  });
});

describe("addOutlookLineHeight", () => {
  it("reports the visible content size for title wrapping", () => {
    const result = addOutlookLineHeightWithFontSize(
      '<p style="font-size:32px"><span style="font-size:40px">Wide</span></p>',
      options,
    );
    expect(result).toEqual({
      html: '<p style="font-size:32px;mso-line-height-alt:48px"><span style="font-size:40px">Wide</span></p>',
      firstParagraphFontSizePx: 40,
    });
    expect(addOutlookLineHeightWithFontSize("Bare text", options)).toEqual({
      html: "Bare text",
      firstParagraphFontSizePx: null,
    });
  });
  it.each([
    ["<p>Hello</p>", '<p style="mso-line-height-alt:21px">Hello</p>'],
    [
      '<p style="line-height: 1.8;">Hello</p>',
      '<p style="line-height: 1.8;mso-line-height-alt:25.2px">Hello</p>',
    ],
    [
      '<p style="font-size:18px;line-height:1.5">Hello</p>',
      '<p style="font-size:18px;line-height:1.5;mso-line-height-alt:27px">Hello</p>',
    ],
    [
      '<p style="line-height:1;line-height:2">Hi</p>',
      '<p style="line-height:1;line-height:2;mso-line-height-alt:28px">Hi</p>',
    ],
    [
      '<p style="line-height:2!important;line-height:1">Hi</p>',
      '<p style="line-height:2!important;line-height:1;mso-line-height-alt:28px">Hi</p>',
    ],
    [
      '<p style="line-height:1!important;line-height:2!important">Hi</p>',
      '<p style="line-height:1!important;line-height:2!important;mso-line-height-alt:28px">Hi</p>',
    ],
    [
      '<p><span style="font-size:18px">A</span><span style="font-size:18px">B</span></p>',
      '<p style="mso-line-height-alt:27px"><span style="font-size:18px">A</span><span style="font-size:18px">B</span></p>',
    ],
    [
      '<p><span style="font-size:18px">A</span><span style="font-size:20px">B</span></p>',
      '<p style="mso-line-height-alt:21px"><span style="font-size:18px">A</span><span style="font-size:20px">B</span></p>',
    ],
    [
      '<p><span style="font-size:18px"><span style="font-size:20px">A</span>B</span></p>',
      '<p style="mso-line-height-alt:21px"><span style="font-size:18px"><span style="font-size:20px">A</span>B</span></p>',
    ],
    [
      '<p><span style="font-size:18px"><span style="font-size:18px">A</span>B</span></p>',
      '<p style="mso-line-height-alt:27px"><span style="font-size:18px"><span style="font-size:18px">A</span>B</span></p>',
    ],
    [
      '<p>Outside<span style="font-size:18px">Inside</span></p>',
      '<p style="mso-line-height-alt:21px">Outside<span style="font-size:18px">Inside</span></p>',
    ],
    [
      "<p style='line-height:150%'>Hello</p>",
      "<p style='line-height:150%;mso-line-height-alt:21px'>Hello</p>",
    ],
    [
      '<p title="2 > 1" style="line-height:2">Hello</p>',
      '<p title="2 > 1" style="line-height:2;mso-line-height-alt:28px">Hello</p>',
    ],
    [
      "<li>One</li><h2>Two</h2>",
      '<li style="mso-line-height-alt:21px">One</li><h2 style="mso-line-height-alt:21px">Two</h2>',
    ],
    [
      "<li><p>One</p></li>",
      '<li style="mso-line-height-alt:21px"><p style="mso-line-height-alt:21px">One</p></li>',
    ],
    [
      '<p style="mso-line-height-alt:30px;line-height:1.5">Hello</p>',
      '<p style="mso-line-height-alt:30px;line-height:1.5">Hello</p>',
    ],
    ["<p style='unterminated", "<p style='unterminated"],
    ["<p><!-- unfinished", "<p><!-- unfinished"],
    [
      '<p><!-- <span> --><span style="font-size:18px">Hi</span></p>',
      '<p style="mso-line-height-alt:27px"><!-- <span> --><span style="font-size:18px">Hi</span></p>',
    ],
    ["<p >Hi</p>", '<p  style="mso-line-height-alt:21px">Hi</p>'],
    [
      "<p disabled>Hi</p>",
      '<p disabled style="mso-line-height-alt:21px">Hi</p>',
    ],
    [
      "<p title=hi>Hi</p>",
      '<p title=hi style="mso-line-height-alt:21px">Hi</p>',
    ],
    ['<p style="">Hi</p>', '<p style="mso-line-height-alt:21px">Hi</p>'],
    [
      '<p style="font-size:0px">Hi</p>',
      '<p style="font-size:0px;mso-line-height-alt:21px">Hi</p>',
    ],
    ['<p style="line-height:0">Hi</p>', '<p style="line-height:0">Hi</p>'],
    [
      "<p><span></span>Hi</p>",
      '<p style="mso-line-height-alt:21px"><span></span>Hi</p>',
    ],
    ["<p>Hi<br/>Bye</p>", '<p style="mso-line-height-alt:21px">Hi<br/>Bye</p>'],
    ["</p><p>Hi</p>", '</p><p style="mso-line-height-alt:21px">Hi</p>'],
    ["<p>Hi</div>", "<p>Hi</div>"],
    ["<3><p>Hi</p>", '<3><p style="mso-line-height-alt:21px">Hi</p>'],
    ["<", "<"],
    ["<p", "<p"],
    ["<p foo=>Hi</p>", '<p foo= style="mso-line-height-alt:21px">Hi</p>'],
    [
      "<p><a href=http://x/>l</a> t</p>",
      '<p style="mso-line-height-alt:21px"><a href=http://x/>l</a> t</p>',
    ],
    [
      '<p><a href=http://x/><span style="font-size:18px">l</span></a></p>',
      '<p style="mso-line-height-alt:27px"><a href=http://x/><span style="font-size:18px">l</span></a></p>',
    ],
    [
      '<p><span style="font-size:18px" data=http://x/>Hi</span></p>',
      '<p style="mso-line-height-alt:27px"><span style="font-size:18px" data=http://x/>Hi</span></p>',
    ],
    [
      "<p><em>One</p><p>Two</p>",
      '<p style="mso-line-height-alt:21px"><em>One</p><p style="mso-line-height-alt:21px">Two</p>',
    ],
    [
      '<p><span style="font-size:18px">Hi</span></bogus></p>',
      '<p style="mso-line-height-alt:27px"><span style="font-size:18px">Hi</span></bogus></p>',
    ],
    [
      "<p style=color:red>a</p>",
      '<p style="color:red;mso-line-height-alt:21px">a</p>',
    ],
    [
      '<p style=background:url(a"b"c)>a</p>',
      '<p style=background:url(a"b"c)>a</p>',
    ],
    [
      '<p style=background:url(a"b)>a</p>',
      '<p style=background:url(a"b)>a</p>',
    ],
    [
      "<p style=background:url(a'b'c)>a</p>",
      "<p style=background:url(a'b'c)>a</p>",
    ],
    [
      "<p style=background:url(a`b)>a</p>",
      "<p style=background:url(a`b)>a</p>",
    ],
    [
      '<p><span style="font-size:18px"></span><span style="font-size:18px">Hi</span></p>',
      '<p style="mso-line-height-alt:27px"><span style="font-size:18px"></span><span style="font-size:18px">Hi</span></p>',
    ],
    [
      "<p title='style=\"line-height:2\"'>Hi</p>",
      '<p title=\'style="line-height:2"\' style="mso-line-height-alt:21px">Hi</p>',
    ],
    ["Bare text", "Bare text"],
  ])("adds the Word value to %s", (input, expected) => {
    expect(addOutlookLineHeight(input, options)).toBe(expected);
  });

  it("keeps a pixel line height unchanged", () => {
    expect(
      addOutlookLineHeight('<p style="line-height:22px">Hi</p>', options),
    ).toBe('<p style="line-height:22px">Hi</p>');
  });

  it("uses inherited CSS font size for nested text without a sized span", () => {
    expect(
      addOutlookLineHeight(
        '<li style="font-size:20px;line-height:2"><p>Hi</p></li>',
        options,
      ),
    ).toBe(
      '<li style="font-size:20px;line-height:2;mso-line-height-alt:40px"><p style="mso-line-height-alt:40px">Hi</p></li>',
    );
  });

  it("uses inherited size when spans have mixed sizes", () => {
    expect(
      addOutlookLineHeight(
        '<li style="font-size:20px"><p><span style="font-size:18px">A</span><span style="font-size:22px">B</span></p></li>',
        options,
      ),
    ).toContain('<p style="mso-line-height-alt:30px">');
  });

  it("keeps a uniform span size ahead of inherited size", () => {
    expect(
      addOutlookLineHeight(
        '<li style="font-size:20px"><p><span style="font-size:18px">A</span></p></li>',
        options,
      ),
    ).toContain('<p style="mso-line-height-alt:27px">');
  });

  it("counts a strong font-size override as a mixed text run", () => {
    expect(
      addOutlookLineHeight(
        '<p><span style="font-size:18px">A<strong style="font-size:24px">B</strong></span></p>',
        options,
      ),
    ).toContain('<p style="mso-line-height-alt:21px">');
  });

  it("keeps inherited span size through a strong without an override", () => {
    expect(
      addOutlookLineHeight(
        '<p><span style="font-size:18px">A<strong>B</strong></span></p>',
        options,
      ),
    ).toContain('<p style="mso-line-height-alt:27px">');
  });

  it("resolves an explicit percentage against its declaring element", () => {
    expect(
      addOutlookLineHeight(
        '<p style="line-height:150%"><span style="font-size:40px">Hi</span></p>',
        options,
      ),
    ).toBe(
      '<p style="line-height:150%;mso-line-height-alt:21px"><span style="font-size:40px">Hi</span></p>',
    );
  });

  it.each([
    [
      '<ul><li style="line-height:2"><p>Hi</p></li></ul>',
      '<ul><li style="line-height:2;mso-line-height-alt:28px"><p style="mso-line-height-alt:28px">Hi</p></li></ul>',
    ],
    [
      '<ul><li style="line-height:2"><p style="line-height:1.25">Hi</p></li></ul>',
      '<ul><li style="line-height:2;mso-line-height-alt:28px"><p style="line-height:1.25;mso-line-height-alt:17.5px">Hi</p></li></ul>',
    ],
    [
      '<ul><li style="font-size:20px;line-height:150%"><p style="font-size:10px">Hi</p></li></ul>',
      '<ul><li style="font-size:20px;line-height:150%;mso-line-height-alt:30px"><p style="font-size:10px;mso-line-height-alt:30px">Hi</p></li></ul>',
    ],
  ])("uses the effective ancestor line height for %s", (input, expected) => {
    expect(addOutlookLineHeight(input, options)).toBe(expected);
  });

  it("scales linearly with deeply nested spans", () => {
    // n=5000 detects repeated searches for nested span closes under coverage.
    expectLinear((n) => {
      const input = `<p>${"<span>".repeat(n)}Hello${"</span>".repeat(n)}</p>`;
      return () => addOutlookLineHeight(input, options);
    }, 5000);
    expect(addOutlookLineHeight("<p><span>Hello</span></p>", options)).toBe(
      '<p style="mso-line-height-alt:21px"><span>Hello</span></p>',
    );
  });

  // Coverage-mode negative checks repeat tail scans and need the longer timeout.
  it("scales linearly with many sibling paragraphs", () => {
    expectLinear((n) => {
      const input = "<p>Hi</p>".repeat(n);
      return () => addOutlookLineHeight(input, options);
    }, 3000);
    expect(addOutlookLineHeight("<p>Hi</p><p>Bye</p>", options)).toBe(
      '<p style="mso-line-height-alt:21px">Hi</p><p style="mso-line-height-alt:21px">Bye</p>',
    );
  }, 30_000);

  // Coverage-mode negative checks repeat style scans and need the longer timeout.
  it("scales linearly with a long style attribute", () => {
    expectLinear((n) => {
      const input = `<p style="color:${"a".repeat(n)};line-height:1.8">Hi</p>`;
      return () => addOutlookLineHeight(input, options);
    }, 15000);
    expect(
      addOutlookLineHeight(
        '<p style="color:red;line-height:1.8">Hi</p>',
        options,
      ),
    ).toBe(
      '<p style="color:red;line-height:1.8;mso-line-height-alt:25.2px">Hi</p>',
    );
  }, 30_000);
});

describe("renderer Outlook line height", () => {
  it("preserves the paragraph's browser value and adds a Word value", () => {
    const result = renderBlock(
      createParagraphBlock({ content: '<p style="line-height:1.8">Hi</p>' }),
      context,
    );
    expect(result).toContain('line-height="1.5"');
    expect(result).toContain(
      '<p style="line-height:1.8;mso-line-height-alt:25.2px">Hi</p>',
    );
  });

  it("sets the heading and each retained paragraph", () => {
    const single = renderBlock(
      createTitleBlock({ content: "<p>Hi</p>", level: 2 }),
      context,
    );
    expect(single).toContain('line-height="1.3"');
    expect(single).toContain(
      'font-weight:700;mso-line-height-alt:36.4px">Hi</h2>',
    );
    const multi = renderBlock(
      createTitleBlock({ content: "<p>One</p><p>Two</p>", level: 2 }),
      context,
    );
    expect(multi).toContain('<p style="mso-line-height-alt:36.4px">One</p>');
    expect(multi).toContain('<p style="mso-line-height-alt:36.4px">Two</p>');
  });

  it("ignores an unwrapped paragraph's own font size on the heading", () => {
    const ownOnly = renderBlock(
      createTitleBlock({
        content: '<p style="font-size:10px">a</p>',
        level: 1,
      }),
      context,
    );
    expect(ownOnly).toContain('font-size="36px"');
    expect(ownOnly).toContain(
      'font-weight:700;mso-line-height-alt:46.8px">a</h1>',
    );

    const result = renderBlock(
      createTitleBlock({
        content:
          '<p style="font-size:32px"><span style="font-size:40px">Wide</span></p>',
        level: 2,
      }),
      context,
    );
    expect(result).toContain('font-weight:700;mso-line-height-alt:52px">');
    expect(result).toContain('<span style="font-size:40px">Wide</span></h2>');

    const multi = renderBlock(
      createTitleBlock({
        content: '<p style="font-size:10px">a</p><p>b</p>',
        level: 1,
      }),
      context,
    );
    expect(multi).toContain('font-weight:700;mso-line-height-alt:46.8px">');
    expect(multi).toContain(
      '<p style="font-size:10px;mso-line-height-alt:13px">a</p>',
    );
  });

  it("uses a uniform span size for an unwrapped title and keeps multi-paragraph values", () => {
    const single = renderBlock(
      createTitleBlock({
        content: '<p><span style="font-size:40px">Wide</span></p>',
        level: 2,
      }),
      context,
    );
    expect(single).toContain('font-weight:700;mso-line-height-alt:52px">');
    const smallSpan = renderBlock(
      createTitleBlock({
        content: '<p><span style="font-size:10px">a</span></p>',
        level: 1,
      }),
      context,
    );
    expect(smallSpan).toContain('font-weight:700;mso-line-height-alt:13px">');
    const multi = renderBlock(
      createTitleBlock({
        content: '<p><span style="font-size:40px">Wide</span></p><p>Small</p>',
        level: 2,
      }),
      context,
    );
    expect(multi).toContain('font-weight:700;mso-line-height-alt:36.4px">');
    expect(multi).toContain(
      '<p style="mso-line-height-alt:52px"><span style="font-size:40px">Wide</span></p>',
    );
    expect(multi).toContain('<p style="mso-line-height-alt:36.4px">Small</p>');
  });

  it("wraps menu items in a Word styled div", () => {
    const result = renderBlock(
      createMenuBlock({
        fontSize: 16,
        items: [
          {
            id: "a",
            text: "Home",
            url: "/",
            openInNewTab: false,
            bold: false,
            underline: false,
          },
        ],
      }),
      context,
    );
    expect(result).toContain('line-height="1.5"');
    expect(result).toContain(
      '<div style="mso-line-height-alt:24px"><a href="/"',
    );
  });

  it("sets a Word value on each table cell", () => {
    const result = renderBlock(
      createTableBlock({
        fontSize: 16,
        hasHeaderRow: false,
        rows: [{ id: "r", cells: [{ id: "c", content: "Value" }] }],
      }),
      context,
    );
    expect(result).toContain('line-height="1.5"');
    expect(result).toContain(
      'padding: 8px; mso-line-height-alt:24px">Value</td>',
    );
  });

  it("keeps the button percentage and styles its label span", () => {
    const result = renderBlock(
      createButtonBlock({ text: "Go", fontSize: 14, lineHeight: 1.8 }),
      context,
    );
    expect(result).toContain('line-height="180%"');
    expect(result).toContain(
      '<span style="mso-line-height-alt:25.2px">Go</span>',
    );
  });

  it("omits the Word declaration when a menu or button has no usable font size", () => {
    const menu = renderBlock(
      createMenuBlock({
        fontSize: 0,
        items: [
          {
            id: "a",
            text: "Home",
            url: "/",
            openInNewTab: false,
            bold: false,
            underline: false,
          },
        ],
      }),
      context,
    );
    const button = renderBlock(
      createButtonBlock({ text: "Go", fontSize: 0 }),
      context,
    );
    expect(menu).toContain('><a href="/"');
    expect(menu).not.toContain("<div");
    expect(menu).not.toContain("mso-line-height-alt");
    expect(button).toContain("<span>Go</span>");
    expect(button).not.toContain("mso-line-height-alt");
  });
});
