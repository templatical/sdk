import { describe, expect, it, vi } from "vitest";
import {
  createCustomBlock,
  createDefaultTemplateContent,
  createSectionBlock,
  type CustomBlock,
  type CustomBlockDefinition,
} from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * `getCustomBlockStylesheet` option: collect per-definition CSS from the
 * content tree, dedupe, emit as `<mj-style>` inside `<mj-head>` alongside the
 * built-in visibility media-query block.
 */

const STACK_CSS = `
@media (max-width: 480px) {
  .tplc-image-text { display: block !important; }
}
`;

const HOVER_CSS = `
.tplc-product-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
`;

function definition(
  type: string,
  stylesheet?: string,
): CustomBlockDefinition {
  return {
    type,
    name: type,
    fields: [],
    template: `<div class="tplc-${type}">{{ text }}</div>`,
    ...(stylesheet === undefined ? {} : { stylesheet }),
  };
}

function contentWithCustomBlocks(...blocks: CustomBlock[]) {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  return content;
}

describe("renderer — custom block stylesheets", () => {
  it("emits a definition's stylesheet inside an additional mj-style block in mj-head", async () => {
    const def = definition("image-text", STACK_CSS);
    const content = contentWithCustomBlocks(createCustomBlock(def));

    const mjml = await renderToMjml(content, {
      renderCustomBlock: async () => "<div>x</div>",
      getCustomBlockStylesheet: (t) => (t === "image-text" ? STACK_CSS : null),
    });

    expect(mjml).toContain(".tplc-image-text { display: block !important; }");
    // Built-in visibility block stays as the first mj-style; the new one is
    // appended — both present, in this order.
    const headSection = mjml.slice(0, mjml.indexOf("</mj-head>"));
    const visibilityIdx = headSection.indexOf("tpl-hide-mobile");
    const customIdx = headSection.indexOf("tplc-image-text");
    expect(visibilityIdx).toBeGreaterThan(0);
    expect(customIdx).toBeGreaterThan(visibilityIdx);
  });

  it("dedupes across multiple instances of the same customType", async () => {
    const def = definition("image-text", STACK_CSS);
    const content = contentWithCustomBlocks(
      createCustomBlock(def),
      createCustomBlock(def),
      createCustomBlock(def),
    );

    const resolver = vi.fn(
      (t: string) => (t === "image-text" ? STACK_CSS : null),
    );

    const mjml = await renderToMjml(content, {
      renderCustomBlock: async () => "<div>x</div>",
      getCustomBlockStylesheet: resolver,
    });

    // Resolver called once per UNIQUE customType, not once per instance.
    expect(resolver).toHaveBeenCalledTimes(1);
    // Stylesheet rendered exactly once in the output.
    const occurrences = mjml.match(/\.tplc-image-text/g) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it("dedupes by content when two definitions ship identical stylesheets", async () => {
    const defA = definition("a", STACK_CSS);
    const defB = definition("b", STACK_CSS);
    const content = contentWithCustomBlocks(
      createCustomBlock(defA),
      createCustomBlock(defB),
    );

    const mjml = await renderToMjml(content, {
      renderCustomBlock: async () => "<div>x</div>",
      getCustomBlockStylesheet: (t) =>
        t === "a" || t === "b" ? STACK_CSS : null,
    });

    const occurrences = mjml.match(/\.tplc-image-text/g) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it("emits both stylesheets when two definitions ship different CSS", async () => {
    const defA = definition("a", STACK_CSS);
    const defB = definition("b", HOVER_CSS);
    const content = contentWithCustomBlocks(
      createCustomBlock(defA),
      createCustomBlock(defB),
    );

    const mjml = await renderToMjml(content, {
      renderCustomBlock: async () => "<div>x</div>",
      getCustomBlockStylesheet: (t) =>
        t === "a" ? STACK_CSS : t === "b" ? HOVER_CSS : null,
    });

    expect(mjml).toContain(".tplc-image-text");
    expect(mjml).toContain(".tplc-product-card:hover");
  });

  it("skips definitions whose stylesheet is whitespace-only", async () => {
    const def = definition("blank");
    const content = contentWithCustomBlocks(createCustomBlock(def));

    const mjml = await renderToMjml(content, {
      renderCustomBlock: async () => "<div>x</div>",
      getCustomBlockStylesheet: () => "   \n\t  ",
    });

    // Only the built-in visibility mj-style block should be present.
    const mjStyleBlocks = mjml.match(/<mj-style>/g) ?? [];
    expect(mjStyleBlocks.length).toBe(1);
  });

  it("skips definitions where the resolver returns undefined or null", async () => {
    const def = definition("no-styles");
    const content = contentWithCustomBlocks(createCustomBlock(def));

    const mjmlUndef = await renderToMjml(content, {
      renderCustomBlock: async () => "<div>x</div>",
      getCustomBlockStylesheet: () => undefined,
    });
    const mjmlNull = await renderToMjml(content, {
      renderCustomBlock: async () => "<div>x</div>",
      getCustomBlockStylesheet: () => null,
    });

    expect((mjmlUndef.match(/<mj-style>/g) ?? []).length).toBe(1);
    expect((mjmlNull.match(/<mj-style>/g) ?? []).length).toBe(1);
  });

  it("does not call the resolver when the template has no custom blocks", async () => {
    const content = createDefaultTemplateContent();
    const resolver = vi.fn(() => STACK_CSS);

    await renderToMjml(content, {
      getCustomBlockStylesheet: resolver,
    });

    expect(resolver).not.toHaveBeenCalled();
  });

  it("works without the option (backward compatible)", async () => {
    const def = definition("image-text", STACK_CSS);
    const content = contentWithCustomBlocks(createCustomBlock(def));

    const mjml = await renderToMjml(content, {
      renderCustomBlock: async () => "<div>x</div>",
      // No getCustomBlockStylesheet — should not crash, and emit only the
      // built-in visibility mj-style block.
    });

    expect((mjml.match(/<mj-style>/g) ?? []).length).toBe(1);
    expect(mjml).not.toContain(".tplc-image-text");
  });

  it("wraps the stylesheet in <mj-style> inside <mj-head>, preserving CSS verbatim", async () => {
    const def = definition("image-text", STACK_CSS);
    const content = contentWithCustomBlocks(createCustomBlock(def));

    const mjml = await renderToMjml(content, {
      renderCustomBlock: async () => "<div>x</div>",
      getCustomBlockStylesheet: (t) =>
        t === "image-text" ? STACK_CSS : null,
    });

    // 1. The CSS body sits between an opening <mj-style> and a closing
    //    </mj-style> — not bare text in head, not concatenated into the
    //    visibility block, not in body. Non-greedy `[\s\S]*?` allows the
    //    `@media` wrapper around our target class, but the regex still
    //    pins the bounding mj-style tags on both sides so a future refactor
    //    that drops either tag fails this test.
    expect(mjml).toMatch(
      /<mj-style>[\s\S]*?\.tplc-image-text \{ display: block !important; \}[\s\S]*?<\/mj-style>/,
    );

    // 2. That entire <mj-style>…</mj-style> pair sits inside <mj-head>…
    //    </mj-head> — explicit head-bounded regex, no "is the index lower
    //    than X" proxy.
    expect(mjml).toMatch(
      /<mj-head>[\s\S]*<mj-style>[\s\S]*\.tplc-image-text[\s\S]*<\/mj-style>[\s\S]*<\/mj-head>/,
    );

    // 3. The CSS content is preserved verbatim — newlines and the @media
    //    wrap are intact (the renderer must not strip or reflow the CSS).
    expect(mjml).toContain("@media (max-width: 480px)");
    expect(mjml).toContain(".tplc-image-text { display: block !important; }");

    // 4. Custom stylesheet does NOT leak into mj-body (the only place
    //    consumer HTML lands). Walk forward from `</mj-head>` to
    //    `</mj-body>` and confirm the CSS string is absent from that span.
    const bodyStart = mjml.indexOf("</mj-head>");
    const bodyEnd = mjml.indexOf("</mj-body>");
    const bodySection = mjml.slice(bodyStart, bodyEnd);
    expect(bodySection).not.toContain(".tplc-image-text {");
  });

  it("collects custom-block types nested inside sections", async () => {
    const def = definition("image-text", STACK_CSS);
    const inSection = createSectionBlock({
      columns: "2",
      children: [[createCustomBlock(def)], []],
    });
    const content = createDefaultTemplateContent();
    content.blocks = [inSection];

    const mjml = await renderToMjml(content, {
      renderCustomBlock: async () => "<div>x</div>",
      getCustomBlockStylesheet: (t) =>
        t === "image-text" ? STACK_CSS : null,
    });

    expect(mjml).toContain(".tplc-image-text");
  });
});
