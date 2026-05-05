import type en from "./en";

const de: typeof en = {
  "img-missing-alt":
    "Bild ohne Alt-Text. Füge eine kurze Beschreibung hinzu oder markiere das Bild als dekorativ.",
  "img-alt-is-filename":
    'Alt-Text sieht wie ein Dateiname aus ("{alt}"). Beschreibe stattdessen kurz, was das Bild zeigt.',
  "img-alt-too-long": "Alt-Text ist {length} Zeichen lang; bleibe unter {max}.",
  "img-decorative-needs-empty-alt":
    "Dekoratives Bild hat Alt-Text. Entferne den Alt-Text oder hebe die Markierung als dekorativ auf.",
  "img-linked-no-context":
    "Verlinktes Bild beschreibt nur das Motiv, nicht das Linkziel. Nenne das Ziel (z. B. „Frühlingssale ansehen“).",
  "heading-empty":
    "Überschrift ist leer. Füge Text hinzu oder entferne den Block.",
  "heading-skip-level":
    "Überschrift springt von H{from} auf H{to}. Eine Ebene pro Schritt.",
  "heading-multiple-h1":
    "E-Mail enthält mehr als eine H1. Verwende H1 nur einmal für die Hauptüberschrift.",
  "link-empty":
    "Ein Link in diesem Block hat keinen Text und kein beschriebenes Bild.",
  "link-vague-text":
    "Link-Text „{text}“ ist unspezifisch. Beschreibe stattdessen das Ziel.",
  "link-href-empty": "Ein Link in diesem Block hat ein leeres oder „#“-href.",
  "link-target-blank-no-rel":
    'Link öffnet in neuem Tab, aber rel="noopener" fehlt – ergänze es, damit das Ziel nicht auf window.opener zugreifen kann.',
  "text-all-caps":
    "Längere Texte in Großbuchstaben sind schwerer lesbar. Verwende Groß- und Kleinschreibung.",
  "text-low-contrast":
    "Überschriftskontrast beträgt {ratio}:1; WCAG AA verlangt mindestens {required}:1.",
  "text-too-small": "Text ist {size}px; mindestens {min}px verwenden.",
  "button-vague-label":
    "Button-Beschriftung „{text}“ ist unspezifisch. Beschreibe die Aktion.",
  "button-touch-target":
    "Button ist etwa {height}px hoch; mindestens {min}px verwenden, um Fehltipper auf Mobilgeräten zu vermeiden.",
  "button-low-contrast":
    "Buttontextkontrast beträgt {ratio}:1; WCAG AA verlangt mindestens {required}:1.",
  "missing-preheader":
    "Kein Preheader-Text gesetzt. Postfächer zeigen sonst Bruchstücke des ersten Blocks an.",
};

export default de;
