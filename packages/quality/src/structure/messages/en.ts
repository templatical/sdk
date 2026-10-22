const en = {
  "structure.duplicate-block-id": {
    message: "Block id appears {count} times in the tree.",
    suggestion: "Give each block a unique id.",
  },
  "structure.section-column-mismatch": {
    message:
      'Section uses layout "{layout}" (expects {expected} columns) but has {actual}.',
    suggestion:
      "Restore {expected} columns or choose a matching layout to repair the corrupted state.",
  },
  "structure.nested-section": {
    message:
      "Section is nested inside another section. Sections cannot nest; the renderer will misbehave.",
    suggestion: "Move the inner section outside its parent.",
  },
  "structure.empty-section": {
    message: "Section has no blocks.",
    suggestion: "Remove it or add content.",
  },
  "structure.empty-column": {
    message: "Column {columnIndex} of this section is empty.",
    suggestion: "Add content or reduce the column count.",
  },
  "structure.wrapper-color-over-background-image": {
    message:
      "Outlook on Windows paints the wrapper's background color over this section's background image.",
    suggestion: "Remove the wrapper color or put the image on the wrapper.",
  },
  "structure.nested-background-image": {
    message:
      "This section and its wrapper both have a background image. Outlook on Windows can't layer them and breaks the layout.",
    suggestion: "Keep the image on one of them.",
  },
  "structure.hero-not-applied.columns": {
    message:
      "Hero mode needs a one-column section, so this section renders as a regular one.",
    suggestion: "Switch it back to one column, or turn hero mode off.",
  },
  "structure.hero-not-applied.image": {
    message:
      "Hero mode needs a background image, so this section renders as a regular one until it has one.",
    suggestion: "Add a background image or turn hero mode off.",
  },
  "structure.hero-not-applied.size": {
    message:
      "Hero mode can't match this background image's shape because its size is unknown (a merge-tag URL, or an image the editor didn't measure), so the section renders as a regular one.",
    suggestion: "Give it a fixed height, or set the image file's size.",
  },
};

export default en;
