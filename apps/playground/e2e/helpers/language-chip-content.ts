import {
  createMenuBlock,
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

/** One block with a stale German item and a German item whose merge tags differ. */
export function staleAndTagsDifferContent(
  content: TemplateContent,
): TemplateContent {
  const item = (id: string, text: string) => ({
    id,
    text,
    url: "https://example.com/offers",
    openInNewTab: false,
    bold: false,
    underline: false,
  });
  return {
    ...content,
    blocks: [
      createMenuBlock({
        id: "mixed-menu",
        items: [
          item("stale", "Updated offers"),
          item("tags", "Hello {{first_name}}"),
        ],
        l10n: {
          de: {
            text: {
              "items.stale.text": { value: "Angebote", sourceHash: "00000000" },
              "items.tags.text": {
                value: "Hallo",
                sourceHash: sourceHash("Hello {{first_name}}"),
              },
            },
          },
        },
      }),
    ],
  };
}
