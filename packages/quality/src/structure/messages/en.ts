/**
 * English structure-rule messages. The source of truth — other locales
 * annotate themselves `typeof en` so missing or extra keys fail typecheck.
 *
 * Templates use `{name}` placeholders, interpolated by `formatMessage`.
 */
const en = {
  "structure.duplicate-block-id":
    "Block id appears {count} times in the tree. Each block must have a unique id.",
  "structure.section-column-mismatch":
    'Section uses layout "{layout}" (expects {expected} columns) but has {actual}. Indicates corrupted state.',
  "structure.nested-section":
    "Section is nested inside another section. Sections cannot nest — the renderer will misbehave.",
  "structure.empty-section": "Section has no blocks. Remove it or add content.",
  "structure.empty-column":
    "Column {columnIndex} of this section is empty. Add content or reduce the column count.",
  "structure.wrapper-color-over-background-image":
    "Outlook on Windows paints the wrapper's background color over this section's background image. Remove the wrapper color or put the image on the wrapper.",
  "structure.nested-background-image":
    "This section and its wrapper both have a background image. Outlook on Windows can't layer them and breaks the layout. Keep the image on one of them.",
};

export default en;
