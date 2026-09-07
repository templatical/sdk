import { load } from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { describe, expect, it } from "vitest";
import {
  buildAttributeCascade,
  childElements,
  findByTag,
  readForeignCssClasses,
  readParagraphGap,
  readVisibility,
  resolveAttributes,
  tagOf,
} from "../attribute-resolver";

function parse(mjml: string): CheerioAPI {
  return load(mjml, { xml: { xmlMode: false, recognizeSelfClosing: true } });
}

function firstOf($: CheerioAPI, selector: string): Cheerio<Element> {
  return $(selector).first() as unknown as Cheerio<Element>;
}

describe("tagOf", () => {
  it("lowercases a tag name on the node itself, independent of what the parser already normalized", () => {
    const shoutingNode = { tagName: "MJ-BODY" } as unknown as Element;
    expect(tagOf(shoutingNode)).toBe("mj-body");
  });

  it("returns an empty string for a missing node", () => {
    expect(tagOf(undefined)).toBe("");
  });
});

describe("findByTag", () => {
  it("finds a tag written in lowercase", () => {
    const $ = parse("<mjml><mj-body><mj-section /></mj-body></mjml>");
    expect(findByTag($, "mj-body").length).toBe(1);
  });

  it("finds a tag written in uppercase", () => {
    const $ = parse("<mjml><MJ-BODY><mj-section /></MJ-BODY></mjml>");
    expect(findByTag($, "mj-body").length).toBe(1);
  });

  it("returns an empty selection when the tag is absent", () => {
    const $ = parse("<mjml><mj-head /></mjml>");
    expect(findByTag($, "mj-body").length).toBe(0);
  });
});

describe("childElements", () => {
  it("returns element children and skips text nodes", () => {
    const $ = parse(
      "<mjml><mj-body>\n  <mj-section /> text <mj-spacer />\n</mj-body></mjml>",
    );
    const kids = childElements(findByTag($, "mj-body"), $);
    expect(kids.map((k) => tagOf(k[0]))).toEqual(["mj-section", "mj-spacer"]);
  });
});

describe("buildAttributeCascade / resolveAttributes", () => {
  const doc = `
    <mjml>
      <mj-head>
        <mj-attributes>
          <mj-all font-family="Inter" padding="0" />
          <mj-text color="#333333" padding="10px" />
          <mj-class name="cta" color="#ff6600" />
          <mj-class name="tight" padding="2px" color="#0000ff" />
        </mj-attributes>
      </mj-head>
      <mj-body>
        <mj-section>
          <mj-column>
            <mj-text id="plain">a</mj-text>
            <mj-text id="inline" color="#000000">b</mj-text>
            <mj-text id="classed" mj-class="cta">c</mj-text>
            <mj-text id="both" mj-class="cta" color="#111111">d</mj-text>
            <mj-text id="multi" mj-class="tight cta">e</mj-text>
            <mj-text id="multiReversed" mj-class="cta tight">f</mj-text>
            <mj-image id="img" src="x.png" />
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>`;

  it("applies the per-tag default when nothing overrides it", () => {
    const $ = parse(doc);
    const attrs = resolveAttributes(
      firstOf($, "[id=plain]"),
      buildAttributeCascade($),
    );
    expect(attrs.color).toBe("#333333");
  });

  it("lets the per-tag default beat mj-all", () => {
    const $ = parse(doc);
    const attrs = resolveAttributes(
      firstOf($, "[id=plain]"),
      buildAttributeCascade($),
    );
    expect(attrs.padding).toBe("10px");
  });

  it("inherits mj-all for an attribute no per-tag default sets", () => {
    const $ = parse(doc);
    const attrs = resolveAttributes(
      firstOf($, "[id=plain]"),
      buildAttributeCascade($),
    );
    expect(attrs["font-family"]).toBe("Inter");
  });

  it("applies mj-all to a tag with no per-tag defaults at all", () => {
    const $ = parse(doc);
    const attrs = resolveAttributes(
      firstOf($, "[id=img]"),
      buildAttributeCascade($),
    );
    expect(attrs["font-family"]).toBe("Inter");
    expect(attrs.padding).toBe("0");
  });

  it("lets an inline attribute beat the per-tag default", () => {
    const $ = parse(doc);
    const attrs = resolveAttributes(
      firstOf($, "[id=inline]"),
      buildAttributeCascade($),
    );
    expect(attrs.color).toBe("#000000");
  });

  it("lets an mj-class beat the per-tag default", () => {
    const $ = parse(doc);
    const attrs = resolveAttributes(
      firstOf($, "[id=classed]"),
      buildAttributeCascade($),
    );
    expect(attrs.color).toBe("#ff6600");
  });

  it("lets an inline attribute beat an mj-class", () => {
    const $ = parse(doc);
    const attrs = resolveAttributes(
      firstOf($, "[id=both]"),
      buildAttributeCascade($),
    );
    expect(attrs.color).toBe("#111111");
  });

  it("merges several mj-class entries, the later name winning a conflict", () => {
    const $ = parse(doc);
    const attrs = resolveAttributes(
      firstOf($, "[id=multi]"),
      buildAttributeCascade($),
    );
    expect(attrs.padding).toBe("2px");
    expect(attrs.color).toBe("#ff6600");
  });

  it("still lets the later name win when the class order is reversed", () => {
    const $ = parse(doc);
    const attrs = resolveAttributes(
      firstOf($, "[id=multiReversed]"),
      buildAttributeCascade($),
    );
    expect(attrs.padding).toBe("2px");
    expect(attrs.color).toBe("#0000ff");
  });

  it("drops the mj-class attribute itself from the resolved set", () => {
    const $ = parse(doc);
    const attrs = resolveAttributes(
      firstOf($, "[id=classed]"),
      buildAttributeCascade($),
    );
    expect(attrs["mj-class"]).toBeUndefined();
  });

  it("returns an empty cascade for a document with no mj-attributes", () => {
    const $ = parse("<mjml><mj-body><mj-text>a</mj-text></mj-body></mjml>");
    const cascade = buildAttributeCascade($);
    expect(cascade.all).toEqual({});
    expect(cascade.byTag).toEqual({});
    expect(cascade.byClass).toEqual({});
  });

  it("does not let a class literally named __proto__ poison lookups for other classes", () => {
    const $ = parse(`
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-class name="__proto__" color="red" />
          </mj-attributes>
        </mj-head>
        <mj-body>
          <mj-section>
            <mj-column>
              <mj-text mj-class="color">x</mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>`);
    const cascade = buildAttributeCascade($);

    // The lookup a poisoned prototype would otherwise answer for.
    expect(cascade.byClass.color).toBeUndefined();

    // Through the public API: an undeclared "color" class contributes nothing.
    const attrs = resolveAttributes(firstOf($, "mj-text"), cascade);
    expect(attrs).toEqual({});
  });
});

