// @vitest-environment happy-dom
import "./dom-stubs";
import { computed, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createHtmlBlock } from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import {
  HTML_BLOCK_PREVIEW_KEY,
  MERGE_TAGS_KEY,
  TRANSLATIONS_KEY,
  USE_MERGE_TAG_SAMPLES_KEY,
} from "../src/keys";
import HtmlBlock from "../src/components/blocks/HtmlBlock.vue";

function mountHtmlBlock(opts: {
  content: string;
  preview: boolean;
  useSamples?: boolean;
}) {
  const block = createHtmlBlock({ content: opts.content });
  return mount(HtmlBlock, {
    props: { block, viewport: "desktop" as const },
    global: {
      provide: {
        [TRANSLATIONS_KEY as symbol]: enTranslations,
        [HTML_BLOCK_PREVIEW_KEY as symbol]: opts.preview,
        [USE_MERGE_TAG_SAMPLES_KEY as symbol]: computed(
          () => opts.useSamples === true,
        ),
        [MERGE_TAGS_KEY as symbol]: ref([
          { value: "{{first_name}}", sample: "Ada", label: "First" },
        ]),
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

  it("substitutes merge-tag samples in the iframe srcdoc", () => {
    const wrapper = mountHtmlBlock({
      content: "<p>Hi {{first_name}}</p>",
      preview: true,
      useSamples: true,
    });
    expect(wrapper.find("iframe").attributes("srcdoc")).toBe("<p>Hi Ada</p>");
  });

  it("sizes the iframe from the document height on load", async () => {
    const wrapper = mountHtmlBlock({ content: "<p>Hi</p>", preview: true });
    const iframe = wrapper.find("iframe");
    Object.defineProperty(iframe.element, "contentDocument", {
      value: {
        body: { scrollHeight: 80 },
        documentElement: { scrollHeight: 140 },
      },
    });
    await iframe.trigger("load");
    expect((iframe.element as HTMLIFrameElement).style.height).toBe("140px");
  });

  it("disconnects the observer when the preview is torn down", async () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect = disconnect;
      },
    );
    const wrapper = mountHtmlBlock({ content: "<p>Hi</p>", preview: true });
    const iframe = wrapper.find("iframe");
    Object.defineProperty(iframe.element, "contentDocument", {
      value: {
        body: { scrollHeight: 40 },
        documentElement: { scrollHeight: 40 },
      },
    });
    await iframe.trigger("load");
    await wrapper.setProps({
      block: createHtmlBlock({ content: "" }),
    });
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
