import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import slugs from "../../src/compatibility/slugs.json";
import {
  CANIEMAIL_DATA,
  CANIEMAIL_DATA_DATE,
} from "../../src/compatibility/data/caniemail.generated";
import { PINNED_NOTES } from "../../src/compatibility/support";
import { COMPATIBILITY_RULES } from "../../src";
import { transformCaniemail } from "../../scripts/sync-caniemail.mjs";

describe("caniemail snapshot", () => {
  it("registers exactly the detector slugs", () => {
    expect(slugs).toEqual(
      COMPATIBILITY_RULES.map((r) => r.meta.id.slice(7)).filter(
        (slug) =>
          slug !== "html-script" &&
          slug !== "html-iframe" &&
          slug !== "gmail-clipping",
      ),
    );
    expect(Object.keys(CANIEMAIL_DATA)).toEqual(slugs);
    expect(CANIEMAIL_DATA_DATE).toBe("2026-09-16");
  });

  it("pins every note used for narrowing to exact dataset text", () => {
    for (const [slug, notes] of Object.entries(PINNED_NOTES)) {
      for (const [number, text] of Object.entries(notes)) {
        expect(
          (CANIEMAIL_DATA as Record<string, { notes: Record<string, string> }>)[
            slug
          ].notes[number],
        ).toBe(text);
      }
    }
  });

  it("reproduces the checked-in fixture byte for byte", () => {
    const raw = readFileSync(
      resolve(import.meta.dirname, "fixtures/api.json"),
      "utf8",
    );
    const expected = readFileSync(
      resolve(import.meta.dirname, "fixtures/expected.ts"),
      "utf8",
    );
    expect(transformCaniemail(raw, ["css-display-flex"])).toBe(expected);
    expect(transformCaniemail(raw, ["css-display-flex"])).toBe(expected);
  });

  it("uses the last-listed version, even when lexical sorting differs", () => {
    const raw = readFileSync(
      resolve(import.meta.dirname, "fixtures/api.json"),
      "utf8",
    );
    const output = transformCaniemail(raw, ["css-display-flex"]);
    expect(output).toContain('"version": "2024-05"');
    expect(output).toContain('"value": "n"');
    expect(() => transformCaniemail(raw, ["missing-feature"])).toThrow(
      "Missing caniemail feature: missing-feature",
    );
    expect(() =>
      transformCaniemail(raw.replace('"1.0.4"', '"2.0.0"'), [
        "css-display-flex",
      ]),
    ).toThrow("Unsupported caniemail API version: 2.0.0");
  });

  it("preserves source order for integer-looking version keys", () => {
    const raw = readFileSync(
      resolve(import.meta.dirname, "fixtures/api.json"),
      "utf8",
    ).replace('"2024-12":"y","2024-05":"n #2"', '"2024":"y","2019":"n #2"');
    const output = transformCaniemail(raw, ["css-display-flex"]);
    expect(output).toContain('"version": "2019"');
    expect(output).toContain('"value": "n"');
  });

  it("keeps the MIT notice in the published bundle", () => {
    const bundle = readFileSync(
      resolve(import.meta.dirname, "../../dist/index.js"),
      "utf8",
    );
    expect(bundle).toContain(
      "/*! caniemail data © Rémi Parmentier, MIT — https://github.com/hteumeuleu/caniemail */",
    );
  });
});
