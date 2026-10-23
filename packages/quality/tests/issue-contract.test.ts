import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCESSIBILITY_RULES,
  STRUCTURE_RULES,
  LINK_RULES,
  DELIVERABILITY_RULES,
  COMPATIBILITY_RULES,
} from "../src";
import a11yEn from "../src/accessibility/messages/en";
import a11yDe from "../src/accessibility/messages/de";
import structureEn from "../src/structure/messages/en";
import structureDe from "../src/structure/messages/de";
import linksEn from "../src/links/messages/en";
import linksDe from "../src/links/messages/de";
import deliverabilityEn from "../src/deliverability/messages/en";
import deliverabilityDe from "../src/deliverability/messages/de";
import compatibilityEn from "../src/compatibility/messages/en";
import compatibilityDe from "../src/compatibility/messages/de";
import legacy from "./fixtures/legacy-messages.json";

const maps = {
  accessibility: { en: a11yEn, de: a11yDe },
  structure: { en: structureEn, de: structureDe },
  links: { en: linksEn, de: linksDe },
  deliverability: { en: deliverabilityEn, de: deliverabilityDe },
};
const rewrites = new Set([
  "a11y.heading-skip-level",
  "structure.duplicate-block-id",
  "a11y.img-alt-too-long",
  "a11y.link-empty",
  "a11y.link-href-empty",
  "a11y.link-target-blank-no-rel",
  "a11y.link-nested-anchor",
  "a11y.text-low-contrast",
  "a11y.text-too-small",
  "a11y.button-touch-target",
  "a11y.button-low-contrast",
  "a11y.missing-preheader",
  "structure.section-column-mismatch",
  "structure.nested-section",
  "structure.hero-not-applied.image",
  "link.malformed-mailto",
  "link.malformed-tel",
]);
const rules = [
  ...ACCESSIBILITY_RULES,
  ...STRUCTURE_RULES,
  ...LINK_RULES,
  ...DELIVERABILITY_RULES,
  ...COMPATIBILITY_RULES,
];

function anchors(markdown: string): Set<string> {
  return new Set(
    [...markdown.matchAll(/^#{1,6} (.+)$/gm)].map(([, heading]) => {
      const explicit = /\{#([^}]+)\}/.exec(heading);
      return explicit
        ? explicit[1]
        : heading
            .replace(/`/g, "")
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-");
    }),
  );
}

describe("rich issue contract", () => {
  it("keeps complete action sentences in the suggestion field", () => {
    expect(a11yEn["a11y.img-linked-no-context"]).toEqual({
      message:
        "Linked image alt describes the image but not the link destination.",
      suggestion: "Include where the link goes (e.g. 'Buy spring sale').",
    });
    expect(a11yDe["a11y.img-linked-no-context"]).toEqual({
      message: "Verlinktes Bild beschreibt nur das Motiv, nicht das Linkziel.",
      suggestion: "Nenne das Ziel (z. B. „Frühlingssale ansehen“).",
    });
    expect(a11yDe["a11y.heading-skip-level"].suggestion).toBe(
      "Gehe jeweils nur eine Ebene weiter.",
    );
    expect(structureEn["structure.duplicate-block-id"].suggestion).toBe(
      "Give each block a unique id.",
    );
    expect(structureDe["structure.duplicate-block-id"].suggestion).toBe(
      "Gib jedem Block eine eindeutige ID.",
    );
  });

  it("has a concrete suggestion in both quality locales for every rule", () => {
    for (const [category, locales] of Object.entries(maps)) {
      for (const locale of ["en", "de"] as const) {
        const messages = locales[locale] as Record<
          string,
          { message: string; suggestion: string }
        >;
        for (const [id, pair] of Object.entries(messages)) {
          expect(pair.message, `${category}/${locale}/${id}`).toBeTruthy();
          expect(pair.suggestion, `${category}/${locale}/${id}`).toBeTruthy();
        }
      }
    }
    for (const [locale, messages] of [
      ["en", compatibilityEn],
      ["de", compatibilityDe],
    ] as const) {
      for (const [id, pair] of Object.entries(messages.hand)) {
        expect(pair.message, `${locale}/${id}`).toBeTruthy();
        expect(pair.suggestion, `${locale}/${id}`).toBeTruthy();
      }
      for (const [id, pair] of Object.entries(messages.features)) {
        expect(pair.feature, `${locale}/${id}`).toBeTruthy();
        expect(pair.suggestion, `${locale}/${id}`).toBeTruthy();
      }
    }
  });

  it("preserves every pure-split legacy sentence byte for byte", () => {
    for (const [category, locales] of Object.entries(maps)) {
      for (const locale of ["en", "de"] as const) {
        const old = legacy[category as keyof typeof legacy][locale] as Record<
          string,
          string
        >;
        const messages = locales[locale] as Record<
          string,
          { message: string; suggestion: string }
        >;
        for (const [id, original] of Object.entries(old)) {
          if (rewrites.has(id)) continue;
          expect(
            messages[id].message + " " + messages[id].suggestion,
            `${locale}/${id}`,
          ).toBe(original);
        }
      }
    }
  });

  it("gives every rule an absolute reference whose local fragment resolves", () => {
    for (const rule of rules) {
      const url = new URL(rule.meta.reference);
      expect(url.protocol, rule.meta.id).toBe("https:");
      if (url.hostname !== "docs.templatical.com") continue;
      expect(url.hash, rule.meta.id).not.toBe("");
      const page = resolve(
        import.meta.dirname,
        "../../../apps/docs",
        `${url.pathname.replace(/^\//, "")}.md`,
      );
      const markdown = readFileSync(page, "utf8");
      expect(anchors(markdown), rule.meta.id).toContain(url.hash.slice(1));
    }
  });
});
