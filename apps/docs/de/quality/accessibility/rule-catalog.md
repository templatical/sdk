# Regelkatalog Barrierefreiheit

Die 19 Regeln, die `lintAccessibility` mitliefert, gruppiert nach Prüfbereich. Jede Regel liegt in `packages/quality/src/accessibility/rules/`; Schweregrad, Meldungstexte und Wörterbücher sind pro Regel über die [Optionen](../options) anpassbar.

## Bilder

| Regel | Standardschweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `a11y.img-missing-alt` | error | — | Fehlender Alt-Text — Screenreader sagen einen undefinierten oder leeren Alt-Text als Dateinamen vor oder überspringen das Bild ganz. E-Mail-Clients blockieren Bilder zudem oft standardmäßig; Alt-Text ist das, was 30–50 % der Empfänger zuerst sehen. [1](https://www.w3.org/WAI/tutorials/images/) |
| `a11y.img-alt-is-filename` | warning | — | Alt-Text wirkt wie ein Dateiname — Dateinamen wie 'IMG_1234.jpg' oder 'Screen Shot 2026.png' tragen keine sinnvolle Information. Ersetze sie durch eine kurze Beschreibung dessen, was das Bild vermittelt. |
| `a11y.img-alt-too-long` | warning | — | Alt-Text ist zu lang — Screenreader machen innerhalb des Alt-Textes keine Pausen. Lange Texte werden zu einer Sprachwand. Bleibe unter ca. 125 Zeichen; zusätzlichen Kontext in den Fließtext auslagern. |
| `a11y.img-decorative-needs-empty-alt` | info | ja | Dekoratives Bild hat Alt-Text — Dekorative Bilder sollten von Screenreadern übersprungen werden. Ein leerer Alt-Text (alt='') signalisiert genau das. Ein nicht leerer Alt-Text auf einem dekorativen Bild widerspricht sich. |
| `a11y.img-linked-no-context` | warning | — | Verlinktes Bild ohne Zielkontext — Wenn ein Bild zugleich Link ist, fungiert der Alt-Text als Linktext. Wer nur das Bild beschreibt, lässt Nutzer im Unklaren über das Ziel. |

## Überschriften

| Regel | Standardschweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `a11y.heading-empty` | error | — | Überschrift ohne Text — Leere Überschriften erzeugen stille Landmarks für Screenreader-Nutzer, die per Überschrift navigieren. Füge Text hinzu oder entferne den Block. |
| `a11y.heading-skip-level` | error | — | Überschriften-Ebene übersprungen — Sprünge in der Ebene (z. B. H1 → H3) brechen die Dokumentgliederung, auf die Hilfstechnologien zur Navigation angewiesen sind. Eine Ebene pro Schritt. |
| `a11y.heading-multiple-h1` | warning | — | Mehrere H1-Überschriften — Eine E-Mail sollte genau eine H1 haben, die die Nachricht benennt. Mehrere H1s verwirren die Gliederung und schwächen die Landmark-Navigation. |

## Links

| Regel | Standardschweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `a11y.link-empty` | error | — | Link ohne barrierefreien Text — Ein Link ohne sichtbaren Text und ohne ein verschachteltes Bild mit Alt-Text ist für Screenreader unsichtbar und für viele Nutzer nicht klickbar. |
| `a11y.link-vague-text` | warning | — | Vager Linktext — Phrasen wie „hier klicken" oder „mehr erfahren" sagen Screenreader-Nutzern im Kontextverzeichnis nichts. Verwende beschreibenden Linktext, der das Ziel benennt. Äußere Interpunktion und dekorative Symbole werden vor dem Vergleich entfernt; `hier klicken!`, `→ hier klicken` und `»hier klicken«` lösen also alle aus. |
| `a11y.link-href-empty` | error | — | Link mit leerem href — Ein Anchor ohne Ziel (leeres href oder '#') ist defekt — Empfänger klicken, und es passiert nichts, oder die Seite springt nach oben. |
| `a11y.link-target-blank-no-rel` | warning | ja | target="_blank" ohne rel="noopener" — Links, die in einem neuen Tab öffnen und kein rel='noopener' oder rel='noreferrer' haben, lassen das Ziel auf window.opener zugreifen und an der Ursprungs­seite manipulieren. Eine kleine, aber reale Sicherheits-/Datenschutz-Falle. |

## Text

| Regel | Standardschweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `a11y.text-all-caps` | warning | — | Fließtext in Großbuchstaben — Lange Großbuchstabenstrecken werden von manchen Screenreadern Buchstabe für Buchstabe vorgelesen und verlangsamen visuelles Lesen um 10–20 %. Für Fließtext Satzschreibweise verwenden; Großbuchstaben für kurze Labels reservieren. |
| `a11y.text-low-contrast` | error | — | Überschrift hat zu wenig Kontrast — WCAG AA verlangt 4,5:1 für Fließtext und 3:1 für großen Text (18pt / ~24px). Überschriften ≥24px (H1, H2) bekommen den entspannten 3:1-Schwellwert; H3 (22px) und H4 (18px) benötigen 4,5:1. Die Bold-Text-Entspannung wird nicht angewendet — TipTap speichert Fettdruck inline im HTML, nicht als strukturiertes Feld. Unterhalb dieser Werte wird Text für sehbehinderte Nutzer und bei hellem Außenlicht unleserlich. Nur Title-Blöcke werden geprüft; Paragraph-Farben stehen im inline HTML. [1](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) |
| `a11y.text-too-small` | warning | — | Text zu klein — Fließtext unter 14px wird auf Mobilgeräten schwer lesbar. Manche Clients zoomen automatisch oder skalieren kleine Schriften unvorhersehbar. Bei 14px oder größer bleiben. |

## Buttons

| Regel | Standardschweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `a11y.button-vague-label` | warning | — | Vage Button-Beschriftung — Ein Button mit „Hier klicken" oder „Absenden" sagt dem Nutzer nichts darüber, was passieren wird. Handlungsorientierte Beschriftungen benennen das Ergebnis („Ticket kaufen", „Passwort zurücksetzen"). Gleiche Behandlung der äußeren Interpunktion wie bei `a11y.link-vague-text` — `Absenden!`, `→ OK` und `»klick«` lösen alle aus. |
| `a11y.button-touch-target` | warning | — | Button-Tippfläche zu klein — WCAG 2.5.5 (AAA) und Apple-/Google-UX-Guidelines empfehlen Tippflächen von mindestens 44×44px. Kleinere Buttons führen auf Mobilgeräten zu Fehltipps. |
| `a11y.button-low-contrast` | error | — | Buttontext-Kontrast zu niedrig — Gleiche WCAG-AA-Schwellen wie `a11y.text-low-contrast`: 4,5:1 normalerweise, 3:1 für Buttons mit `fontSize >= 24` (WCAG-Großtext). Standardgroße Buttons (15px) benötigen die strikte Ratio. Buttons, die das nicht erreichen, werden für sehbehinderte Nutzer und in hellem Außenlicht unleserlich. [1](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) |

## Template-Ebene

| Regel | Standardschweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `a11y.missing-preheader` | info | — | Fehlender Preheader-Text — Der Preheader ist der Vorschau-Schnipsel, der in den meisten Postfächern neben der Betreffzeile erscheint. Ohne ihn sehen Empfänger ein Fragment der ersten Überschrift oder ein verirrtes Alt-Tag — eine verpasste Gelegenheit, Kontext zu setzen. |
