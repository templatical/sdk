import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createTitleBlock,
} from "@templatical/types";
import type { TemplateContent } from "@templatical/types";

/** Quiet canvas with enough blocks to exercise save, pick-session, and preview. */
export function storageCanvas(): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = [
    createTitleBlock({
      content: "<p>Storage heading</p>",
      level: 2,
    }),
    createParagraphBlock({
      content: "<p>Storage paragraph for edits and preview.</p>",
    }),
    createTitleBlock({
      content: "<p>Second heading</p>",
      level: 3,
    }),
    createSectionBlock({
      columns: "1",
      children: [
        [
          createParagraphBlock({
            content: "<p>Nested in a section</p>",
          }),
        ],
      ],
    }),
  ];
  return content;
}
