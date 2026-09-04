import { load } from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { describe, expect, it } from "vitest";
import type {
  MenuBlock,
  SocialIconsBlock,
  TableBlock,
} from "@templatical/types";
import {
  buildAttributeCascade,
  resolveAttributes,
} from "../attribute-resolver";
import { convertElement } from "../block-mapper";
import type { ConvertContext } from "../block-base";

function convert(markup: string, selector: string) {
  const $: CheerioAPI = load(`<mjml><mj-body>${markup}</mj-body></mjml>`, {
    xml: { xmlMode: false, recognizeSelfClosing: true },
  });
  const ctx: ConvertContext = {
    $,
    cascade: buildAttributeCascade($),
    containerWidth: 600,
    warnings: [],
  };
  const $el = $(selector).first() as unknown as Cheerio<Element>;
  void resolveAttributes($el, ctx.cascade);
  return { result: convertElement($el, ctx)!, ctx };
}

describe("mj-social", () => {
  it("recovers platforms from the name attribute (hand-written MJML)", () => {
    const { result } = convert(
      `<mj-social align="left" icon-size="24px">
         <mj-social-element name="facebook" href="https://fb.test/x" />
         <mj-social-element name="linkedin" href="https://li.test/x" />
       </mj-social>`,
      "mj-social",
    );
    const block = result.block as SocialIconsBlock;

    expect(block.type).toBe("social");
    expect(block.align).toBe("left");
    expect(block.iconSize).toBe("small");
    expect(block.icons.map((i) => [i.platform, i.url])).toEqual([
      ["facebook", "https://fb.test/x"],
      ["linkedin", "https://li.test/x"],
    ]);
    expect(result.entry.status).toBe("converted");
  });

  it("recovers platforms from the src filename (Templatical output has no name)", () => {
    const { result } = convert(
      `<mj-social align="center" icon-padding="0">
         <mj-social-element src="https://cdn.test/icons/circle/instagram.png" href="https://ig.test/x" icon-size="32px" padding="0 14px 0 0" border-radius="50%" />
         <mj-social-element src="https://cdn.test/icons/circle/youtube.png" href="https://yt.test/x" icon-size="32px" padding="0 0px 0 0" border-radius="50%" />
       </mj-social>`,
      "mj-social",
    );
    const block = result.block as SocialIconsBlock;

    expect(block.icons.map((i) => i.platform)).toEqual([
      "instagram",
      "youtube",
    ]);
    expect(block.iconSize).toBe("medium");
    expect(block.iconStyle).toBe("circle");
    expect(block.spacing).toBe(14);
  });

  it("maps x to twitter and strips a -noshare suffix", () => {
    const { result } = convert(
      `<mj-social>
         <mj-social-element name="x" href="https://x.test/a" />
         <mj-social-element name="facebook-noshare" href="https://fb.test/a" />
       </mj-social>`,
      "mj-social",
    );

    expect(
      (result.block as SocialIconsBlock).icons.map((i) => i.platform),
    ).toEqual(["twitter", "facebook"]);
  });

  it("falls back to website for an unknown platform and reports it", () => {
    const { result } = convert(
      '<mj-social><mj-social-element name="mastodon" href="https://m.test/a" /></mj-social>',
      "mj-social",
    );
    const block = result.block as SocialIconsBlock;

    expect(block.icons[0].platform).toBe("website");
    expect(block.icons[0].url).toBe("https://m.test/a");
    expect(result.entry.status).toBe("approximated");
    expect(result.entry.note).toBe(
      'Unrecognised social platform "mastodon" mapped to "website".',
    );
  });

  it("reads a 4px radius as solid and reports the outlined ambiguity", () => {
    const { result } = convert(
      '<mj-social><mj-social-element href="https://x.test" border-radius="4px" name="github" /></mj-social>',
      "mj-social",
    );

    expect((result.block as SocialIconsBlock).iconStyle).toBe("solid");
    expect(result.entry.status).toBe("approximated");
    expect(result.entry.note).toBe(
      'Icon border-radius 4px maps to both "solid" and "outlined"; resolved to "solid".',
    );
  });

  it("returns null for an mj-social with no elements", () => {
    const $: CheerioAPI = load(
      "<mjml><mj-body><mj-social /></mj-body></mjml>",
      {
        xml: { xmlMode: false, recognizeSelfClosing: true },
      },
    );
    const ctx: ConvertContext = {
      $,
      cascade: buildAttributeCascade($),
      containerWidth: 600,
      warnings: [],
    };
    const $el = $("mj-social").first() as unknown as Cheerio<Element>;

    expect(convertElement($el, ctx)).toBe(null);
  });
});

describe("mj-navbar", () => {
  it("converts links to menu items", () => {
    const { result } = convert(
      `<mj-navbar align="left">
         <mj-navbar-link href="/a" color="#112233">Alpha</mj-navbar-link>
         <mj-navbar-link href="/b" target="_blank">Beta</mj-navbar-link>
       </mj-navbar>`,
      "mj-navbar",
    );
    const block = result.block as MenuBlock;

    expect(block.type).toBe("menu");
    expect(block.textAlign).toBe("left");
    expect(block.items.map((i) => [i.text, i.url, i.openInNewTab])).toEqual([
      ["Alpha", "/a", false],
      ["Beta", "/b", true],
    ]);
    expect(block.items[0].color).toBe("#112233");
    expect(result.entry).toEqual({
      sourceTag: "mj-navbar",
      templaticalBlockType: "menu",
      status: "converted",
    });
  });

  it("returns null for an mj-navbar with no links", () => {
    const $: CheerioAPI = load(
      "<mjml><mj-body><mj-navbar /></mj-body></mjml>",
      {
        xml: { xmlMode: false, recognizeSelfClosing: true },
      },
    );
    const ctx: ConvertContext = {
      $,
      cascade: buildAttributeCascade($),
      containerWidth: 600,
      warnings: [],
    };
    const $el = $("mj-navbar").first() as unknown as Cheerio<Element>;

    expect(convertElement($el, ctx)).toBe(null);
  });
});

describe("mj-table", () => {
  it("converts rows, cells and a header row", () => {
    const { result } = convert(
      `<mj-table color="#222222" font-size="14px">
         <tr><th>Item</th><th>Qty</th></tr>
         <tr><td>Mug</td><td>2</td></tr>
       </mj-table>`,
      "mj-table",
    );
    const block = result.block as TableBlock;

    expect(block.type).toBe("table");
    expect(block.hasHeaderRow).toBe(true);
    expect(block.color).toBe("#222222");
    expect(block.fontSize).toBe(14);
    expect(block.rows.map((r) => r.cells.map((c) => c.content))).toEqual([
      ["Item", "Qty"],
      ["Mug", "2"],
    ]);
    expect(result.entry).toEqual({
      sourceTag: "mj-table",
      templaticalBlockType: "table",
      status: "converted",
    });
  });

  it("returns null for an mj-table with no rows", () => {
    const $: CheerioAPI = load("<mjml><mj-body><mj-table /></mj-body></mjml>", {
      xml: { xmlMode: false, recognizeSelfClosing: true },
    });
    const ctx: ConvertContext = {
      $,
      cascade: buildAttributeCascade($),
      containerWidth: 600,
      warnings: [],
    };
    const $el = $("mj-table").first() as unknown as Cheerio<Element>;

    expect(convertElement($el, ctx)).toBe(null);
  });
});
