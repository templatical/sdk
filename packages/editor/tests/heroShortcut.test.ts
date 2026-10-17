import { describe, expect, it } from "vitest";
import type {
  ButtonBlock,
  ParagraphBlock,
  TitleBlock,
} from "@templatical/types";
import { createHeroSection } from "../src/utils/heroShortcut";
import { localizedBlockDefaults } from "../src/utils/localizedBlockDefaults";
import de from "../src/i18n/locales/de";

describe("createHeroSection", () => {
  it("is a one-column hero on a dark fill, with no image", () => {
    const section = createHeroSection(undefined, "Enter your text here");
    expect(section).toMatchObject({
      type: "section",
      columns: "1",
      hero: { height: "image", verticalAlign: "middle" },
      styles: {
        padding: { top: 48, right: 24, bottom: 48, left: 24 },
        backgroundColor: "#1f2937",
      },
    });
    expect(section.backgroundImage).toBeUndefined();
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((block) => block.type)).toEqual([
      "title",
      "paragraph",
      "button",
    ]);
  });

  it("turns the starter text white and centred", () => {
    const [title, paragraph, button] = createHeroSection(
      undefined,
      "Enter your text here",
    ).children[0] as [TitleBlock, ParagraphBlock, ButtonBlock];
    expect(title).toMatchObject({ color: "#ffffff", textAlign: "center" });
    expect(paragraph.content).toBe(
      '<p style="text-align: center"><span style="color: #ffffff">Enter your text here</span></p>',
    );
    expect(button.align).toBe("center");
  });

  it("keeps the localized prompts and the host's styling", () => {
    const localized = localizedBlockDefaults(de);
    const [title, paragraph, button] = createHeroSection(
      {
        ...localized,
        button: { ...localized.button, backgroundColor: "#ff6600", borderRadius: 20 },
      },
      de.blockDefaults.paragraph,
    ).children[0] as [TitleBlock, ParagraphBlock, ButtonBlock];
    expect(title.content).toBe(`<p>${de.blockDefaults.title}</p>`);
    expect(paragraph.content).toContain(`>${de.blockDefaults.paragraph}<`);
    expect(button).toMatchObject({
      text: de.blockDefaults.button,
      backgroundColor: "#ff6600",
      borderRadius: 20,
      align: "center",
    });
  });

  it("escapes markup in the paragraph prompt", () => {
    const paragraph = createHeroSection(undefined, "a < b & c").children[0][1] as ParagraphBlock;
    expect(paragraph.content).toContain(">a &lt; b &amp; c<");
  });

  it("gives every block its own id", () => {
    const section = createHeroSection(undefined, "x");
    const ids = [section.id, ...section.children[0].map((block) => block.id)];
    expect(new Set(ids).size).toBe(4);
  });
});
