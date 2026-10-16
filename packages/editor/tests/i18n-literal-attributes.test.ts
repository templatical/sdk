import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * No user-facing attribute in an editor template is a hardcoded string.
 *
 * `i18n-key-usage.test.ts` only sees `t.…` chains, so a literal
 * `placeholder="LH"` never reaches it and renders in English in every locale.
 * This scans each template for static (unbound) attributes that assistive tech
 * or the screen shows as text and fails on any value containing a letter.
 */

const SRC = join(import.meta.dirname, "..", "src");

const TEXT_ATTRIBUTES = [
  "placeholder",
  "title",
  "alt",
  "label",
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "aria-valuetext",
  "aria-placeholder",
];

// Values that read the same in every locale.
const LANGUAGE_NEUTRAL = new Set([
  // Example of a locale code, the value the field expects.
  'components/TemplateSettings.vue placeholder="en"',
  // Example of a URL.
  'components/toolbar/CountdownToolbar.vue placeholder="https://..."',
]);

// The lookbehind skips bound (`:title`), prefixed (`data-title`) and
// suffixed-name (`aria-label` read as `label`) matches.
const ATTRIBUTE = new RegExp(
  `(?<![:\\w-])(${TEXT_ATTRIBUTES.join("|")})=(?:"([^"]*)"|'([^']*)')`,
  "g",
);

function literalAttributes(template: string): string[] {
  return [...template.matchAll(ATTRIBUTE)]
    .map(([, name, double, single]) => [name, double ?? single] as const)
    .filter(([, value]) => /\p{L}/u.test(value))
    .map(([name, value]) => `${name}="${value}"`);
}

function templateOf(sfc: string): string {
  return sfc.slice(sfc.indexOf("<template"), sfc.lastIndexOf("</template>"));
}

function literalsInSource(): string[] {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".vue"))
    .map((e) => join(e.parentPath ?? SRC, e.name))
    .flatMap((path) => {
      const file = relative(SRC, path).split(sep).join("/");
      return literalAttributes(templateOf(readFileSync(path, "utf-8"))).map(
        (attribute) => `${file} ${attribute}`,
      );
    })
    .sort();
}

describe("editor template attributes", () => {
  it("translates every user-facing attribute", () => {
    const literals = literalsInSource();

    expect(literals.filter((entry) => !LANGUAGE_NEUTRAL.has(entry))).toEqual(
      [],
    );
    // A stale entry would quietly allow a future literal at the same spot.
    expect(literals.filter((entry) => LANGUAGE_NEUTRAL.has(entry))).toEqual(
      [...LANGUAGE_NEUTRAL].sort(),
    );
  });

  it("reports static text attributes and nothing bound or unrelated", () => {
    const template = `
      <select placeholder="LH" :title="t.lineHeight" data-title="x" />
      <area alt='Logo' aria-label="Bild" aria-hidden="true" />
      <input placeholder="0.5" title="" label="https://..." />
    `;

    expect(literalAttributes(template)).toEqual([
      'placeholder="LH"',
      'alt="Logo"',
      'aria-label="Bild"',
      'label="https://..."',
    ]);
  });
});
