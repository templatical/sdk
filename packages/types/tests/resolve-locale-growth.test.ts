import { describe, expect, it, vi } from "vitest";
import {
  createCustomBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createWrapperBlock,
  localizeBlock,
  resolveLocale,
  type Block,
  type TemplateContent,
} from "../src";

function reference(content: TemplateContent, locale: string): TemplateContent {
  const fallback = content.settings.locale ?? "en";
  const project = (blocks: Block[]): Block[] =>
    blocks.flatMap((block) => {
      if (locale !== fallback && block.l10n?.[locale]?.hidden) return [];
      const view = localizeBlock(block, locale, fallback);
      if (view.type === "section")
        view.children = view.children.map((column) => project(column));
      else if (view.type === "wrapper") view.children = project(view.children);
      return [view];
    });
  const { locales: _locales, l10n: _l10n, ...settings } = content.settings;
  return { blocks: project(content.blocks), settings: { ...settings, locale } };
}

function contentWith(blocks: Block[]): TemplateContent {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  content.blocks = blocks;
  return content;
}

function nested(depth: number): TemplateContent {
  let child: Block = createParagraphBlock({ id: "bottom", content: "leaf" });
  for (let i = 0; i < depth; i++) {
    child = createWrapperBlock({
      id: `w${i}`,
      children: [child, createParagraphBlock({ id: `p${i}`, content: "leaf" })],
    });
  }
  return contentWith([child]);
}

describe("resolveLocale projection", () => {
  it("matches the full-clone reference over layers and seeded trees without mutating input", () => {
    const changed = createParagraphBlock({ id: "changed", content: "English" });
    changed.l10n = {
      de: { text: { content: { value: "Deutsch", sourceHash: "x" } } },
    };
    const hidden = createParagraphBlock({ id: "hidden" });
    hidden.l10n = { de: { hidden: true } };
    const replacing = createWrapperBlock({
      id: "replacing",
      children: [hidden],
    });
    replacing.l10n = {
      de: { set: { children: [createParagraphBlock({ id: "replacement" })] } },
    };
    const path = createWrapperBlock({ id: "path", children: [changed] });
    path.l10n = { de: { set: { "children.changed.content": "path value" } } };
    const custom = createCustomBlock({
      type: "promo",
      name: "Promo",
      fields: [],
      template: "",
    });
    custom.renderedHtml = "<p>cached</p>";
    custom.l10n = { de: { set: { "fieldValues.title": "Neu" } } };
    const section = createSectionBlock({
      id: "section",
      columns: "2",
      children: [[path], [replacing, custom]],
    });
    const cases = [contentWith([section]), nested(6)];
    let seed = 7143;
    const random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    for (let sample = 0; sample < 30; sample++) {
      const make = (depth: number): Block => {
        const id = `r${sample}-${Math.floor(random() * 1e6)}`;
        if (depth === 0 || random() < 0.3) {
          const block = createParagraphBlock({ id, content: `text ${id}` });
          if (random() < 0.4)
            block.l10n = { de: { set: { content: `de ${id}` } } };
          return block;
        }
        const children = [
          make(depth - 1),
          createParagraphBlock({ id: `${id}-leaf` }),
        ];
        const block =
          random() < 0.5
            ? createWrapperBlock({ id, children })
            : createSectionBlock({ id, columns: "1", children: [children] });
        if (random() < 0.2) block.l10n = { de: { hidden: true } };
        return block;
      };
      cases.push(contentWith([make(4)]));
    }
    for (const content of cases) {
      const before = JSON.stringify(content);
      for (const locale of ["en", "de"])
        expect(resolveLocale(content, locale)).toEqual(
          reference(content, locale),
        );
      expect(JSON.stringify(content)).toBe(before);
    }
  });

  it("clones nested wrappers in linear total JSON work", () => {
    const original = JSON.stringify;
    const work = (depth: number) => {
      let bytes = 0;
      const spy = vi
        .spyOn(JSON, "stringify")
        .mockImplementation((value: any, replacer?: any, space?: any) => {
          const result = original(value, replacer, space);
          bytes += result?.length ?? 0;
          return result;
        });
      try {
        resolveLocale(nested(depth), "en");
      } finally {
        spy.mockRestore();
      }
      return bytes;
    };
    expect(work(80) / work(20)).toBeLessThan(10);
  });

  it("copies children on a block that is neither a section nor a wrapper", () => {
    const stray = createParagraphBlock({ id: "stray" }) as Block & {
      children: { id: string }[];
    };
    stray.children = [{ id: "inner" }];
    const content = contentWith([stray]);
    const [view] = resolveLocale(content, "en").blocks as (typeof stray)[];
    expect(view.children).toEqual([{ id: "inner" }]);
    expect(view.children).not.toBe(stray.children);
    expect(view.children[0]).not.toBe(stray.children[0]);
  });
});
