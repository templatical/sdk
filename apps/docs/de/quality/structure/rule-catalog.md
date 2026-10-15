# Regelkatalog Struktur

Die 7 Regeln, die `lintStructure` mitliefert. Jede Regel liegt in `packages/quality/src/structure/rules/`; Schweregrad ist pro Regel über die [Optionen](../options) anpassbar.

## Baum-Integrität

| Regel | Standardschweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `structure.duplicate-block-id` | error | — | Zwei oder mehr Blöcke teilen sich dieselbe `id`. Baumtraversierung, Undo/Redo, Selection und jede ID-basierte Operation hängen von Eindeutigkeit ab — ein Duplikat beschädigt sie lautlos. Meist Zeichen für einen kaputten Import oder einen Clone-Pfad, der das Neugenerieren der IDs vergisst. |
| `structure.nested-section` | error | — | Ein Section-Block sitzt in der Spalte einer anderen Sektion. Der Renderer lehnt das ab — Sektionen können nicht verschachtelt werden — und die innere Sektion fällt lautlos aus dem MJML-Output. Erwischt Importer-Bugs und Copy-Paste-Unfälle. |

## Section-Layout

| Regel | Standardschweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `structure.section-column-mismatch` | error | — | Der `columns`-Wert der Sektion impliziert eine Spaltenanzahl, die nicht zu `children.length` passt. `"1"` erwartet 1 inner array, `"2"`/`"2-1"`/`"1-2"` erwarten 2, `"3"` erwartet 3. Ein Mismatch heißt: entweder der Layout-Key oder das Children-Array ist falsch — beides liefert kaputten Render-Output. Die Section-Toolbar des Editors balanciert `children` automatisch beim Layoutwechsel; diese Regel erwischt Daten, die an der Toolbar vorbei kamen (Importe, manuelle JSON-Edits, alte Snapshots). |

## Inhaltspräsenz

| Regel | Standardschweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `structure.empty-section` | warning | ja | Eine Sektion hat keine Spalten, oder jede Spalte ist leer. Rendert in den meisten Clients als leere Tabellenzeile — verschwendeter Whitespace und gelegentlich eine sichtbare Padding-Lücke. Auto-Fix entfernt die Sektion. |
| `structure.empty-column` | warning | — | Eine Mehrspalten-Sektion hat mindestens eine Spalte ohne Blöcke. Rendert unglücklich (ungleichmäßige Lücken, kollabierte Spalten auf Mobilgeräten) und bedeutet fast immer, dass der Autor weniger Spalten meinte. Kein Auto-Fix, weil die richtige Antwort (in Nachbar-Spalte zusammenführen vs. Sektion entfernen vs. `columns`-Layout ändern) von der Intention abhängt. |

## E-Mail-Client-Kompatibilität

| Regel | Standardschweregrad | Auto-Fix | Was geprüft wird |
|---|---|---|---|
| `structure.wrapper-color-over-background-image` | warning | — | Eine Sektion hat ein Hintergrundbild, und ihr Wrapper (ihr eigener `wrapper` oder, wenn der geprüfte Baum das Layout enthält, das Layout-Band, in dem sie liegt) hat eine Hintergrundfarbe. Outlook unter Windows malt die Wrapper-Farbe über das Bild der Sektion, dort verschwindet das Bild also. Alle anderen Clients legen beides korrekt übereinander. Entferne die Wrapper-Farbe oder lege das Bild auf den Wrapper. |
| `structure.nested-background-image` | warning | — | Eine Sektion und ihr Wrapper haben beide ein Hintergrundbild. Outlook unter Windows kann die beiden VML-Füllungen, die MJML dafür erzeugt, nicht verschachteln, und das Layout bricht. Behalte das Bild nur auf einem von beiden. |
