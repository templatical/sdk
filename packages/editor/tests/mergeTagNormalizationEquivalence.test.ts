// @vitest-environment happy-dom
//
// The safety argument for normalizing at all, asserted rather than assumed.
//
// `convertMergeTagsToValues` replaces a whole `<span data-merge-tag>` with its
// attribute value, discarding the inner text — so a normalized template and its
// bare-token original compile to *identical* MJML. Nothing downstream of the
// editor can tell whether normalization ran.
//
// The corollary is a trap worth stating: because the output is identical, a
// renderer-level test can never tell you whether normalization happened. That
// is what the content-shape assertions elsewhere are for. This file proves
// equivalence, and equivalence only.

import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
  createButtonBlock,
  SYNTAX_PRESETS,
  type MergeTag,
  type TemplateContent,
} from "@templatical/types";
import { renderToMjml } from "@templatical/renderer";
import {
  normalizeMergeTagMarkup,
  normalizeMergeTagsInHtml,
} from "../src/utils/normalizeMergeTagMarkup";
import {
  getMergeTagLabel,
  getMergeTagSample,
  resolveHtmlMergeTagLabels,
  substituteHtmlMergeTagSamples,
} from "@templatical/types";

const LIQUID = SYNTAX_PRESETS.liquid;

const TAGS: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}", sample: "Ada" },
  // Deliberately sample-less — the two halves of the sample rule have to be
  // visible in one template, exactly as the playground config arranges them.
  { label: "Last Name", value: "{{last_name}}" },
  { label: "Unsubscribe URL", value: "{{unsubscribe_url}}" },
];

function template(): TemplateContent {
  return {
    ...createDefaultTemplateContent(),
    blocks: [
      createTitleBlock({ content: "Hi {{first_name}} {{last_name}}" }),
      createParagraphBlock({
        content:
          "<p>Tier {{customer.tier}} — " +
          '<a href="{{unsubscribe_url}}">unsubscribe</a></p>',
      }),
      createButtonBlock({
        text: "Hi {{first_name}}",
        url: "https://x.test/{{unsubscribe_url}}",
      }),
    ],
  };
}

describe("MJML equivalence (F4)", () => {
  it("compiles a normalized template to byte-identical MJML", async () => {
    const original = template();
    const normalized = normalizeMergeTagMarkup(original, TAGS, LIQUID);

    // Guard against a vacuous pass: if normalization did nothing, identical
    // output would prove nothing at all.
    expect(normalized).not.toBe(original);

    const [before, after] = await Promise.all([
      renderToMjml(original),
      renderToMjml(normalized),
    ]);

    expect(after).toBe(before);
  });

  it("puts the token, not the label, into the MJML for a normalized tag", async () => {
    const normalized = normalizeMergeTagMarkup(template(), TAGS, LIQUID);

    const mjml = await renderToMjml(normalized);

    expect(mjml).toContain("Hi {{first_name}} {{last_name}}");
    expect(mjml).not.toContain("First Name");
  });

  it("keeps an undeclared token verbatim in the MJML", async () => {
    const normalized = normalizeMergeTagMarkup(template(), TAGS, LIQUID);

    const mjml = await renderToMjml(normalized);

    expect(mjml).toContain("Tier {{customer.tier}}");
  });

  it("leaves the href token untouched in the MJML", async () => {
    const normalized = normalizeMergeTagMarkup(template(), TAGS, LIQUID);

    const mjml = await renderToMjml(normalized);

    expect(mjml).toContain('href="{{unsubscribe_url}}"');
    expect(mjml).not.toContain("<span data-merge-tag");
  });
});

// ---------------------------------------------------------------------------
// The point of the whole exercise: a normalized tag is a real tag
// ---------------------------------------------------------------------------

describe("a normalized token behaves as a tag on preview surfaces", () => {
  const bare = "<p>Hi {{first_name}} {{last_name}}</p>";

  it("renders human labels in Label view", () => {
    const normalized = normalizeMergeTagsInHtml(bare, TAGS, LIQUID);

    expect(resolveHtmlMergeTagLabels(normalized, TAGS)).toBe(
      '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span> ' +
        '<span data-merge-tag="{{last_name}}">Last Name</span></p>',
    );
  });

  it("substitutes the sample in Sample view, keeping the sample-less tag highlighted", () => {
    const normalized = normalizeMergeTagsInHtml(bare, TAGS, LIQUID);

    // `{{first_name}}` has a sample, so it is unwrapped to plain text — losing
    // the highlight is what makes it read as delivered content. `{{last_name}}`
    // has none, so it keeps its span and shows its label.
    expect(substituteHtmlMergeTagSamples(normalized, TAGS)).toBe(
      '<p>Hi Ada <span data-merge-tag="{{last_name}}">Last Name</span></p>',
    );
  });

  it("does neither for a bare token, which is why normalizing is needed", () => {
    expect(resolveHtmlMergeTagLabels(bare, TAGS)).toBe(bare);
    expect(substituteHtmlMergeTagSamples(bare, TAGS)).toBe(bare);
  });

  it("resolves an undeclared normalized token to its raw value with no sample", () => {
    const normalized = normalizeMergeTagsInHtml(
      "<p>{{customer.tier}}</p>",
      TAGS,
      LIQUID,
    );

    expect(getMergeTagLabel("{{customer.tier}}", TAGS)).toBe(
      "{{customer.tier}}",
    );
    expect(getMergeTagSample("{{customer.tier}}", TAGS)).toBeUndefined();
    expect(substituteHtmlMergeTagSamples(normalized, TAGS)).toBe(
      '<p><span data-merge-tag="{{customer.tier}}">{{customer.tier}}</span></p>',
    );
  });
});
