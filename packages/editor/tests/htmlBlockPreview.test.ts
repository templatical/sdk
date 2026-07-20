// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createHtmlBlock } from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import { HTML_BLOCK_PREVIEW_KEY, TRANSLATIONS_KEY } from "../src/keys";
import HtmlBlock from "../src/components/blocks/HtmlBlock.vue";

function mountHtmlBlock(opts: { content: string; preview: boolean }) {
  const block = createHtmlBlock({ content: opts.content });
  return mount(HtmlBlock, {
    props: { block, viewport: "desktop" as const },
    global: {
      provide: {
        [TRANSLATIONS_KEY as symbol]: enTranslations,
        [HTML_BLOCK_PREVIEW_KEY as symbol]: opts.preview,
      },
    },
  });
}

describe("HtmlBlock preview (config.htmlBlockPreview)", () => {
  it("renders the static placeholder — not an iframe — when preview is disabled", () => {
    const wrapper = mountHtmlBlock({ content: "<p>Hi</p>", preview: false });
    expect(wrapper.find("iframe").exists()).toBe(false);
    expect(wrapper.text()).toContain(enTranslations.html.preview);
  });

  it("renders a sandboxed iframe with the content verbatim when enabled and content is present", () => {
    const wrapper = mountHtmlBlock({ content: "<p>Hi</p>", preview: true });
    const iframe = wrapper.find("iframe");
    expect(iframe.exists()).toBe(true);
    expect(iframe.attributes("srcdoc")).toBe("<p>Hi</p>");
  });

  it("sandboxes the iframe WITHOUT allow-scripts (the security contract)", () => {
    const wrapper = mountHtmlBlock({ content: "<p>Hi</p>", preview: true });
    const sandbox = wrapper.find("iframe").attributes("sandbox");
    expect(sandbox).toBe("allow-same-origin");
    expect(sandbox).not.toContain("allow-scripts");
  });

  it("shows the empty-state placeholder when enabled but content is blank", () => {
    const wrapper = mountHtmlBlock({ content: "   ", preview: true });
    expect(wrapper.find("iframe").exists()).toBe(false);
    expect(wrapper.text()).toContain(enTranslations.html.empty);
  });
});
