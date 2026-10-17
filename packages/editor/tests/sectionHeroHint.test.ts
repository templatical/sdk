// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { useEditor } from "@templatical/core";
import {
  createBackgroundImage,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  type SectionBlock,
} from "@templatical/types";
import en from "../src/i18n/locales/en";
import { EDITOR_KEY, TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";
import SectionBlockComponent from "../src/components/blocks/SectionBlock.vue";

function mountSection(block: SectionBlock) {
  const content = createDefaultTemplateContent();
  content.blocks = [block];
  const editor = useEditor({ content });
  const wrapper = mountEditor(SectionBlockComponent, {
    props: { block, viewport: "desktop" },
    provides: { [EDITOR_KEY]: editor, [TRANSLATIONS_KEY]: en },
  });
  return { wrapper, editor };
}

const HERO = { height: "image", verticalAlign: "middle" } as const;

describe("SectionBlock hero image hint", () => {
  it("prompts for an image on a hero that has none", () => {
    const { wrapper } = mountSection(
      createSectionBlock({
        children: [[createParagraphBlock()]],
        hero: { ...HERO },
      }),
    );
    expect(wrapper.get('[data-testid="hero-image-hint"]').text()).toBe(
      en.section.heroAddImage,
    );
  });

  it("hides the prompt in preview", async () => {
    const { wrapper, editor } = mountSection(
      createSectionBlock({ hero: { ...HERO } }),
    );
    editor.setPreviewMode(true);
    await nextTick();
    expect(wrapper.find('[data-testid="hero-image-hint"]').exists()).toBe(false);
  });

  it("has no prompt once the hero has an image, or for a regular section", () => {
    const withImage = mountSection(
      createSectionBlock({
        hero: { ...HERO },
        backgroundImage: createBackgroundImage("https://cdn.test/hero.jpg"),
      }),
    );
    expect(
      withImage.wrapper.find('[data-testid="hero-image-hint"]').exists(),
    ).toBe(false);
    const regular = mountSection(createSectionBlock());
    expect(
      regular.wrapper.find('[data-testid="hero-image-hint"]').exists(),
    ).toBe(false);
  });
});
