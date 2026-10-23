import type en from "./en";

const de: typeof en = {
  "a11y.img-missing-alt": {
    message: "Bild ohne Alt-Text.",
    suggestion:
      "Füge eine kurze Beschreibung hinzu oder markiere das Bild als dekorativ.",
  },
  "a11y.img-alt-is-filename": {
    message: 'Alt-Text sieht wie ein Dateiname aus ("{alt}").',
    suggestion: "Beschreibe stattdessen kurz, was das Bild zeigt.",
  },
  "a11y.img-alt-too-long": {
    message: "Alt-Text ist {length} Zeichen lang.",
    suggestion: "Halte den Alt-Text unter {max} Zeichen.",
  },
  "a11y.img-decorative-needs-empty-alt": {
    message: "Dekoratives Bild hat Alt-Text.",
    suggestion:
      "Entferne den Alt-Text oder hebe die Markierung als dekorativ auf.",
  },
  "a11y.img-linked-no-context": {
    message: "Verlinktes Bild beschreibt nur das Motiv, nicht das Linkziel.",
    suggestion: "Nenne das Ziel (z. B. „Frühlingssale ansehen“).",
  },
  "a11y.heading-empty": {
    message: "Überschrift ist leer.",
    suggestion: "Füge Text hinzu oder entferne den Block.",
  },
  "a11y.heading-skip-level": {
    message: "Überschrift springt von H{from} auf H{to}.",
    suggestion: "Gehe jeweils nur eine Ebene weiter.",
  },
  "a11y.heading-multiple-h1": {
    message: "E-Mail enthält mehr als eine H1.",
    suggestion: "Verwende H1 nur einmal für die Hauptüberschrift.",
  },
  "a11y.link-empty": {
    message:
      "Ein Link in diesem Block hat keinen Text und kein beschriebenes Bild.",
    suggestion: "Ergänze Link-Text oder beschreibe das verlinkte Bild.",
  },
  "a11y.link-vague-text": {
    message: "Link-Text „{text}“ ist unspezifisch.",
    suggestion: "Beschreibe stattdessen das Ziel.",
  },
  "a11y.link-href-empty": {
    message: "Ein Link in diesem Block hat ein leeres oder „#“-href.",
    suggestion: "Ergänze eine Ziel-URL oder entferne den Link.",
  },
  "a11y.link-target-blank-no-rel": {
    message: 'Link öffnet in neuem Tab, aber rel="noopener" fehlt.',
    suggestion:
      'Ergänze rel="noopener", damit das Ziel nicht auf window.opener zugreifen kann.',
  },
  "a11y.link-nested-anchor": {
    message:
      "Ein Link liegt innerhalb eines anderen Links. Verschachtelte Anker sind ungültiges HTML und werden von E-Mail-Clients unterschiedlich gerendert.",
    suggestion: "Fasse sie zu einem einzigen Anker zusammen.",
  },
  "a11y.text-all-caps": {
    message: "Längere Texte in Großbuchstaben sind schwerer lesbar.",
    suggestion: "Verwende Groß- und Kleinschreibung.",
  },
  "a11y.text-justified": {
    message:
      "Blocksatz dehnt die Wortabstände zu ungleichmäßigen „Flüssen“ aus Leerraum, die für Menschen mit Legasthenie und Sehbeeinträchtigung am schwersten zu verfolgen sind.",
    suggestion: "Verwende linksbündigen Text.",
  },
  "a11y.text-low-contrast": {
    message: "Überschriftskontrast beträgt {ratio}:1.",
    suggestion: "Erhöhe den Kontrast für WCAG AA auf mindestens {required}:1.",
  },
  "a11y.text-too-small": {
    message: "Text ist {size}px groß.",
    suggestion: "Erhöhe die Größe auf mindestens {min}px.",
  },
  "a11y.button-vague-label": {
    message: "Button-Beschriftung „{text}“ ist unspezifisch.",
    suggestion: "Beschreibe die Aktion.",
  },
  "a11y.button-touch-target": {
    message: "Button ist etwa {height}px hoch.",
    suggestion:
      "Erhöhe ihn auf mindestens {min}px, um Fehltipper auf Mobilgeräten zu vermeiden.",
  },
  "a11y.button-low-contrast": {
    message: "Buttontextkontrast beträgt {ratio}:1.",
    suggestion: "Erhöhe den Kontrast für WCAG AA auf mindestens {required}:1.",
  },
  "a11y.missing-preheader": {
    message:
      "Kein Preheader-Text gesetzt, daher zeigen Postfächer Bruchstücke des ersten Blocks.",
    suggestion: "Ergänze einen Preheader-Text als Vorschau auf die E-Mail.",
  },
};

export default de;
