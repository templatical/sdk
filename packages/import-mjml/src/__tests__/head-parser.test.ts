import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";
import { describe, expect, it } from "vitest";
import { buildAttributeCascade } from "../attribute-resolver";
import { extractSettings } from "../head-parser";

function parse(mjml: string): CheerioAPI {
  return load(mjml, { xml: true });
}

function settingsOf(mjml: string) {
  const $ = parse(mjml);
  const warnings: string[] = [];
  const settings = extractSettings($, buildAttributeCascade($), warnings);
  return { settings, warnings };
}

describe("extractSettings", () => {
  it("defaults every setting for a bare document", () => {
    const { settings, warnings } = settingsOf("<mjml><mj-body /></mjml>");

    expect(settings).toEqual({
      width: 600,
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      linkUnderline: true,
      fontFamily: "Arial",
      locale: "en",
    });
    expect(warnings).toEqual([]);
  });

  it("reads width and background colour from mj-body", () => {
    const { settings } = settingsOf(
      '<mjml><mj-body width="640px" background-color="#f5f5f5" /></mjml>',
    );

    expect(settings.width).toBe(640);
    expect(settings.backgroundColor).toBe("#f5f5f5");
  });

  it("prefers mj-all font-family over mj-text font-family", () => {
    const { settings } = settingsOf(`
      <mjml><mj-head><mj-attributes>
        <mj-all font-family="Inter, sans-serif" />
        <mj-text font-family="Georgia, serif" />
      </mj-attributes></mj-head><mj-body /></mjml>`);

    expect(settings.fontFamily).toBe("Inter");
  });

  it("falls back to mj-text font-family when mj-all sets none", () => {
    const { settings } = settingsOf(`
      <mjml><mj-head><mj-attributes>
        <mj-text font-family="Georgia, serif" />
      </mj-attributes></mj-head><mj-body /></mjml>`);

    expect(settings.fontFamily).toBe("Georgia");
  });

  it("falls back to an mj-font declaration when mj-attributes sets none", () => {
    const { settings } = settingsOf(
      '<mjml><mj-head><mj-font name="Lato" href="https://x/lato.css" /></mj-head><mj-body /></mjml>',
    );

    expect(settings.fontFamily).toBe("Lato");
  });

  it("reads the document text colour from the mj-text default", () => {
    const { settings } = settingsOf(`
      <mjml><mj-head><mj-attributes>
        <mj-text color="#222222" />
      </mj-attributes></mj-head><mj-body /></mjml>`);

    expect(settings.textColor).toBe("#222222");
  });

  it("reads the preheader from mj-preview", () => {
    const { settings } = settingsOf(
      "<mjml><mj-head><mj-preview>  Your order shipped  </mj-preview></mj-head><mj-body /></mjml>",
    );

    expect(settings.preheaderText).toBe("Your order shipped");
  });

  it("omits preheaderText entirely when mj-preview is absent", () => {
    const { settings } = settingsOf("<mjml><mj-body /></mjml>");

    expect("preheaderText" in settings).toBe(false);
  });

  it("omits preheaderText when mj-preview is blank", () => {
    const { settings } = settingsOf(
      "<mjml><mj-head><mj-preview>   </mj-preview></mj-head><mj-body /></mjml>",
    );

    expect("preheaderText" in settings).toBe(false);
  });

  it("reads linkColor and linkUnderline from the mj-style anchor rule", () => {
    const { settings } = settingsOf(`
      <mjml><mj-head><mj-style>
        a { color: #0055ff; text-decoration: underline; }
      </mj-style></mj-head><mj-body /></mjml>`);

    expect(settings.linkColor).toBe("#0055ff");
    expect(settings.linkUnderline).toBe(true);
  });

  it("reads linkUnderline false from text-decoration none", () => {
    const { settings } = settingsOf(`
      <mjml><mj-head><mj-style>
        a { text-decoration: none; }
      </mj-style></mj-head><mj-body /></mjml>`);

    expect(settings.linkUnderline).toBe(false);
  });

  it("omits linkColor when no anchor rule declares one", () => {
    const { settings } = settingsOf(`
      <mjml><mj-head><mj-style>
        a { text-decoration: none; }
      </mj-style></mj-head><mj-body /></mjml>`);

    expect("linkColor" in settings).toBe(false);
  });

  it("reads the locale from the mjml lang attribute", () => {
    const { settings } = settingsOf('<mjml lang="de"><mj-body /></mjml>');

    expect(settings.locale).toBe("de");
  });

  it("warns about mj-title, which has no settings home", () => {
    const { warnings } = settingsOf(
      "<mjml><mj-head><mj-title>Spring Sale</mj-title></mj-head><mj-body /></mjml>",
    );

    expect(warnings).toEqual([
      'Dropped <mj-title> ("Spring Sale") — Templatical templates have no document-title field.',
    ]);
  });

  it("warns once per unhandled mj-head child", () => {
    const { warnings } = settingsOf(`
      <mjml><mj-head>
        <mj-breakpoint width="480px" />
        <mj-html-attributes />
      </mj-head><mj-body /></mjml>`);

    expect(warnings).toEqual([
      "Dropped <mj-breakpoint> — it has no Templatical equivalent.",
      "Dropped <mj-html-attributes> — it has no Templatical equivalent.",
    ]);
  });

  it("does not warn about mj-head children it consumes", () => {
    const { warnings } = settingsOf(`
      <mjml><mj-head>
        <mj-attributes><mj-all font-family="Inter" /></mj-attributes>
        <mj-preview>hi</mj-preview>
        <mj-font name="Inter" href="https://x/i.css" />
        <mj-style>a { color: #000000; }</mj-style>
      </mj-head><mj-body /></mjml>`);

    expect(warnings).toEqual([]);
  });

  it("reads linkColor when a CSS comment precedes the color declaration", () => {
    const { settings } = settingsOf(`
      <mjml><mj-head><mj-style>
        a { /* brand blue */ color: #0055ff; text-decoration: underline; }
      </mj-style></mj-head><mj-body /></mjml>`);

    expect(settings.linkColor).toBe("#0055ff");
    expect(settings.linkUnderline).toBe(true);
  });

  it("reads linkUnderline when a CSS comment precedes the text-decoration declaration", () => {
    const { settings } = settingsOf(`
      <mjml><mj-head><mj-style>
        a { color: #0055ff; /* keep underline */ text-decoration: underline; }
      </mj-style></mj-head><mj-body /></mjml>`);

    expect(settings.linkColor).toBe("#0055ff");
    expect(settings.linkUnderline).toBe(true);
  });
});
