import {
  createSectionBlock,
  createParagraphBlock,
  sourceHash,
  type TemplateContent,
} from "@templatical/types";

export function hiddenSectionContent(
  content: TemplateContent,
  nested: boolean,
): TemplateContent {
  const missing = { ...content.blocks[2], l10n: undefined };
  const section = createSectionBlock({
    id: "hidden-section",
    type: "section",
    columns: "1",
    children: [[missing, content.blocks[3]]],
    l10n: { de: { hidden: true } },
  });
  return {
    ...content,
    blocks: nested
      ? [
          createSectionBlock({
            id: "outer-section",
            type: "section",
            columns: "1",
            children: [[section]],
          }),
        ]
      : [section],
  };
}

export function cornerBadgeContent(content: TemplateContent): TemplateContent {
  // One line with no padding, then a block whose corner badge sits right
  // below it: the short block's action bar must not take that badge's place.
  const short = createParagraphBlock({
    id: "corner-short",
    content: "<p>Short</p>",
  });
  short.styles.padding = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    ...content,
    blocks: [
      createSectionBlock({
        id: "corner-columns",
        columns: "2",
        children: [
          [
            createParagraphBlock({
              id: "corner-first",
              content: '<p><a href="http://localhost/offer">Hello</a></p>',
            }),
          ],
          [
            createSectionBlock({
              id: "corner-nested",
              columns: "1",
              children: [
                [
                  createParagraphBlock({
                    id: "corner-second",
                    content: "Hello",
                    l10n: {
                      de: {
                        text: {
                          content: {
                            value: "Hallo",
                            sourceHash: sourceHash("Old"),
                          },
                        },
                      },
                    },
                  }),
                ],
              ],
            }),
          ],
        ],
        wrapper: { padding: { top: 12, right: 12, bottom: 12, left: 12 } },
      }),
      short,
      createParagraphBlock({ id: "corner-next", content: "<p>Next</p>" }),
    ],
  };
}
