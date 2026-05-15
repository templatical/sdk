// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { SYNTAX_PRESETS } from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import ParagraphBlock from "../src/components/blocks/ParagraphBlock.vue";
import TitleBlock from "../src/components/blocks/TitleBlock.vue";

function baseProvide() {
  return {
    [TRANSLATIONS_KEY as symbol]: enTranslations,
    [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
    [MERGE_TAGS_KEY as symbol]: [],
  };
}

describe("rich-text block HTML sanitization", () => {
  it("ParagraphBlock strips inline event handlers from block.content", () => {
    const wrapper = mount(ParagraphBlock, {
      props: {
        block: {
          id: "p-1",
          type: "paragraph",
          content: '<p>hi <img src="x.png" onerror="window.__pwn = 1"></p>',
          styles: {},
        } as any,
        viewport: "desktop",
      },
      global: { provide: baseProvide() },
    });

    const html = wrapper.html();
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("__pwn");
    expect(html).toContain("hi");
  });

  it("ParagraphBlock strips <script> from block.content", () => {
    const wrapper = mount(ParagraphBlock, {
      props: {
        block: {
          id: "p-1",
          type: "paragraph",
          content:
            '<p>before</p><script>window.__pwn = 1</script><p>after</p>',
          styles: {},
        } as any,
        viewport: "desktop",
      },
      global: { provide: baseProvide() },
    });

    const html = wrapper.html();
    expect(html).not.toContain("<script");
    expect(html).not.toContain("__pwn");
    expect(html).toContain("before");
    expect(html).toContain("after");
  });

  it("ParagraphBlock removes javascript: anchor hrefs from block.content", () => {
    const wrapper = mount(ParagraphBlock, {
      props: {
        block: {
          id: "p-1",
          type: "paragraph",
          content: '<p><a href="javascript:alert(1)">click</a></p>',
          styles: {},
        } as any,
        viewport: "desktop",
      },
      global: { provide: baseProvide() },
    });

    const html = wrapper.html();
    expect(html).not.toContain("javascript:");
    expect(html).toContain("click");
  });

  it("ParagraphBlock preserves safe HTML (bold, italic, https links)", () => {
    const wrapper = mount(ParagraphBlock, {
      props: {
        block: {
          id: "p-1",
          type: "paragraph",
          content:
            '<p><strong>bold</strong> <em>italic</em> <a href="https://example.com">link</a></p>',
          styles: {},
        } as any,
        viewport: "desktop",
      },
      global: { provide: baseProvide() },
    });

    const html = wrapper.html();
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain('href="https://example.com"');
  });

  it("TitleBlock strips inline event handlers from block.content", () => {
    const wrapper = mount(TitleBlock, {
      props: {
        block: {
          id: "t-1",
          type: "title",
          content: '<p>Hello <span onmouseover="window.__pwn = 1">world</span></p>',
          level: 1,
          styles: {},
        } as any,
        viewport: "desktop",
      },
      global: { provide: baseProvide() },
    });

    const html = wrapper.html();
    expect(html).not.toContain("onmouseover");
    expect(html).not.toContain("__pwn");
    expect(html).toContain("Hello");
    expect(html).toContain("world");
  });

  it("TitleBlock removes javascript: anchor hrefs", () => {
    const wrapper = mount(TitleBlock, {
      props: {
        block: {
          id: "t-1",
          type: "title",
          content: '<p><a href="javascript:alert(1)">x</a></p>',
          level: 2,
          styles: {},
        } as any,
        viewport: "desktop",
      },
      global: { provide: baseProvide() },
    });

    const html = wrapper.html();
    expect(html).not.toContain("javascript:");
  });
});
