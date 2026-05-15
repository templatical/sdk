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
};

export default de;
