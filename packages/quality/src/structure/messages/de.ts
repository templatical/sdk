import type en from "./en";

const de: typeof en = {
  "structure.duplicate-block-id":
    "Block-ID erscheint {count}-mal im Baum. Jeder Block muss eine eindeutige ID haben.",
  "structure.section-column-mismatch":
    'Sektion verwendet Layout „{layout}" (erwartet {expected} Spalten), hat aber {actual}. Deutet auf beschädigten Zustand hin.',
  "structure.nested-section":
    "Sektion ist in einer anderen Sektion verschachtelt. Sektionen können nicht verschachtelt werden – der Renderer wird sich falsch verhalten.",
  "structure.empty-section":
    "Sektion enthält keine Blöcke. Entferne sie oder füge Inhalt hinzu.",
  "structure.empty-column":
    "Spalte {columnIndex} dieser Sektion ist leer. Füge Inhalt hinzu oder reduziere die Spaltenanzahl.",
  "structure.wrapper-color-over-background-image":
    "Outlook unter Windows malt die Hintergrundfarbe des Wrappers über das Hintergrundbild dieser Sektion. Entferne die Wrapper-Farbe oder lege das Bild auf den Wrapper.",
  "structure.nested-background-image":
    "Diese Sektion und ihr Wrapper haben beide ein Hintergrundbild. Outlook unter Windows kann sie nicht übereinanderlegen und zerstört das Layout. Behalte das Bild nur auf einem von beiden.",
};

export default de;
