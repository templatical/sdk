# Regelkatalog

Die 19 Regeln, die `@templatical/quality` mitliefert, gruppiert nach Prüfbereich. Jede Regel liegt in `packages/quality/src/accessibility/rules/`; Schweregrad, Meldungstexte und Wörterbücher sind pro Regel über die [Optionen](./options) anpassbar.

## Bilder

| Regel | Standard-Schweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `img-missing-alt` | error | – | Fehlender Alt-Text – Screenreader sagen einen undefinierten oder leeren Alt-Text als Dateinamen an oder überspringen das Bild ganz. E-Mail-Clients blockieren Bilder zudem standardmäßig; Alt-Text ist das, was 30–50 % der Empfänger zuerst sehen. [1](https://www.w3.org/WAI/tutorials/images/) |
| `img-alt-is-filename` | warning | ja | Alt-Text sieht aus wie ein Dateiname – Dateinamen wie 'IMG_1234.jpg' oder 'Screen Shot 2026.png' tragen keine Bedeutung. Ersetzen Sie ihn durch eine kurze Beschreibung des Bildinhalts. |
| `img-alt-too-long` | warning | – | Alt-Text ist zu lang – Screenreader pausieren innerhalb des Alt-Textes nicht. Lange Alt-Strings werden zu einer Sprechwand. Bleiben Sie unter ~125 Zeichen; zusätzlichen Kontext in den umgebenden Text legen. |
| `img-decorative-needs-empty-alt` | info | ja | Dekoratives Bild hat Alt-Text – Dekorative Bilder sollten von Screenreadern übersprungen werden. `alt=''` (leer) signalisiert diese Absicht. Nicht-leerer Alt-Text auf einem dekorativen Bild ist ein Widerspruch. |
| `img-linked-no-context` | warning | – | Verlinktes Bild ohne Zielkontext – Wenn ein Bild zugleich Link ist, dient der Alt-Text als Linktext. Beschreibt er nur das Bild, raten die Nutzer, wohin der Link führt. |

## Überschriften

| Regel | Standard-Schweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `heading-empty` | error | – | Überschrift ohne Text – Leere Überschriften erzeugen stille Landmarken für Screenreader-Nutzer, die per Überschrift navigieren. Entweder Text ergänzen oder den Block entfernen. |
| `heading-skip-level` | error | – | Überschriftenebene übersprungen – Überspringen von Ebenen (z. B. H1 → H3) zerstört das Dokumentgerüst, auf das assistive Technologien zur Navigation angewiesen sind. Immer nur eine Ebene weiter. |
| `heading-multiple-h1` | warning | – | Mehrere H1-Überschriften – Eine E-Mail sollte eine einzige H1 haben, die die Nachricht benennt. Mehrere H1 verwirren das Dokumentgerüst und schwächen die Landmark-Navigation. |

## Links

| Regel | Standard-Schweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `link-empty` | error | – | Link ohne zugänglichen Text – Ein Link ohne sichtbaren Text und ohne verschachteltes Bild mit Alt-Text ist für Screenreader unsichtbar und für viele Nutzer nicht klickbar. |
| `link-vague-text` | warning | – | Vager Linktext – Phrasen wie "hier klicken" oder "mehr lesen" sagen Screenreader-Nutzern nichts, wenn sie aus dem Kontext gelistet werden. Verwenden Sie beschreibenden Linktext, der das Ziel benennt. Äußere Satzzeichen und dekorative Symbole werden vor dem Abgleich entfernt; `Hier klicken!`, `→ hier klicken` und `»hier klicken«` werden also alle erkannt. |
| `link-href-empty` | error | – | Link mit leerem href – Ein Anker ohne Ziel (leeres href oder '#') ist defekt – Empfänger klicken und nichts passiert, oder die Seite springt nach oben. |
| `link-target-blank-no-rel` | warning | ja | `target="_blank"` ohne `rel="noopener"` – Links, die in einem neuen Tab öffnen und kein `rel='noopener'`/`rel='noreferrer'` setzen, lassen das Ziel über `window.opener` die Ursprungsseite manipulieren. Eine kleine, aber reale Sicherheits-/Privatsphäre-Falle. |

## Text

| Regel | Standard-Schweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `text-all-caps` | warning | – | Großbuchstaben im Fließtext – Längere Großbuchstaben-Passagen werden von manchen Screenreadern Buchstabe für Buchstabe gelesen und verlangsamen das visuelle Lesen um 10–20 %. Verwenden Sie Groß-/Kleinschreibung im Fließtext; Großbuchstaben nur für kurze Labels. |
| `text-low-contrast` | error | – | Überschriftenkontrast zu niedrig – WCAG AA verlangt 4,5:1 für Fließtext und 3:1 für großen Text (18pt / ~24px). Überschriften ≥24px (H1, H2) bekommen den entspannten 3:1-Schwellwert; H3 (22px) und H4 (18px) erfordern 4,5:1. Die Lockerung für Fettschrift wird nicht angewendet – TipTap legt Fett inline im HTML ab, nicht als strukturiertes Feld. Darunter wird der Text für sehbehinderte Nutzer und bei hellem Außenlicht unleserlich. Es werden nur Title-Blöcke geprüft; die Farbe von Absätzen liegt im Inline-HTML. [1](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) |
| `text-too-small` | warning | – | Text zu klein – Fließtext unter 14px wird auf Mobilgeräten schwer lesbar. Manche Clients zoomen oder skalieren kleine Schriften zudem unvorhersehbar. Bleiben Sie bei 14px oder größer. |

## Buttons

| Regel | Standard-Schweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `button-vague-label` | warning | – | Vages Button-Label – Ein Button mit "Hier klicken" oder "Senden" sagt nichts darüber, was passieren wird. Verwenden Sie handlungsorientierte Labels, die den Ausgang benennen ("Ticket kaufen", "Passwort zurücksetzen"). Gleiche Behandlung äußerer Satzzeichen wie bei `link-vague-text` – `Senden!`, `→ OK` und `»klick«` werden alle erkannt. |
| `button-touch-target` | warning | – | Touch-Ziel des Buttons zu klein – WCAG 2.5.5 (AAA) und die UX-Richtlinien von Apple/Google empfehlen mindestens 44×44px. Kleinere Buttons führen mobil zu Fehl-Taps. |
| `button-low-contrast` | error | – | Button-Textkontrast zu niedrig – Gleiche WCAG-AA-Schwellen wie bei `text-low-contrast`: 4,5:1 normal, 3:1 bei Buttons mit `fontSize >= 24` (WCAG-Großtext). Standard-Buttons (15px) verlangen den strikten Wert. Buttons, die das nicht erfüllen, sind für sehbehinderte Nutzer und bei hellem Außenlicht unleserlich. [1](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) |

## Struktur

| Regel | Standard-Schweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `missing-preheader` | info | – | Fehlender Preheader-Text – Der Preheader ist der Vorschau-Snippet, der in den meisten Postfächern neben der Betreffzeile erscheint. Ohne ihn sehen Empfänger ein Fragment der ersten Überschrift oder ein verirrtes Alt-Tag – eine vertane Chance, Kontext zu setzen. |

