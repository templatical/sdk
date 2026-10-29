---
title: Lokalisierte Templates
description: Sprachversionen einer E-Mail in settings.locales und l10n speichern, mit Ihrem TranslationProvider übersetzen, mit resolveLocale projizieren und mit --locale prüfen oder rendern.
---

# Lokalisierte Templates

Sprachversionen halten alle Übersetzungen einer E-Mail in einem Template: ein gemeinsamer Blockbaum plus `l10n`-Ebenen mit dem Text, den Eigenschaftsüberschreibungen und den ausgeblendeten Blöcken jeder Sprache aus `settings.locales`. Autoren fügen Versionen im Editor hinzu, bearbeiten sie und füllen sie mit Übersetzen über Ihren `TranslationProvider`; `resolveLocale` und `--locale` projizieren, prüfen und rendern eine Version.

Sprachversionen teilen eine Struktur. Für unabhängige Blockbäume pro Sprache speichern Sie separate Templates und wechseln mit `editor.load(id)`.

## Einrichtung

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: "#editor",
  localization: { locales: ["en", "de", "fr"] },
});
```

`localization.locales` listet die BCP-47-Tags, die Autoren hinzufügen können. `settings.locale` des Templates ist seine Standardsprache; ein leeres Template beginnt auf Englisch (`"en"`). Die Liste allein schreibt nichts ins Template: Das Menü **Sprachen** erscheint im Header, und ein Autor fügt dort eine Version hinzu. Für eine statische Seite ohne Bundler binden Sie den Editor wie im [Schnellstart](/de/getting-started/quick-start#mount-the-editor) über das CDN ein und übergeben denselben `localization`-Schlüssel.

Ergänzen Sie `translation` für Übersetzen und `localization.doNotTranslate` für Markennamen; siehe [Übersetzen](#translating). Die UI-Sprache des Editors (`init({ locale })`) ist unabhängig von Template-Sprachen; siehe [Internationalisierung](/de/guide/i18n). Bestehende Templates brauchen keine Migration; siehe [Kompatibilität](#compatibility). `initCloud()` ignoriert `localization` und `translation` und protokolliert eine Warnung.

## Eine Sprache hinzufügen

Öffnen Sie **Sprachen**, wählen Sie **Sprache hinzufügen** und dann eine Sprache; das Untermenü bietet die konfigurierten Sprachen an, die dem Template fehlen. Beschriftungen nennen jede Sprache in ihrer eigenen Sprache, etwa `de` als **Deutsch** und `fr` als **Français**, überall dort, wo sie `{language}` oder `{default}` zeigen. Wählen Sie die neue Version im Menü aus, um sie zu bearbeiten: Die Sprachleiste unter dem Header zeigt **Bearbeitung: {language}**. **Zurück zu {default}** in der Leiste oder die Standardzeile im Menü führt zur Standardsprache zurück. Die Schaltfläche **Weitere Aktionen für {language}** jeder Version bietet **Als Standardsprache festlegen** ([Standardsprache](#standardsprache)) und **{language} entfernen…**, das eine Bestätigung verlangt und sich rückgängig machen lässt.

Text- und Eigenschaftsänderungen in einer Sprachansicht betreffen nur diese Sprache. Hat ein übersetzbares Feld einen Standardwert, speichert eine Bearbeitung `text` mit seinem `sourceHash`; fehlt der Standardwert, etwa ein nicht vorhandener Preheader, speichert sie eine `set`-Überschreibung ohne Veraltungsprüfung. Ein Wert gleich dem Standard hinterlässt keine Überschreibung. Der Einstellungsbereich zeigt eine Sprachmarkierung an jedem überschriebenen oder übersetzten Feld und das Symbol **Auf {default} zurücksetzen**: Es stellt nur dieses Feld aus dem Standard wieder her und erhält benachbarte Überschreibungen. **Änderungen zurücksetzen** im Statusabzeichen entfernt alle `set`-Überschreibungen dieses Blocks; seine `text`-Übersetzungen bleiben erhalten. **In {language} ausblenden** in den Blockeinstellungen lässt einen Geisterblock auf der Arbeitsfläche stehen; **Anzeigen** stellt ihn wieder her, und der Renderer lässt ausgeblendete Blöcke aus.

Hinzufügen, Verschieben, Löschen, Duplizieren, Einfügen und Ziehen ändern den gemeinsamen Baum für alle Sprachen. Die Sprachleiste zeigt **Strukturänderungen gelten für jede Sprache** einmal pro Sitzung und Template. Eine Version in `settings.locales`, die in `localization.locales` fehlt, bleibt auswählbar, schreibgeschützt und als **Nicht aktiviert** markiert: Wert- und Strukturänderungen werden abgelehnt. Wer dort einen Block auswählt, nimmt trotzdem seine Sperre für diese Sprache, sodass bei Zusammenarbeit jemand in der schreibgeschützten Ansicht und jemand, der eine andere Sprache bearbeitet, denselben Block gleichzeitig halten.

Die aktive Sprache ist Ansichtsstatus und wird nicht gespeichert; jede Sitzung startet im Standard. `editor.getLocale()`, `editor.setLocale(tag)` und `init({ onLocaleChange })` lesen, wählen und melden sie; eine unbekannte Version wirft `SdkError` mit Code `unknown_locale`. Siehe [Editor-API](/de/api/editor).

Aus [Beefree](/de/guide/migration-from-beefree#languages), [Unlayer](/de/guide/migration-from-unlayer#languages) und [Topol](/de/guide/migration-from-topol#languages) importierte Sprachen nutzen dieselben Ebenen. Jeder Importer akzeptiert `defaultLocale?: string` für eine Quelle ohne deklarierten Standard, und `template-tools import --default-locale <tag>` übergibt ihn über die CLI; ein ungültiger Tag dort endet mit Exit-Code `2`. Ein Importer ignoriert eine deklarierte Standardsprache oder ein `defaultLocale`, das kein Sprach-Tag ist, mit einer Warnung und nimmt den nächsten gültigen Wert oder `"en"`. Prüfen Sie `report.warnings` auf verworfene Sprachen und tragen Sie die importierten Sprachen in `localization.locales` ein, um sie zu bearbeiten. Ohne Editor schreiben Sie Versionen mit den [Locale-Operationen](#operationen-und-zusammenarbeit) oder mit `strings import` ([Übersetzen](#translating)).

## Übersetzen {#translating}

Übergeben Sie einen [`TranslationProvider`](/de/backend/translation) als `init({ translation })` neben `localization`; ohne ihn gibt es keine Übersetzungsoberfläche. In einer aktivierten Sprachansicht sendet **{count} Felder übersetzen** in der Sprachleiste die fehlenden und veralteten Felder (die Lücken), sodass aktuelle Übersetzungen und manuelle Änderungen erhalten bleiben; ohne Lücken ist die Aktion ausgeblendet. **Alles erneut übersetzen…** sendet nach einer Bestätigung, die die Feldzahl nennt und das Ersetzen manueller Änderungen erklärt, jedes geeignete Feld; ohne geeignete Felder ist die Aktion deaktiviert. Das Statusabzeichen eines Blocks bietet **Übersetzen** bei fehlendem Text und **Erneut übersetzen** bei veraltetem Text oder abweichenden Merge-Tags.

Übersetzen maskiert Merge-Tags, Logik-Tags und die Begriffe aus `localization.doNotTranslate` (zum Beispiel `["Sable"]`) als nummerierte Platzhalter und übernimmt ein zurückgegebenes Feld nur, wenn es genau die gesendeten Platzhalter enthält; jedes andere Feld behält seinen bisherigen Wert und wird gemeldet. HTML-Blöcke, leere Standardwerte, `set`-Überschreibungen und ausgeblendete Blöcke werden nicht gesendet: Übersetzen Sie HTML-Blöcke von Hand. Der [Übersetzungsvertrag](/de/backend/translation#provider-vertrag) definiert Platzhalter, Batch-Grenzen, Fehler und die DeepL-Einstellungen.

Während eines Durchlaufs zeigt die Sprachleiste **{done} von {total} werden übersetzt…** mit **Abbrechen**, und der Editor bleibt bearbeitbar. Vor Abbruch oder Fehler zurückgegebene Felder werden gemeinsam als ein Rückgängig-Schritt angewendet; ein Durchlauf ohne Änderung zeichnet nichts auf. Mit Zusammenarbeit ist ein Durchlauf eine gewöhnliche Bearbeitung, und Blöcke, die eine andere Sitzung in dieser Sprache oder strukturell hält, werden übersprungen. Die schließbare Ergebnismeldung nennt übersetzte Felder, wegen geänderter Tags beibehaltene Felder, nicht zurückgegebene Felder, wegen laufender Bearbeitung übersprungene Blöcke und die Fehlermeldung des Übersetzungsdienstes. Schließen Sie sie, um wieder die Zahlen zu sehen; ein Ansichtswechsel löscht sie.

KI-Chat, Mit KI beheben, Umformulieren und Alt-Text schreiben bearbeiten die aktive Sprache; siehe [KI in Sprachansichten](/de/backend/ai#ki-in-sprachansichten).

Für den Austausch als Dateien mit einem Übersetzungsdienst oder Übersetzer schreibt `strings export` die Lücken einer Sprache als JSON, und `strings import` wendet die übersetzte Datei an:

```bash
npx -y @templatical/template-tools strings export template.json --locale de --out strings.de.json
npx -y @templatical/template-tools strings import template.json strings.de.json --json
```

Setzen Sie den `text` jedes Eintrags und lassen Sie `id`, `sourceHash` und Platzhalter unverändert. Ein veralteter Eintrag hat kein `text`: Seine alte Übersetzung steht in `previous`, das der Import nie liest; übersetzen Sie ihn daher neu aus `source`. Import wendet jeden String an, dessen `sourceHash` noch zum aktuellen Standard passt und dessen Platzhalter exakt zurückkommen, schreibt die angenommenen Strings und endet mit Exit `1`, wenn ein String abgelehnt wurde. Beide Befehle lehnen die Standardsprache ab, und der Import lehnt eine Datei ab, die exportiert wurde, bevor eine andere Sprache zum Standard wurde. Übergeben Sie beiden Befehlen dieselben `--do-not-translate`- und `--definitions`-Dateien; siehe [Strings](/de/api/template-tools#strings).

Im Code ist derselbe Rundlauf `localeStrings` → JSON → `applyLocaleStrings` aus `@templatical/types`. Dieses vollständige TypeScript-Beispiel extrahiert die Lücken mit geschütztem `Sable`, simuliert eine JSON-Bearbeitung durch einen Übersetzer und wendet die zurückgegebenen Locale-Operationen an; übergeben Sie beiden Helfern dieselbe `doNotTranslate`-Liste. `localeStrings` liefert die gespeicherte Übersetzung eines veralteten Eintrags in `text`, und `applyLocaleStrings` stempelt jeden erhaltenen `text` mit dem Hash zum Extraktionszeitpunkt; ein unverändert angewendeter veralteter Eintrag macht das Feld daher aktuell, wie **Beibehalten**. Entfernen Sie `text` aus veralteten Einträgen, bevor Sie sie an einen Übersetzer geben, wie das Beispiel es durch Verschieben nach `previous` tut, oder verwenden Sie `strings export`. Mit `only: "gaps"` tragen nur veraltete Einträge `text`; mit `only: "all"` listet `localeCoverage(content, locale).stale` sie auf. Ein Standardwert, der bearbeitet wird, während die Datei unterwegs ist, macht diesen String veraltet. Die reinen Helfer bereinigen zurückgegebenes HTML nicht: Bereinigen Sie es vor dem Anwenden und erhalten Sie dabei die Platzhalter.

<<< @/snippets/translate-strings.ts

## Eine Sprache prüfen

Die Sprachschaltfläche im Header nennt die aktive Sprache; in einer Sprachansicht mit Lücken ergänzt sie ein Warnsymbol und die Zahl der Lücken, mit „{missing} fehlen, {stale} veraltet“ im Tooltip. Die Sprachleiste zeigt dieselben Zahlen oder **Vollständig**. Ein Block mit einem Lokalisierungszustand trägt ein Symbol als Statusabzeichen in seiner oberen rechten Ecke (oben links in einer Rechts-nach-links-Ansicht); sein Tooltip und sein zugänglicher Name nennen die Beschriftung unten. Wählen Sie das Abzeichen oder **Zum Block springen** bei einem Lokalisierungsbefund im Bereich Probleme, um sein Popover zu öffnen.

| Abzeichen-Beschriftung | Bedeutung | Aktionen |
| --- | --- | --- |
| **In {language} ausgeblendet** | Der Block ist nicht in der E-Mail dieser Sprache | **Anzeigen** |
| **Nicht übersetzt** | Ein Feld hat keinen Text in dieser Sprache; die E-Mail zeigt den Standardtext | **Übersetzen** |
| **Veraltet** | Der Standardtext wurde nach der Übersetzung geändert | **Erneut übersetzen**, **Beibehalten**, **{default} verwenden** |
| **Merge-Tags unterscheiden sich** | Die Merge-Tags einer aktuellen Übersetzung weichen vom Standardtext ab | **Erneut übersetzen**, **{default} verwenden** |
| **Geändert in {language}** | Eigenschaften sind in dieser Sprache überschrieben | **Änderungen zurücksetzen** |
| **In {count} Sprachen veraltet** | In der Standardansicht: Übersetzungen dieses Blocks sind veraltet | **Öffnen**, pro Sprache |

Ein Block mit mehreren Zuständen zeigt den ersten in dieser Reihenfolge; bei mehreren Feldern in einem Zustand zählt seine Beschriftung sie („{count} nicht übersetzt“). **Übersetzen** und **Erneut übersetzen** benötigen einen Übersetzungs-Provider. In der Vorschau erscheinen keine Abzeichen, und die Blöcke eines Layouts haben keine ([Layouts](#layouts)). `template-tools validate --locale <tag>` und `lintTemplate(content, { contentLocale })` melden fehlende, veraltete und Merge-Tag-Befunde als `localization.untranslated`, `localization.stale` und `localization.merge-tags-differ`, unten beschrieben; siehe [Ergebnis prüfen](#check-your-work).

### Fehlende Werte {#missing-values}

Eine fehlende Übersetzung fällt auf den Standardsprachwert zurück. Der Block zeigt **Nicht übersetzt**, die Abdeckung meldet das Feld als fehlend und `localization.untranslated` gibt eine Warnung aus. Leere Standardwerte und ausgeblendete Blöcke zählen nicht als fehlend. Inhalt von HTML-Blöcken zählt mit, obwohl Übersetzen und `strings export` ihn nicht senden: Die Sprachleiste zählt ihn als fehlend, ohne **{count} Felder übersetzen** dafür anzubieten, und die Warnung bleibt, bis Sie ihn in der Sprachansicht von Hand übersetzen. Eine absichtlich leere Übersetzung ist ein Wert und löst keinen Fallback aus.

### Veraltete Werte {#out-of-date-values}

Jede Übersetzung speichert den `sourceHash` des Standardwerts, gegen den sie geschrieben wurde. Ändert sich der Standard, ist die Übersetzung **Veraltet**, und `localization.stale` meldet sie. **Erneut übersetzen** übersetzt sie neu. **Beibehalten** behält den Text und speichert den aktuellen Hash, auch wenn der geänderte Standard inzwischen der Übersetzung entspricht; die Abdeckung zählt sie dann als übersetzt. **{default} verwenden** entfernt die Übersetzung, sodass der Standard erscheint. Keine dieser Aktionen ändert benachbarte Überschreibungen, und Aus- und Einblenden eines Blocks erhält seinen Text. In der Standardansicht markiert **In {count} Sprachen veraltet** die betroffenen Blöcke. Überschreibungen in `set` haben keinen Quell-Hash. [Typen](/de/api/types#localization) beschreibt das Hash-Format.

### Merge-Tags {#merge-tags}

Übernehmen Sie die Merge-Tags des Standards einschließlich wiederholter Vorkommen in jedes übersetzte Feld: `localization.merge-tags-differ` vergleicht sie als Multimenge, und der Editor bietet in jeder Sprache dieselbe Merge-Tag-Liste an. Eine aktuelle Übersetzung mit abweichenden Tags zeigt **Merge-Tags unterscheiden sich**. Ihr **Erneut übersetzen** sendet mit einem Provider alle geeigneten Textfelder dieses Blocks; **{default} verwenden** entfernt nur die abweichenden Übersetzungen. Fehlender und veralteter Text haben Vorrang vor diesem Zustand. Die Regel ist eine Warnung, aber die CLI-Validierung endet bei ihr mit Exit `1`, auch bei `valid: true`; fehlende und veraltete Übersetzungen allein ändern den Exit-Code nicht.

## Eine Sprache rendern

`renderToMjml(content, { locale: "de" })`, `editor.toMjml({ locale: "de" })`, `editor.toHtml({ locale: "de" })` und `template-tools render template.json --locale de` rendern eine Version. Ohne `locale` rendern sie den Standard, unabhängig von der Ansicht im Editor; eine unbekannte Version scheitert mit `unknown_locale`. Projizierte Sprache und Richtung bestimmen MJML-`lang` und `dir`. Lokaler MJML-Export benötigt den optionalen Peer `@templatical/renderer`, HTML einen Provider mit `render.toHtml` oder `render.compileMjml`; siehe [Rendering & Export](/de/backend/render).

Mit installiertem `@templatical/types` und `@templatical/renderer` fügt dieses vollständige TypeScript-Beispiel Deutsch hinzu, schreibt Text und Richtung, prüft die Abdeckung und rendert deutsches MJML:

<<< @/snippets/localize-template.ts

`resolveLocale(content, locale)` ist die Projektion hinter jedem Rendern: Sie wendet Text, Überschreibungen und Einstellungen an, entfernt ausgeblendete Blöcke, entfernt die Lokalisierungsfelder und setzt `settings.locale` auf die projizierte Sprache. Fehlende Werte bleiben beim Standard. Speichern Sie den Originalinhalt mit allen Versionen, nicht die Projektion. Die Vorschau zeigt die aktive Sprache mit dem zusammengesetzten Layout, bevor `resolvePreview` läuft, und ein Sprachwechsel verwirft das Ergebnis der vorherigen Sprache.

Ein benutzerdefinierter Block mit einem `text`- oder `set`-Eintrag in der angefragten Sprache verliert in der Projektion sein zwischengespeichertes `renderedHtml` der Standardsprache und rendert daher über `renderCustomBlock`; ohne Callback wird er ausgelassen, statt in der Standardsprache zu erscheinen. Der Export des Editors rendert ihn in der angefragten Sprache. Siehe [Rendering benutzerdefinierter Blöcke](/de/api/renderer-typescript#benutzerdefinierte-blocke).

## Datenstruktur

`settings.locale` ist die Standardsprache. `settings.locales?: string[]` enthält die anderen Versionen, ohne Duplikate oder Standardsprache. Jeder Schlüssel in `block.l10n` und `settings.l10n` muss in dieser Liste stehen.

| Mitglied | Vertrag |
| --- | --- |
| `block.l10n[locale].text` | `Record<string, LocalizedText>`; jeder Wert ist `{ value: string; sourceHash: string }` |
| `block.l10n[locale].set` | `Record<string, unknown>` für URLs, Bilder, Stile und andere Überschreibungen; `null` bedeutet, dass die Eigenschaft in dieser Sprache fehlt |
| `block.l10n[locale].hidden` | `true` lässt den Block und seine Nachfahren in dieser Sprache aus |
| `settings.l10n[locale]` | `SettingsLocaleLayer`: optionale `text` (`preheaderText`) und `set` (etwa `direction`, Schriften und Farben), ohne `hidden` |

Sprach-Tags müssen `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$` entsprechen: 2–3 ASCII-Buchstaben, gefolgt von beliebig vielen mit Bindestrich getrennten Subtags aus 2–8 ASCII-Buchstaben oder Ziffern. Formen mit `x-…` oder `i-…` am Anfang werden abgelehnt, weil ihr Sprachsegment nur einen Buchstaben hat; historische Formen wie `no-bok` und `zh-min-nan` entsprechen dem Muster und werden akzeptiert.

Ein Feldpfad verbindet Eigenschaftsnamen mit `.`; bei Arrays ist das nächste Segment die `id` des Elements, niemals sein Index: `items.nav-shop.text`, `rows.row-one.cells.cell-one.content`, `fieldValues.heading`, `styles.padding`. Eine Feld-ID ist `<blockId>/<path>` oder `settings/<path>`. IDs von Menüeinträgen, Social-Icons, Tabellenzeilen und Tabellenzellen dürfen weder `.` noch `/` enthalten: `validateTemplate` meldet sie, und `addBlock`, `updateBlock` und `setContent` lehnen eine Operation, die eine solche ID hinzufügt (einen neuen Block, Eintrag, eine neue Zeile oder Zelle), mit `invalid_operation` ab. Eine ID, die schon im Template steht, bleibt bearbeitbar, sodass ein damit gespeichertes Template weiter bearbeitet werden kann; benennen Sie sie um, um das Element zu lokalisieren und die Validierung zu bestehen.

`text` enthält nur lesbare Felder: die `TRANSLATABLE_FIELDS` jedes Blocktyps (Inhalt, Alt-Text, Button-Text, Countdown-Beschriftungen, Menüeintragstext, Tabellenzelleninhalt), den Preheader sowie benutzerdefinierte `text`- und `textarea`-Felder. Alles andere, etwa URLs, Bildquellen, Größen und Farben, ist eine `set`-Überschreibung. Ein Pfad steht höchstens in `text` oder `set`. `set` kann `columns` einer Sektion und vollständige integrierte Listen (`items`, `rows`, `rows.<id>.cells`, `icons`) nicht ersetzen; überschreiben Sie stattdessen die Eigenschaften einzelner Elemente. Leere Ebenen und Felder werden weggelassen, nie als `{}` oder `[]` gespeichert. [Typen](/de/api/types#localization) enthält die Deklarationen und Pfadregeln.

## Layouts

Eine `init({ layout })`-Hülle wird um das Template herum zusammengesetzt, außerhalb davon, ihr Text gehört also nicht zum Template. Ein Layout kann eigene `settings.locales`, Block-`l10n` und `settings.l10n` tragen, auch für die Wrapper-Kinder neben dem Slot, unabhängig von den Sprachen des Templates. Vorschau, `toMjml()`, `toHtml()`, die Test-E-Mail-Vorschau und `renderToMjml(content, { layout, locale })` projizieren es vor dem Zusammensetzen mit `resolveLocale(layout, locale, { missing: "default" })`; fehlt dem Layout die Sprache, erscheint seine Standardsprache.

Eine Sprache kann den Slot des Layouts und einen Wrapper, der ihn enthält, nicht ausblenden, weil das Layout diese Sprache sonst nicht zusammensetzen könnte: `updateBlockLocale` lehnt `hidden: true` auf ihnen mit `invalid_operation` ab, `moveBlock` und `addBlock` lehnen es ab, den Slot unter einen Block zu setzen, den eine Sprache ausblendet, und `validateTemplate` meldet eine solche Ebene. Jeder andere Layout-Block lässt sich wie in einem Template ausblenden.

Der Editor bearbeitet das Layout nie. Seine Blöcke haben weder Auswahl noch Lint- oder Statusabzeichen, Übersetzen sendet sie nicht, und die Sprachzahlen enthalten sie nicht. Übersetzen Sie stattdessen die Layout-Datei, zum Beispiel mit der CLI:

```bash
npx -y @templatical/template-tools edit layout.json --op '{"op":"addLocale","locale":"de"}' --json
npx -y @templatical/template-tools strings export layout.json --locale de --out layout.de.json
npx -y @templatical/template-tools strings import layout.json layout.de.json --json
npx -y @templatical/template-tools validate layout.json --locale de --json
```

Setzen Sie zwischen Export und Import den `text` jedes Eintrags in `layout.de.json`, wie unter [Übersetzen](#translating).

## Standardsprache

`settings.locale` ist die Standardsprache: der Text, auf den jede Version zurückfällt und aus dem sie übersetzt wird. Um eine Version zu übernehmen, öffnen Sie **Sprachen**, wählen bei der Version **Weitere Aktionen für {language}** und dann **Als Standardsprache festlegen**. Die Bestätigung **{language} als Standardsprache festlegen?** nennt, falls vorhanden, die Felder ohne Text in dieser Sprache: „{count} Felder haben keinen Text in {language} und behalten ihren Text in {default}.“ **Als Standard festlegen** wendet die Änderung als ein Rückgängig-Schritt an, wechselt die Ansicht zum neuen Standard und meldet „{language} ist jetzt die Standardsprache.“; Rückgängig entfernt diese Meldung. Der Eintrag ist deaktiviert, mit dem Grund darunter, solange der aktuelle Standard nicht in `localization.locales` steht („Füge {default} zuerst zu den aktivierten Sprachen hinzu“), weil der alte Standard sonst eine Version würde, die niemand bearbeiten oder zurück zum Standard machen kann; und solange Blöcke in dieser Sprache ausgeblendet sind („Zeige zuerst die {count} in {language} ausgeblendeten Blöcke“). In einem schreibgeschützten Editor oder für eine nicht aktivierte Version wird er nicht angeboten.

Die Änderung ist eine Operation, `{ "op": "setDefaultLocale", "locale": "de" }`:

- Der deutsche Text und die deutschen Überschreibungen werden zur Basis. Englisch übernimmt den Platz von Deutsch in `settings.locales`, mit seinen abweichenden Werten in einer englischen Ebene; Text, den Deutsch gleich übersetzt hatte, bleibt eine aktuelle englische Übersetzung.
- Ein Feld ohne deutschen Text behält seinen englischen Wert, sodass die deutsche E-Mail dort Englisch zeigt. `defaultLocaleGaps(content, "de", definitions?)` listet diese Feld-IDs vor der Änderung; danach meldet `validate --locale en` sie als `localization.untranslated`. Englisch behält für diese Felder keine eigene Kopie: Nach der Änderung ändert eine Bearbeitung im deutschen Standard auch die englische E-Mail. Übersetzen Sie die Lücken zuerst ins Deutsche, bis `defaultLocaleGaps(content, "de")` `[]` liefert. Ein leerer Standardwert, etwa das `alt: ""` eines dekorativen Bildes, hat keinen Text zu bewahren und ist keine Lücke. Übersetzen und `strings export` senden keine HTML-Blöcke: Übersetzen Sie HTML-Blöcke von Hand in der deutschen Ansicht.
- Andere Sprachen behalten ihren Zustand gegenüber der neuen Basis: Aktueller Text wird neu gestempelt und bleibt aktuell; veralteter Text behält seinen gespeicherten Hash und bleibt veraltet, außer dieser Hash entspricht dem übernommenen deutschen Wert, dann wird er aktuell.
- Eine Version mit ausgeblendeten Blöcken wird mit `invalid_operation` abgelehnt; `localeHiddenBlocks(content, "de")` listet die zuerst einzublendenden Blöcke. Eine unbekannte Version wird ebenfalls mit `invalid_operation` abgelehnt, und mit Zusammenarbeit lehnt jede Sperre einer anderen Sitzung die Änderung mit `locked_by_others` ab.

`updateSettings` kann `settings.locale` nicht ändern, solange Versionen bestehen, und KI in einer Sprachansicht kann `setDefaultLocale` nicht ausführen. [Operationen](/de/api/operations#standardsprache) beschreibt die neu gestempelten Hashes, entfernte optionale Felder, die Umkehrung und die Ablehnungsmeldungen. Prüfen Sie das Ergebnis: Die gespeicherte Datei hat `settings.locale` `"de"` und `"en"` in `settings.locales`, `template-tools validate template.json --json` meldet `valid: true`, und `validate template.json --locale en --json` listet die verbleibenden Lücken als `localization.untranslated`, und nur diese: Ein Feld, dessen deutscher Text dem englischen glich, behält einen aktuellen englischen Eintrag.

## Kommentare

Kommentar-Threads werden zwischen den Sprachen geteilt. Jeder neue Kommentar und jede Antwort sendet `CommentInput.locale`, die Sprache der Ansicht, in der er geschrieben wurde, einschließlich des Tags der Standardsprache; Ihr [Kommentar-Provider](/de/backend/comments#locale) speichert ihn und liefert `Comment.locale` zurück. Ein Kommentar ohne Tag, gespeichert vor den Sprachversionen oder von einem Kommentar-Backend, das `locale` nicht speichert (das von Cloud tut es noch nicht), zählt zur aktuellen Standardsprache des Templates und folgt einem Wechsel der Standardsprache; ein Kommentar mit Tag behält sein Tag. Mit konfigurierter Lokalisierung zeigt jeder Kommentar und jede Antwort ein Sprachabzeichen, und **Diese Sprache** im Kommentarbereich zeigt die Threads, deren Hauptkommentar oder eine Antwort in der aktiven Sprache ist, mit allen Nachrichten und Abzeichen. Der Filter ist Ansichtsstatus und wird nicht gespeichert. Die Kommentare von Cloud speichern die Sprache noch nicht.

## Betreffzeilen {#subject-lines}

Ein Template hat kein Betreff-Feld: Die Betreffzeile gehört dem Host, der die E-Mail versendet, daher enthalten Übersetzen und `strings export` sie nicht. Übersetzen Sie sie mit demselben `TranslationProvider` als ein `text`-Feld: Maskieren Sie ihre Merge-Tags und geschützten Begriffe mit `maskTags`, senden Sie sie und stellen Sie die Antwort mit `unmaskTags` wieder her, das `null` liefert, wenn ein Platzhalter fehlt oder geändert wurde. Dieses vollständige TypeScript-Beispiel benötigt `@templatical/types` und `@templatical/ai-kit`; ersetzen Sie den Mock durch den Provider, den Sie `init({ translation })` übergeben:

<<< @/snippets/translate-subject.ts

Übergeben Sie die Merge-Tag-Syntax und die `doNotTranslate`-Liste Ihres Editors; das Beispiel verwendet `SYNTAX_PRESETS.liquid`. Es gibt <code v-pre>{{first_name}}, Ihre Sable-Bestellung ist unterwegs</code> aus. Die Feld-`id` wählen Sie selbst; der Provider gibt sie unverändert zurück. Speichern Sie den Betreff jeder Sprache in Ihren eigenen Daten beim Template.

## Operationen und Zusammenarbeit

| Operation | Wirkung |
| --- | --- |
| `addLocale` | Fügt eine Version zu `settings.locales` hinzu |
| `removeLocale` | Entfernt die Version und alle zugehörigen Block- und Einstellungsebenen |
| `setDefaultLocale` | Macht eine Version zum Standard; siehe [Standardsprache](#standardsprache) |
| `updateBlockLocale` | Schreibt `text`, `set`, `unset`-Pfade und `hidden` eines Blocks für eine Sprache |
| `updateSettingsLocale` | Schreibt `text`, `set` und `unset` der Einstellungen für eine Sprache |

Wenden Sie sie mit `applyOperations` an und kehren Sie sie mit `invertOperations` aus `@templatical/types` um, führen Sie sie mit `template-tools edit` aus oder senden Sie sie als Kollaborations-Batch. Nur diese Operationen ändern Lokalisierungsfelder: `updateBlock` und `updateSettings` lehnen sie ab, `addBlock` darf das `l10n` eines neuen Blocks enthalten, und `setContent` ersetzt alles. Eine fehlgeschlagene `expect`-Prüfung ergibt `precondition_failed`; ein ungültiger Pfad, eine ungültige Sprache oder ein nicht übersetzbares Textfeld ergibt `invalid_operation`. [Operationen](/de/api/operations#locale-operationen) beschreibt die exakten Formen, die Reihenfolge der Updates und die Rückgängig-Prüfungen.

`BlockLock.locale?: string | null` und `OperationLock.locale?: string | null` verwenden `null` oder einen fehlenden Wert für Standardsprache und Struktur. Eine lokalisierte Bearbeitung an (Block X, `de`) kollidiert mit einer Sperre einer anderen Sitzung auf (X, `de`) oder (X, `null`); eine Sperre auf (X, `fr`) kann parallel bestehen. `updateBlock`, `moveBlock` und `deleteBlock` auf X kollidieren mit jeder Sperre einer anderen Sitzung auf X (Verschieben und Löschen auch mit Sperren in X), `addBlock` prüft keine Sperren, und `setDefaultLocale` kollidiert mit jeder Sperre. `onRemoteChange.locale` ist die Sprache der ersten Locale-Operation im Batch, ausgenommen `setDefaultLocale`, sonst `null`; ein `setDefaultLocale`-Batch meldet `null`, da er die Standardsprache des Templates ändert. Exakte Verträge stehen unter [Zusammenarbeit](/de/backend/collaboration).

## Kompatibilität {#compatibility}

Bestehende einsprachige Templates brauchen keine Migration: Sie laden, bearbeiten, speichern und rendern wie bisher. Ohne `localization` gibt es keine Sprachen-UI, und vorhandene Ebenen bleiben bei Bearbeitungen und Speichern in der Standardsprache erhalten. Der Editor schreibt Lokalisierungsfelder erst, wenn ein Autor eine Sprache hinzufügt.

Alle `@templatical/*`-Pakete erscheinen gemeinsam unter einer Versionsnummer. Halten Sie sie auf derselben Version: Ein Renderer oder Validator aus der Zeit vor den Sprachversionen kennt `l10n` nicht; ein älterer Renderer rendert die Standardsprache, ein älterer Validator lehnt das Template ab.

Ein selbst gebautes Kollaborationsbackend muss die Locale-Operationen aus der [Operations-Referenz](/de/api/operations) und die Sperr-`locale` umsetzen; siehe [Zusammenarbeit](/de/backend/collaboration). Bis dahin lehnt es sie als `invalid_operation` ab, und ein Backend, das die Sperr-`locale` ignoriert, serialisiert Bearbeitungen pro Block. Ein selbst gebautes Kommentar-Backend speichert `locale`; siehe [Kommentare](#kommentare).

## Grenzen

- Die Spaltenstruktur ist für alle Sprachen gemeinsam und lässt sich nicht pro Sprache überschreiben. Die Spaltenreihenfolge folgt der Schreibrichtung jeder Sprache, sodass eine Rechts-nach-links-Version die erste Spalte rechts zeigt, aber explizite linke und rechte Textausrichtung sowie linke/rechte Innenabstände werden nicht gespiegelt: Überschreiben Sie sie pro Sprache.
- Text in wiederholbaren Elementen eines benutzerdefinierten Blocks lässt sich nicht feldweise übersetzen, weil die Elemente keine IDs haben. Überschreiben Sie stattdessen das gesamte `fieldValues.<key>` pro Sprache.
- Übersetzen lässt HTML-Blöcke aus. Übersetzen Sie sie von Hand in der Sprachansicht.
- Von der KI in einer Sprachansicht hinzugefügte Blöcke gelangen mit ihrem Text als Standardinhalt in den gemeinsamen Baum, wie beim Einfügen. Die KI kann in einer Sprachansicht nicht das gesamte Template ersetzen; wechseln Sie dafür zur Standardsprache.
- Kommentar-Threads werden zwischen den Sprachen geteilt. Jeder neue Kommentar und jede Antwort speichert über Ihren Kommentar-Provider den Sprach-Tag der Ansicht; Cloud speichert ihn noch nicht. Der Versionsverlauf gilt weiterhin pro Template, nicht pro Sprache.
- Der Cloud-Editor unterstützt noch keine Sprachversionen oder Übersetzung: `initCloud()` ignoriert `localization` und `translation` und protokolliert eine Warnung.
- Strings werden als JSON ausgetauscht; XLIFF und CSV werden nicht unterstützt.

## Ergebnis prüfen {#check-your-work}

Für eine gespeicherte `template.json` prüfen und rendern Sie eine Sprache:

```bash
npx -y @templatical/template-tools validate template.json --locale de --json
npx -y @templatical/template-tools render template.json --locale de --format mjml --out template.de.mjml
```

`validate --locale de` prüft die Projektion jeder deklarierten Sprache gegen die normalen Schemas und nennt bei Projektionsfehlern die Sprache; danach lintet es die deutsche Projektion einschließlich `localization.untranslated`, `localization.stale` und `localization.merge-tags-differ`. Lesen Sie die Befunde auch bei Exit `0`: Fehlende und veraltete Übersetzungen sind Warnungen. Lesen Sie nach `strings import` zuerst dessen `rejected`-Liste.

| Exit | `validate` und `render` | `strings import` |
| --- | --- | --- |
| `0` | Erfolg; Warnungen wie `localization.untranslated` und `localization.stale` können bleiben | Kein String wurde abgelehnt (Einträge ohne `text` werden übersprungen) |
| `1` | Ungültige Struktur, eine unbekannte Locale oder bei `validate` ein Lint-Befund mit Schweregrad Fehler oder `localization.merge-tags-differ` (auch bei `valid: true`) | Ein String wurde abgelehnt (die angenommenen Strings werden geschrieben), das Template ist ungültig oder `targetLocale` ist keine seiner Versionen (nichts wird geschrieben) |
| `2` | Fehlbedienung oder Toolfehler: ein fehlender oder leerer `--locale`-Wert, eine ungültige `--definitions`-Datei oder bei `validate` eine Ausnahme im Linter | Fehlbedienung: fehlende Argumente oder eine unlesbare oder ungültige Strings-, Definitions- oder Begriffsdatei |
| `3` | Eine fehlende optionale Abhängigkeit: `mjml` für `render --format html` und `validate --html` | Nicht verwendet |

Eine unbekannte Locale ergibt Exit `1` und schreibt `unknown_locale` auf stderr ohne Ergebnisdokument, auch mit `--json`. Ein fehlender oder leerer `--locale`-Wert ergibt Exit `2`. `valid: true` allein bedeutet nicht Exit `0`. Siehe [Template-Tools](/de/api/template-tools#exit-codes).

Übergeben Sie für Übersetzungen benutzerdefinierter Blöcke `--definitions definitions.json`, ein JSON-Array von `CustomBlockDefinition`, an `validate`, `render` und beide `strings`-Befehle; Rendering verwendet das Liquid-Template und CSS jedes Typs. Für den Bibliotheksweg verwenden Sie `validateTemplate(content, definitions)`, danach `lintTemplate(content, { customBlocks: definitions, contentLocale: "de" })` und `renderCustomBlock` zum Rendern. Dieses vollständige TypeScript-Beispiel benötigt `@templatical/types`, `@templatical/template-tools`, `@templatical/quality`, `@templatical/renderer` und `liquidjs`:

<<< @/snippets/localize-custom-block.ts

Prüfen Sie `validation.valid`, lesen Sie `issues` und bestätigen Sie, dass das MJML `Willkommen` statt des zwischengespeicherten `Welcome` enthält. Siehe [Rendering benutzerdefinierter Blöcke](/de/api/renderer-typescript#benutzerdefinierte-blocke) und die [CLI-Bibliotheks-API](/de/api/template-tools#nutzung-als-bibliothek). Prüfen Sie ein Übersetzungs-Backend mit `runTranslationConformance` wie im [Übersetzungsvertrag](/de/backend/translation#check-it) beschrieben.

## Im Playground

Das [Sprachen-Setup](https://play.templatical.com/scenes/languages) öffnet ein Template mit deutschem Text, einem anderen Hero-Bild, einem auf Deutsch ausgeblendeten Block, einem veralteten deutschen Wert, einem Layout-Footer pro Sprache und einem aufgezeichneten Übersetzungs-Provider, mit Sable auf der Liste der nicht zu übersetzenden Begriffe. Wechseln Sie zu Deutsch und nutzen Sie **{count} Felder übersetzen** oder **Erneut übersetzen** am veralteten Block; bearbeiten Sie deutschen Text und kehren Sie zu Englisch zurück, um zu prüfen, dass er unverändert bleibt. Wählen Sie **Beibehalten**, um ein Veraltet-Abzeichen zu entfernen, fügen Sie Französisch hinzu oder wählen Sie Arabisch für Inhalte von rechts nach links. Die Varianten zeigen ein geändertes Tag (`?translation=tags-changed`), Teilergebnisse beim Abbrechen (`?translation=cancel`), Kollaborationssperren (`?collaboration=1&user=Ada`) und 300 Blöcke in 20 Sprachen (`?scale=1`).
