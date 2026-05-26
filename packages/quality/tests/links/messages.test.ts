import { describe, expect, it } from "vitest";
import en from "../../src/links/messages/en";
import de from "../../src/links/messages/de";
import {
  formatLinkMessage,
  getLinkMessages,
  SUPPORTED_LINK_MESSAGE_LOCALES,
} from "../../src/links/messages";
import { LINK_RULES } from "../../src";

describe("link rule messages", () => {
  it("en and de share the same key set", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it("every registered link rule has an en + de message", () => {
    for (const rule of LINK_RULES) {
      expect(en).toHaveProperty(rule.meta.id);
      expect(de).toHaveProperty(rule.meta.id);
    }
  });

  it("placeholders match between locales for every key", () => {
    const placeholders = (s: string) =>
      Array.from(s.matchAll(/\{(\w+)\}/g))
        .map((m) => m[1])
        .sort();
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(placeholders(de[key])).toEqual(placeholders(en[key]));
    }
  });

  it("falls back to en for unsupported locales", () => {
    expect(getLinkMessages("xx")).toBe(en);
  });

  it("strips region for matching", () => {
    expect(getLinkMessages("de-AT")).toBe(de);
  });

  it("interpolates {protocol} for unsupported-protocol", () => {
    const out = formatLinkMessage("en", "link.unsupported-protocol", {
      protocol: "ftp",
    });
    expect(out).toContain('"ftp"');
  });

  it("interpolates {host} for localhost-or-staging", () => {
    const out = formatLinkMessage("en", "link.localhost-or-staging", {
      host: "localhost",
    });
    expect(out).toContain('"localhost"');
  });

  it("uses the German template when locale=de", () => {
    const out = formatLinkMessage("de", "link.javascript-protocol", {
      protocol: "javascript",
    });
    expect(out).toContain("javascript");
    expect(out).toContain("entfernt");
  });

  it("interpolates {protocol} for javascript-protocol", () => {
    expect(
      formatLinkMessage("en", "link.javascript-protocol", { protocol: "data" }),
    ).toContain('"data:"');
    expect(
      formatLinkMessage("en", "link.javascript-protocol", { protocol: "vbscript" }),
    ).toContain('"vbscript:"');
  });

  it("exports the supported locale list", () => {
    expect(SUPPORTED_LINK_MESSAGE_LOCALES.sort()).toEqual(["de", "en"]);
  });
});
