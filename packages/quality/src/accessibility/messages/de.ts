import type en from "./en";

const de: typeof en = {
  "a11y.img-missing-alt":
    "Bild ohne Alt-Text. Füge eine kurze Beschreibung hinzu oder markiere das Bild als dekorativ.",
  "a11y.img-alt-is-filename":
    'Alt-Text sieht wie ein Dateiname aus ("{alt}"). Beschreibe stattdessen kurz, was das Bild zeigt.',
  "a11y.img-alt-too-long":
    "Alt-Text ist {length} Zeichen lang; bleibe unter {max}.",
  "a11y.img-decorative-needs-empty-alt":
    "Dekoratives Bild hat Alt-Text. Entferne den Alt-Text oder hebe die Markierung als dekorativ auf.",
  "a11y.img-linked-no-context":
    "Verlinktes Bild beschreibt nur das Motiv, nicht das Linkziel. Nenne das Ziel (z. B. „Frühlingssale ansehen“).",
  "a11y.heading-empty":
    "Überschrift ist leer. Füge Text hinzu oder entferne den Block.",
  "a11y.heading-skip-level":
    "Überschrift springt von H{from} auf H{to}. Eine Ebene pro Schritt.",
  "a11y.heading-multiple-h1":
    "E-Mail enthält mehr als eine H1. Verwende H1 nur einmal für die Hauptüberschrift.",
  "a11y.link-empty":
    "Ein Link in diesem Block hat keinen Text und kein beschriebenes Bild.",
  "a11y.link-vague-text":
    "Link-Text „{text}“ ist unspezifisch. Beschreibe stattdessen das Ziel.",
  "a11y.link-href-empty":
    "Ein Link in diesem Block hat ein leeres oder „#“-href.",
  "a11y.link-target-blank-no-rel":
    'Link öffnet in neuem Tab, aber rel="noopener" fehlt – ergänze es, damit das Ziel nicht auf window.opener zugreifen kann.',
  "a11y.link-nested-anchor":
    "Ein Link liegt innerhalb eines anderen Links. Verschachtelte Anker sind ungültiges HTML und werden von E-Mail-Clients unterschiedlich gerendert – flache einen einzigen Anker daraus.",
  "a11y.text-all-caps":
    "Längere Texte in Großbuchstaben sind schwerer lesbar. Verwende Groß- und Kleinschreibung.",
  "a11y.text-low-contrast":
    "Überschriftskontrast beträgt {ratio}:1; WCAG AA verlangt mindestens {required}:1.",
  "a11y.text-too-small": "Text ist {size}px; mindestens {min}px verwenden.",
  "a11y.button-vague-label":
    "Button-Beschriftung „{text}“ ist unspezifisch. Beschreibe die Aktion.",
  "a11y.button-touch-target":
    "Button ist etwa {height}px hoch; mindestens {min}px verwenden, um Fehltipper auf Mobilgeräten zu vermeiden.",
  "a11y.button-low-contrast":
    "Buttontextkontrast beträgt {ratio}:1; WCAG AA verlangt mindestens {required}:1.",
  "a11y.missing-preheader":
    "Kein Preheader-Text gesetzt. Postfächer zeigen sonst Bruchstücke des ersten Blocks an.",
};

export default de;
