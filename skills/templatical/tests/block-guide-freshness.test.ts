import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyGuideRegions,
  buildGuideRegions,
} from "../../../packages/template-tools/scripts/generate-schema.mjs";

const REFERENCE_DIR = resolve(import.meta.dirname, "../reference");
const guide = readFileSync(resolve(REFERENCE_DIR, "block-guide.md"), "utf8");
const schema = JSON.parse(
  readFileSync(resolve(REFERENCE_DIR, "schema.json"), "utf8"),
);

// `countdown` needs the Cloud backend to render its animated GIF and `custom`
// blocks are consumer-registered at runtime, so the skill never emits either.
// Both stay valid in schema.json for Cloud and headless callers.
const EMITTABLE = [
  "button",
  "divider",
  "html",
  "image",
  "menu",
  "paragraph",
  "section",
  "social",
  "spacer",
  "table",
  "title",
  "video",
];

describe("block-guide.md's generated field lists", () => {
  it("match a fresh generation from the committed schema", () => {
    // Strictly stronger than asking whether each field is mentioned: this also
    // catches a stale committed copy, i.e. types changed and nobody re-ran the
    // generator. Same relationship schema-freshness.test.ts has to schema.json.
    expect(applyGuideRegions(guide, buildGuideRegions(schema))).toBe(guide);
  });

  it("carries a matched marker pair for exactly the emittable block types", () => {
    // Written literally rather than derived from the schema, so adding a block
    // type is a deliberate edit here — `countdown` needs Cloud to render and
    // `custom` is registered at runtime, so the skill emits neither.
    //
    // Both sides are asserted, not just BEGIN. A BEGIN whose END was deleted
    // leaves the region's regex without a closing anchor, so `applyGuideRegions`
    // no-ops on it and the freshness case above is satisfied by a region that
    // was never rewritten — while the BEGIN marker still advertises the block as
    // generated. Scanning END too states that invariant here rather than leaving
    // it to the generator's throw alone.
    const markerTypes = (kind: "BEGIN" | "END") =>
      [
        ...guide.matchAll(
          new RegExp(`<!-- ${kind} GENERATED FIELDS: ([a-z]+) -->`, "g"),
        ),
      ]
        .map(([, type]) => type)
        .sort();
    const expected = [...EMITTABLE].sort();
    expect(markerTypes("BEGIN")).toEqual(expected);
    expect(markerTypes("END")).toEqual(expected);
  });

  it("refuses a region that is opened and never closed", () => {
    const unclosed = guide.replace("<!-- END GENERATED FIELDS: image -->", "");
    expect(() =>
      applyGuideRegions(unclosed, buildGuideRegions(schema)),
    ).toThrowError(
      new Error(
        "block-guide.md opens a generated-field region it never closes: " +
          "image. Add the matching <!-- END GENERATED FIELDS: <type> --> " +
          "marker — without it the region is never rewritten, so the freshness " +
          "guard passes on stale content.",
      ),
    );
  });

  it("refuses a marker pair for a block type the schema does not declare", () => {
    const orphaned = guide.replace(
      /GENERATED FIELDS: html/g,
      "GENERATED FIELDS: carousel",
    );
    expect(() =>
      applyGuideRegions(orphaned, buildGuideRegions(schema)),
    ).toThrowError(
      new Error(
        "block-guide.md has generated-field markers for types the schema does " +
          "not declare: carousel. Remove the section or fix the type.",
      ),
    );
  });

  it("renders a literal union member as its literal, not its base type", () => {
    // `width?: number | "full"` reaches `renderType` as an `anyOf` whose second
    // member carries `const`. Handling `const` after `enum` — or not reaching
    // it through `anyOf` — renders `int | string`, which tells the agent a
    // button may be any width string. The freshness case above would also fail,
    // but as an unexplained diff; this one names the cause.
    expect(buildGuideRegions(schema).get("button")).toContain(
      '`width` (int | "full")',
    );
  });
});
