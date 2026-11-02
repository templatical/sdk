import type en from "./en";

const de: typeof en = {
  "localization.untranslated": {
    message: "Das Feld {field} hat keine Übersetzung.",
    suggestion:
      "Übersetze {field} oder verwende die Standardsprache als Fallback.",
  },
  "localization.stale": {
    message: "Die Übersetzung von {field} ist nicht mehr aktuell.",
    suggestion:
      "Vergleiche {field} mit der Standardsprache und aktualisiere oder behalte den Wert.",
  },
  "localization.merge-tags-differ": {
    message: "Die Merge-Tags in {field} weichen von der Standardsprache ab.",
    suggestion:
      "Verwende in {field} dieselben Merge-Tags mit derselben Anzahl an Vorkommen.",
  },
};

export default de;
