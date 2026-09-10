// @vitest-environment happy-dom
//
// `config.media` has to be constructed in `Editor.vue` and the synthesized
// function passed into `useEditorCore` — a unit test that injects
// `ON_REQUEST_MEDIA_KEY` is not evidence the option is wired. These cases
// mount the real `Editor.vue` with a real `config`. Negative-checked by
// commenting out the `useMediaFeature` construction, which hides Browse.
import "./dom-stubs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import {
  createDefaultTemplateContent,
  createImageBlock,
  type MediaProvider,
} from "@templatical/types";
import Editor from "../src/Editor.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";

function readOnlyMedia(): MediaProvider {
  return {
    list: vi.fn().mockResolvedValue({ items: [] }),
    create: false,
    update: false,
    delete: false,
    folders: false,
    replace: false,
    importFromUrl: false,
    checkUsage: false,
    frequentlyUsed: false,
    storage: false,
  };
}

async function mountEditor(config: Record<string, unknown> = {}) {
  const translations = await loadTranslations("en");
  const content = createDefaultTemplateContent();
  content.blocks = [createImageBlock({ src: "" })];
  return mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content,
        ...config,
      },
      translations,
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
}

describe("config.media reaches Browse through Editor.vue", () => {
  it("renders Browse on an image block when a media provider is configured", async () => {
    const translations = await loadTranslations("en");
    const wrapper = await mountEditor({ media: readOnlyMedia() });

    const browse = wrapper
      .findAll("button")
      .find((b) => b.text().includes(translations.image.browseMedia));
    expect(browse).toBeTruthy();
    expect(browse!.text()).toContain(translations.image.browseMedia);
  });

  it("renders Browse when only onRequestMedia is configured", async () => {
    const translations = await loadTranslations("en");
    const wrapper = await mountEditor({
      onRequestMedia: vi.fn().mockResolvedValue(null),
    });

    const browse = wrapper
      .findAll("button")
      .find((b) => b.text().includes(translations.image.browseMedia));
    expect(browse).toBeTruthy();
    expect(browse!.text()).toContain(translations.image.browseMedia);
  });

  it("does not render Browse when neither media nor onRequestMedia is set", async () => {
    const translations = await loadTranslations("en");
    const wrapper = await mountEditor();

    const browse = wrapper
      .findAll("button")
      .find((b) => b.text().includes(translations.image.browseMedia));
    expect(browse).toBeUndefined();
  });

  it("does not enable drop on a read-only provider", async () => {
    const wrapper = await mountEditor({ media: readOnlyMedia() });
    const zone = wrapper.find('[data-testid="image-drop-zone"]');
    expect(zone.exists()).toBe(true);
    expect(zone.attributes("data-drop-enabled")).toBe("false");
  });

  it("enables drop when the provider can create", async () => {
    const wrapper = await mountEditor({
      media: {
        ...readOnlyMedia(),
        create: vi.fn().mockResolvedValue({
          id: "a1",
          url: "https://cdn.example.com/hero.png",
        }),
      },
    });
    expect(
      wrapper
        .find('[data-testid="image-drop-zone"]')
        .attributes("data-drop-enabled"),
    ).toBe("true");
  });

  it("enables drop when only onRequestMedia is configured", async () => {
    const wrapper = await mountEditor({
      onRequestMedia: vi.fn().mockResolvedValue(null),
    });
    expect(
      wrapper
        .find('[data-testid="image-drop-zone"]')
        .attributes("data-drop-enabled"),
    ).toBe("true");
  });
});

describe("MediaPanels stays lazy", () => {
  const editor = readFileSync(
    join(import.meta.dirname, "../src/Editor.vue"),
    "utf8",
  );
  const panels = readFileSync(
    join(import.meta.dirname, "../src/components/MediaPanels.vue"),
    "utf8",
  );

  it("Editor.vue lazy-loads MediaPanels and never static-imports the modal", () => {
    expect(editor).toMatch(
      /defineAsyncComponent\(\s*\(\) => import\("\.\/components\/MediaPanels\.vue"\)/,
    );
    expect(editor).not.toContain("MediaLibraryModal");
    expect(editor).not.toContain("@templatical/media-library");
  });

  it("MediaPanels lazy-imports MediaLibraryModal from the optional peer", () => {
    expect(panels).toContain("defineAsyncComponent");
    expect(panels).toContain('import("@templatical/media-library")');
  });

  it("MediaPanels forwards the feature's onError to the modal", () => {
    expect(panels).toMatch(/:on-error="feature\.onError"/);
  });

  it("Editor.vue's config literal forwards canDropMedia", () => {
    expect(editor).toMatch(/canDropMedia:\s*mediaFeature\?\.canDrop/);
  });
});
