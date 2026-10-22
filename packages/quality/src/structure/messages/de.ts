import type en from "./en";

const de: typeof en = {
  "structure.duplicate-block-id": {
    message: "Block-ID erscheint {count}-mal im Baum.",
    suggestion: "Gib jedem Block eine eindeutige ID.",
  },
  "structure.section-column-mismatch": {
    message:
      'Sektion verwendet Layout „{layout}" (erwartet {expected} Spalten), hat aber {actual}.',
    suggestion:
      "Stelle {expected} Spalten wieder her oder wähle ein passendes Layout, um den beschädigten Zustand zu beheben.",
  },
  "structure.nested-section": {
    message:
      "Sektion ist in einer anderen Sektion verschachtelt. Sektionen können nicht verschachtelt werden; der Renderer wird sich falsch verhalten.",
    suggestion:
      "Verschiebe die innere Sektion aus ihrer übergeordneten Sektion.",
  },
  "structure.empty-section": {
    message: "Sektion enthält keine Blöcke.",
    suggestion: "Entferne sie oder füge Inhalt hinzu.",
  },
  "structure.empty-column": {
    message: "Spalte {columnIndex} dieser Sektion ist leer.",
    suggestion: "Füge Inhalt hinzu oder reduziere die Spaltenanzahl.",
  },
  "structure.wrapper-color-over-background-image": {
    message:
      "Outlook unter Windows malt die Hintergrundfarbe des Wrappers über das Hintergrundbild dieser Sektion.",
    suggestion:
      "Entferne die Wrapper-Farbe oder lege das Bild auf den Wrapper.",
  },
  "structure.nested-background-image": {
    message:
      "Diese Sektion und ihr Wrapper haben beide ein Hintergrundbild. Outlook unter Windows kann sie nicht übereinanderlegen und zerstört das Layout.",
    suggestion: "Behalte das Bild nur auf einem von beiden.",
  },
  "structure.hero-not-applied.columns": {
    message:
      "Der Hero-Modus braucht eine einspaltige Sektion, deshalb wird diese Sektion als normale Sektion dargestellt.",
    suggestion:
      "Stelle wieder eine Spalte ein oder schalte den Hero-Modus aus.",
  },
  "structure.hero-not-applied.image": {
    message:
      "Der Hero-Modus braucht ein Hintergrundbild, deshalb wird diese Sektion bis dahin als normale Sektion dargestellt.",
    suggestion: "Ergänze ein Hintergrundbild oder schalte den Hero-Modus aus.",
  },
  "structure.hero-not-applied.size": {
    message:
      "Der Hero-Modus kann die Form dieses Hintergrundbilds nicht übernehmen, weil seine Größe unbekannt ist (eine Merge-Tag-URL oder ein Bild, das der Editor nicht vermessen hat), deshalb wird die Sektion als normale Sektion dargestellt.",
    suggestion:
      "Gib ihr eine feste Höhe oder trage die Größe der Bilddatei ein.",
  },
};

export default de;
