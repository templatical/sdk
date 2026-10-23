import type en from "./en";

const de: typeof en = {
  templates: {
    unsupported: "{feature} funktioniert in {unsupported} nicht.",
    partial: "{feature} funktioniert in {partial} nur teilweise.",
    mixed:
      "{feature} funktioniert in {unsupported} nicht und in {partial} nur teilweise.",
  },
  more: "{n} weitere",
  features: {
    "css-display-flex": {
      feature: "Flex-Layout ({excerpt})",
      suggestion:
        "Ordne den Inhalt mit einer Sektion und Spalten oder mit einer Tabelle an.",
    },
    "css-display-grid": {
      feature: "Grid-Layout ({excerpt})",
      suggestion:
        "Ordne den Inhalt mit einer Sektion und Spalten oder mit einer Tabelle an.",
    },
    "css-position": {
      feature: "position: {value}",
      suggestion:
        "Entferne die Positionierung und ordne den Inhalt mit einer Sektion und Spalten oder mit einer Tabelle an.",
    },
    "css-variables": {
      feature: "Eine CSS-Variable (var(--…))",
      suggestion: "Schreibe den Wert direkt statt var(--…).",
    },
    "css-at-import": {
      feature: "Die @import-Regel",
      suggestion: "Schreibe die Regeln direkt in style-Attribute.",
    },
    "html-link": {
      feature: 'Ein externes Stylesheet (<link rel="stylesheet">)',
      suggestion: "Schreibe die Stile direkt in style-Attribute.",
    },
    "html-style": {
      feature: "Ein <style>-Element im E-Mail-Body",
      suggestion: "Schreibe die Regeln direkt in style-Attribute.",
    },
    "html-svg": {
      feature: "Ein eingebettetes <svg>-Element",
      suggestion: "Verwende stattdessen ein PNG- oder JPEG-Bild.",
    },
    "html-form": {
      feature: "Ein Formular (<form>, <input>, <select> oder <textarea>)",
      suggestion: "Verlinke stattdessen ein Formular auf einer Webseite.",
    },
    "html-object": {
      feature: "Das <object>-Element",
      suggestion: "Verwende stattdessen ein Bild, das auf den Inhalt verlinkt.",
    },
    "html-video": {
      feature: "Das <video>-Element",
      suggestion: "Verwende den Video-Block mit verlinktem Vorschaubild.",
    },
    "html-audio": {
      feature: "Das <audio>-Element",
      suggestion: "Verlinke die Audiodatei oder eine Seite, die sie abspielt.",
    },
    "css-width": {
      feature: "width auf einem <{tag}>-Element",
      suggestion:
        "Setze die Breite auf einer Tabellenzelle oder verwende bei Bildern das width-Attribut.",
    },
    "css-max-width": {
      feature: "max-width auf einem <{tag}>-Element",
      suggestion: "Setze max-width stattdessen auf eine Tabelle.",
    },
    "css-float": {
      feature: "Eine float-Deklaration ({excerpt}, Quelle: {tag})",
      suggestion:
        "Verwende align auf einer Tabelle oder einem Bild oder eine Sektion mit Spalten.",
    },
    "css-background-image": {
      feature: "Ein Hintergrundbild ohne Ersatzfarbe",
      suggestion:
        "Ergänze background-color (oder bgcolor), damit der Text lesbar bleibt.",
    },
    "image-base64": {
      feature: "Ein Base64-Bild ({excerpt})",
      suggestion: "Lade das Bild hoch und verwende seine URL.",
    },
  },
  hand: {
    "compat.html-script": {
      message:
        "E-Mail-Clients führen kein JavaScript aus, daher bewirkt dieses <script>-Element nichts.",
      suggestion: "Entferne das <script>-Element.",
    },
    "compat.html-iframe": {
      message:
        "Die meisten E-Mail-Clients blockieren <iframe>-Elemente, daher erscheint dieser Inhalt nicht.",
      suggestion:
        "Verlinke den Inhalt stattdessen, zum Beispiel mit einem Bild.",
    },
    "compat.gmail-clipping": {
      message:
        "Das HTML dieser E-Mail ist {size} KB groß. Gmail schneidet Nachrichten ab etwa 102 KB ab und zeigt den Rest erst nach einem Klick; Versanddienste ergänzen Tracking-Links, bevor Gmail misst.",
      suggestion:
        "Bleibe unter {max} KB: Kürze den Inhalt, verschiebe lange Abschnitte auf eine Webseite oder ersetze Base64-Bilder durch gehostete Bilder.",
    },
  },
};

export default de;
