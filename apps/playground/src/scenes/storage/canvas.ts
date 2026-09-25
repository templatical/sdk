import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createTitleBlock,
} from "@templatical/types";
import type { TemplateContent } from "@templatical/types";

/**
 * A short product update: enough blocks to exercise save, pick-session, and
 * preview. The block structure (title, paragraph, title, one-column section)
 * is load-bearing for the saved-blocks e2e; the copy is not.
 */
export function storageCanvas(): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = [
    createTitleBlock({
      content: "<p>Your March product update</p>",
      level: 2,
    }),
    createParagraphBlock({
      content:
        "<p>Three releases landed this month. Here is what changed and what it means for your team.</p>",
    }),
    createTitleBlock({
      content: "<p>Faster exports</p>",
      level: 3,
    }),
    createSectionBlock({
      columns: "1",
      children: [
        [
          createParagraphBlock({
            content:
              "<p>Exports now render in the background, so large templates no longer block the editor.</p>",
          }),
        ],
      ],
    }),
  ];
  return content;
}
