import { describe, expect, it } from "vitest";
import en from "../../src/deliverability/messages/en";
import de from "../../src/deliverability/messages/de";
import { DELIVERABILITY_RULES, formatDeliverabilityMessage, getDeliverabilityMessages, SUPPORTED_DELIVERABILITY_MESSAGE_LOCALES } from "../../src";

describe("deliverability messages", () => {
  it("has key and placeholder parity between English and German", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
    const placeholders = (value: { message: string; suggestion: string }) => [...(value.message + " " + value.suggestion).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(placeholders(de[key])).toEqual(placeholders(en[key]));
    }
  });

  it("has a message for every registered rule", () => {
    for (const rule of DELIVERABILITY_RULES) {
      expect(Object.keys(en)).toContain(rule.meta.id);
      expect(Object.keys(de)).toContain(rule.meta.id);
    }
  });

  it("resolves regional German and unknown locales", () => {
    expect(getDeliverabilityMessages("de-AT")).toBe(de);
    expect(getDeliverabilityMessages("xx")).toBe(en);
    expect(SUPPORTED_DELIVERABILITY_MESSAGE_LOCALES.sort()).toEqual(["de", "en"]);
  });

  it("interpolates params and preserves missing tokens", () => {
    expect(formatDeliverabilityMessage("en", "deliverability.ip-address-url", { host: "203.0.113.7" }))
      .toEqual({ message: "This link points to the IP address 203.0.113.7 instead of a domain. Spam filters score links like this as spam.", suggestion: "Link to your domain." });
    expect(formatDeliverabilityMessage("de", "deliverability.link-text-domain-mismatch", { textHost: "example.com" }).message)
      .toContain("{linkHost}");
  });
});