describe("readVisibility", () => {
  it("returns undefined when no visibility class is present", () => {
    expect(readVisibility({})).toBeUndefined();
  });

  it("returns undefined when css-class carries only foreign classes", () => {
    expect(readVisibility({ "css-class": "promo" })).toBeUndefined();
  });

  it("reads a desktop-hidden block", () => {
    expect(readVisibility({ "css-class": "tpl-hide-desktop" })).toEqual({
      desktop: false,
      mobile: true,
    });
  });

  it("reads a mobile-hidden block", () => {
    expect(readVisibility({ "css-class": "tpl-hide-mobile" })).toEqual({
      desktop: true,
      mobile: false,
    });
  });

  it("reads a block hidden on both viewports", () => {
    expect(
      readVisibility({ "css-class": "tpl-hide-desktop tpl-hide-mobile" }),
    ).toEqual({ desktop: false, mobile: false });
  });

  it("ignores foreign classes sharing the attribute", () => {
    expect(
      readVisibility({ "css-class": "promo tpl-hide-mobile wide" }),
    ).toEqual({ desktop: true, mobile: false });
  });
});

describe("readForeignCssClasses", () => {
  it("returns the classes with no Templatical meaning", () => {
    expect(
      readForeignCssClasses({ "css-class": "promo tpl-hide-mobile wide" }),
    ).toEqual(["promo", "wide"]);
  });

  it("returns an empty array when every class is a visibility class", () => {
    expect(
      readForeignCssClasses({
        "css-class": "tpl-hide-desktop tpl-hide-mobile",
      }),
    ).toEqual([]);
  });

  it("returns an empty array when the attribute is absent", () => {
    expect(readForeignCssClasses({})).toEqual([]);
  });

  it("excludes the renderer's rich-text markers but keeps a consumer's own tpl- prefixed class", () => {
    expect(
      readForeignCssClasses({
        "css-class": "tpl-rich-text tpl-rich-text-8 tpl-custom promo",
      }),
    ).toEqual(["tpl-custom", "promo"]);
  });

  it("excludes a rich-text gap marker at any gap value, not only the default", () => {
    expect(readForeignCssClasses({ "css-class": "tpl-rich-text-24" })).toEqual(
      [],
    );
  });

  it("excludes a fractional rich-text gap marker too", () => {
    expect(readForeignCssClasses({ "css-class": "tpl-rich-text-8.5" })).toEqual(
      [],
    );
  });
});

describe("readParagraphGap", () => {
  it("returns null when no gap class is present", () => {
    expect(readParagraphGap({})).toBe(null);
  });

  it("returns null when css-class carries only foreign classes", () => {
    expect(readParagraphGap({ "css-class": "promo" })).toBe(null);
  });

  it("reads an integer gap", () => {
    expect(readParagraphGap({ "css-class": "tpl-rich-text-8" })).toBe(8);
  });

  it("reads a fractional gap", () => {
    expect(readParagraphGap({ "css-class": "tpl-rich-text-8.5" })).toBe(8.5);
  });

  it("ignores foreign classes sharing the attribute", () => {
    expect(
      readParagraphGap({ "css-class": "promo tpl-rich-text-24 wide" }),
    ).toBe(24);
  });
});
