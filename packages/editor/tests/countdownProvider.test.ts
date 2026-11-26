// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import {
  createCountdownBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import Editor from "../src/Editor.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";
import { toMjmlForInstance } from "../src/utils/toMjml";
import { createRenderMethods } from "../src/utils/renderProvider";

const TARGET = "2026-12-24T17:00:00.000Z";
const GIF = "https://example.com/countdown.gif";

class FakeImage {
  static instances: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";

  constructor() {
    FakeImage.instances.push(this);
  }

  load() {
    this.onload?.();
  }
}

function content() {
  const result = createDefaultTemplateContent();
  result.settings.locale = "de";
  result.blocks = [
    createCountdownBlock({
      targetDate: TARGET,
      timezone: "Europe/Berlin",
      styles: { padding: { top: 6, right: 12, bottom: 18, left: 24 } },
    }),
  ];
  return result;
}

describe("countdown provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reaches the canvas through the real Editor.vue config literal", async () => {
    FakeImage.instances = [];
    vi.stubGlobal("Image", FakeImage);
    const translations = await loadTranslations("en");
    const imageUrl = () => GIF;
    const wrapper = mount(Editor, {
      props: {
        config: {
          container: document.createElement("div"),
          content: content(),
          countdown: { imageUrl },
        },
        translations,
        fontsManager: useFonts(undefined),
      } as never,
      global: { stubs: { teleport: true } },
    });

    await flushPromises();
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 250));
    await flushPromises();
    const preloaded = FakeImage.instances.find((image) => image.src === GIF);
    expect(preloaded?.src).toBe(GIF);
    preloaded?.load();
    await flushPromises();
    expect(wrapper.get(`img[src="${GIF}"]`).attributes("alt")).toBe(
      "Countdown: 24. Dezember 2026 um 18:00 (Europe/Berlin)",
    );
    expect(wrapper.find('button[data-palette-type="countdown"]').exists()).toBe(
      true,
    );
    expect(
      wrapper
        .get('[data-block-type="countdown"] .tpl-block-content')
        .attributes("style"),
    ).toContain("padding: 6px 12px 18px 24px");
  });

  it("wires the URL provider into the local MJML export", async () => {
    const data = content();
    const mjml = await toMjmlForInstance({
      getContent: () => data,
      renderCustomBlock: async () => "",
      countdown: { imageUrl: () => GIF },
    });

    expect(mjml).toContain(`<mj-image\n  src="${GIF}"`);
    expect(mjml).toContain(
      'alt="Countdown: 24. Dezember 2026 um 18:00 (Europe/Berlin)"',
    );
  });

  it("keeps the unrenderable marker without a countdown provider", async () => {
    const data = content();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const mjml = await toMjmlForInstance({
        getContent: () => data,
        renderCustomBlock: async () => "",
      });
      expect(mjml).toContain(
        `<mj-raw><!-- templatical:unrenderable-block type="countdown" id="${data.blocks[0].id}" --></mj-raw>`,
      );
    } finally {
      warn.mockRestore();
    }
  });

  it.each(["", "   "])(
    "keeps the unrenderable marker for a provider returning %j",
    async (url) => {
      const data = content();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const mjml = await toMjmlForInstance({
          getContent: () => data,
          renderCustomBlock: async () => "",
          countdown: { imageUrl: () => url },
        });
        expect(mjml).toContain(
          `<mj-raw><!-- templatical:unrenderable-block type="countdown" id="${data.blocks[0].id}" --></mj-raw>`,
        );
      } finally {
        warn.mockRestore();
      }
    },
  );

  it("includes the countdown image in toHtml() through the host compiler", async () => {
    const data = content();
    const source = {
      getContent: () => data,
      renderCustomBlock: async () => "",
      countdown: { imageUrl: () => GIF },
    };
    const methods = createRenderMethods({
      provider: {
        compileMjml: async (mjml) => {
          const image = mjml.match(/<mj-image\b[^>]*\bsrc="([^"]*)"/);
          return image
            ? `<html><img src="${image[1]}"></html>`
            : "<html></html>";
        },
      },
      buildPayload: async () => ({ content: data }),
      renderLocalMjml: () => toMjmlForInstance(source),
    });

    expect(await methods.toHtml()).toContain(`<img src="${GIF}">`);
  });

  it("lets a host render.toMjml override the countdown provider", async () => {
    const data = content();
    const imageUrl = vi.fn(() => GIF);
    const methods = createRenderMethods({
      provider: {
        toMjml: async () => "<mjml><mj-body>host output</mj-body></mjml>",
      },
      buildPayload: async () => ({ content: data }),
      renderLocalMjml: () =>
        toMjmlForInstance({
          getContent: () => data,
          renderCustomBlock: async () => "",
          countdown: { imageUrl },
        }),
    });

    expect(await methods.toMjml()).toBe(
      "<mjml><mj-body>host output</mj-body></mjml>",
    );
    expect(imageUrl).not.toHaveBeenCalled();
  });
});
