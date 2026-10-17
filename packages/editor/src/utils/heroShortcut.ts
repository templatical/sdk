import {
  createBlock,
  createSectionBlock,
  type BlockDefaults,
  type ButtonBlock,
  type ParagraphBlock,
  type SectionBlock,
  type TitleBlock,
} from "@templatical/types";

/** The Hero palette entry's id: a shortcut to a hero-mode section, not a block type. */
export const HERO_PALETTE_TYPE = "hero";

/** The fill the starter hero shows until it has an image, and with images off. */
const HERO_FALLBACK_COLOR = "#1f2937";
const HERO_TEXT_COLOR = "#ffffff";

/**
 * What the Hero palette shortcut inserts: a one-column section in hero mode,
 * matching its image's shape with the content centred, holding a title, a
 * paragraph and a button on a dark fill. There is no image, since a
 * placeholder could ship in a real send.
 *
 * The children start as the palette would insert them (`defaults` carries the
 * localized prompts and the host's `blockDefaults`), then turn white and
 * centred to read on the fill. A paragraph's colour and alignment live in its
 * markup, so its prompt, the plain localized `paragraphPrompt`, is re-wrapped
 * rather than restyled.
 */
export function createHeroSection(
  defaults: BlockDefaults | undefined,
  paragraphPrompt: string,
): SectionBlock {
  const title = createBlock("title", defaults) as TitleBlock;
  title.color = HERO_TEXT_COLOR;
  title.textAlign = "center";

  const paragraph = createBlock("paragraph", defaults) as ParagraphBlock;
  paragraph.content = `<p style="text-align: center"><span style="color: ${HERO_TEXT_COLOR}">${escapeText(paragraphPrompt)}</span></p>`;

  const button = createBlock("button", defaults) as ButtonBlock;
  button.align = "center";

  return createSectionBlock({
    columns: "1",
    children: [[title, paragraph, button]],
    hero: { height: "image", verticalAlign: "middle" },
    styles: {
      padding: { top: 48, right: 24, bottom: 48, left: 24 },
      backgroundColor: HERO_FALLBACK_COLOR,
    },
  });
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
