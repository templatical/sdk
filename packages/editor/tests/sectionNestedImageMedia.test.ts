// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { useEditor } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createImageBlock,
  createSectionBlock,
} from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import {
  EDITOR_KEY,
  ON_REQUEST_MEDIA_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import { mountEditor } from "./helpers/mount";
import SectionBlock from "../src/components/blocks/SectionBlock.vue";

/**
 * Regression: #219 — "Media Picker for images within sections".
 *
 * The inline "Browse media" button on an ImageBlock signals its pick by
 * emitting an `update` event; it has no editor handle of its own. Canvas.vue
 * (top-level blocks) forwards that event to `editor.updateBlock`, but
 * SectionBlock.vue rendered its nested child `<component>` with only a
 * `@fetch-data` listener — so an image *inside a section* emitted `update`
 * into the void and the picked media never landed. The content-sidebar path
 * worked because it updates the selected block by id, independent of nesting.
 */
describe("section-nested image media picker (regression: #219)", () => {
  it("inserts the picked media into an image nested inside a section", async () => {
    const image = createImageBlock({ src: "" });
    const section = createSectionBlock({ columns: "1", children: [[image]] });

    const content = createDefaultTemplateContent();
    content.blocks = [section];
    const editor = useEditor({ content });

    const onRequestMedia = vi.fn().mockResolvedValue({
      url: "https://cdn.example.com/picked.png",
      alt: "Picked alt",
    });

    const wrapper = mountEditor(SectionBlock, {
      props: { block: section, viewport: "desktop" },
      provides: {
        [EDITOR_KEY]: editor,
        [ON_REQUEST_MEDIA_KEY]: onRequestMedia,
        [TRANSLATIONS_KEY]: enTranslations,
      },
    });

    // The empty nested image renders its "Browse media" button.
    const browseButton = wrapper
      .findAll("button")
      .find((b) => b.text().includes(enTranslations.image.browseMedia));
    expect(browseButton).toBeTruthy();
    expect(image.src).toBe("");

    await browseButton!.trigger("click");
    await flushPromises();

    expect(onRequestMedia).toHaveBeenCalledWith({ accept: ["images"] });
    // The picked media must land on the nested image. Asserting on the raw
    // block reference (not the DOM) proves the update propagated through
    // SectionBlock's `@update` handler into `editor.updateBlock`.
    expect(image.src).toBe("https://cdn.example.com/picked.png");
    expect(image.alt).toBe("Picked alt");
    expect(editor.state.isDirty).toBe(true);
  });
});
