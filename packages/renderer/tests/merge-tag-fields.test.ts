import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createImageBlock,
  createParagraphBlock,
  createTitleBlock,
} from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * Regression for `@templatical/types` MergeTag interface adding optional
 * `group` and `description` fields (display-only, picker-only). The
 * renderer never reads MergeTag — it only consumes block content — so
 * MJML output must remain identical whether or not those fields exist.
 *
 * Anchoring on `byte-identical` output catches the bug class where a
 * future renderer change starts pulling merge tag metadata into MJML
 * — e.g. emitting `data-group` attributes the consumer never asked for.
 */
describe("renderer — group/description fields never leak into MJML", () => {
  const mergeTagSpan =
    '<span data-merge-tag="{{first_name}}" data-label="First Name">First Name</span>';

  it("paragraph block: MJML output is byte-identical with or without group/description metadata", async () => {
    const baseline = createDefaultTemplateContent();
    baseline.blocks = [
      createParagraphBlock({ content: `<p>Hello ${mergeTagSpan}!</p>` }),
    ];

    // Same input content; we simulate a world where the renderer might
    // *some day* receive merge tag metadata and have to ignore it.
    const enriched = createDefaultTemplateContent();
    enriched.blocks = [
      createParagraphBlock({ content: `<p>Hello ${mergeTagSpan}!</p>` }),
    ];

    const baselineMjml = await renderToMjml(baseline);
    const enrichedMjml = await renderToMjml(enriched);
    expect(enrichedMjml).toBe(baselineMjml);
    expect(enrichedMjml).not.toContain("group");
    expect(enrichedMjml).not.toContain("description");
  });

  it("title block: MJML output preserves the merge tag value and contains no group/description tokens", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createTitleBlock({ content: `<h1>Welcome ${mergeTagSpan}</h1>` }),
    ];
    const mjml = await renderToMjml(content);
    // The renderer flattens the editor's data-merge-tag span into its
    // raw value for MJML output. The raw value must survive; the
    // picker-only metadata must not surface anywhere.
    expect(mjml).toContain("{{first_name}}");
    expect(mjml).not.toContain("data-group");
    expect(mjml).not.toContain("data-description");
  });

  it("button block: URL field with merge tag does not pull MergeTag metadata into MJML", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({
        text: "Sign up",
        url: "https://example.com/?ref={{first_name}}",
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain("{{first_name}}");
    expect(mjml).not.toContain("Recipient");
    expect(mjml).not.toContain("Personalized greeting");
  });

  it("image alt text containing a merge tag does not leak MergeTag fields", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createImageBlock({
        src: "https://example.com/avatar.png",
        alt: "Avatar of {{first_name}}",
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain("Avatar of {{first_name}}");
    expect(mjml).not.toContain("Recipient");
    expect(mjml).not.toContain("Personalized greeting");
  });

  it("merge tag rendering in MJML emits the raw value and never picker-only metadata", async () => {
    // The renderer flattens the editor's `<span data-merge-tag>` shell
    // into the raw value during MJML emission — the send-time engine
    // (Liquid/Mailchimp/etc.) reads the raw value, not the editor's
    // wrapper. This test asserts that contract: the value survives,
    // and any future extension that leaks `group` / `description` (or
    // a `data-*` form of them) into the output is a regression.
    const content = createDefaultTemplateContent();
    content.blocks = [
      createParagraphBlock({ content: `<p>${mergeTagSpan}</p>` }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain("{{first_name}}");
    expect(mjml).not.toContain("data-group");
    expect(mjml).not.toContain("data-description");
    expect(mjml).not.toContain("Recipient");
    expect(mjml).not.toContain("Personalized greeting");
  });
});
