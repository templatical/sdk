---
title: Lokalisierte Templates
description: Sprachversionen einer E-Mail in einem Template speichern — mit Text, Überschreibungen und ausgeblendeten Blöcken pro Sprache, Rendering pro Locale und Prüfungen auf fehlende oder veraltete Übersetzungen.
---

# Lokalisierte Templates

Sprachversionen einer E-Mail teilen mit `settings.locales` und `l10n` einen Blockbaum; `resolveLocale` projiziert eine Version und `--locale` wählt sie zur Prüfung aus.

## Sprachversionen aktivieren

Dieser HTML-Einstiegspunkt läuft in einer Vite-App mit installiertem `@templatical/editor`. Das leere Template beginnt auf Englisch. Unter **Sprachen** wählen Sie **Sprache hinzufügen** und Deutsch; die Konfiguration allein schreibt keine Lokalisierungsfelder.

<<< @/snippets/localized-editor.html

Aktualisieren Sie Renderer, Validator und Kollaborationsbackend vor dem Aktivieren; siehe [Upgrade](#upgrading). Die UI-Sprache (`init({ locale })`) ist unabhängig von Template-Sprachversionen; siehe [Internationalisierung](/de/guide/i18n).

## Datenstruktur

`settings.locale` ist die feste Standardsprache. `settings.locales?: string[]` enthält die anderen Versionen, ohne Duplikate oder Standardsprache. Jeder Schlüssel in `block.l10n` und `settings.l10n` muss in dieser Liste stehen.

| Mitglied | Vertrag |
| --- | --- |
| `block.l10n[locale].text` | `Record<string, LocalizedText>`; jeder Wert ist `{ value: string; source: string }` |
| `block.l10n[locale].set` | `Record<string, unknown>` für URLs, Bilder, Stile und andere Überschreibungen; `null` bedeutet, dass die Eigenschaft in dieser Sprache fehlt |
| `block.l10n[locale].hidden` | `true` lässt den Block und seine Nachfahren beim Rendern dieser Sprache aus |
| `settings.l10n[locale]` | `SettingsLocaleLayer`: optionale `text` und `set`, ohne `hidden`; Text umfasst `preheaderText`, Überschreibungen etwa `direction`, Schriften und Farben |

Ein Feldpfad verbindet Eigenschaftsnamen mit `.`. Bei Arrays ist das nächste Segment die `id` des Elements, niemals sein Index: `items.nav-shop.text`, `rows.row-one.cells.cell-one.content`, `fieldValues.heading`, `styles.padding`. Eine Feld-ID ist `<blockId>/<path>` oder `settings/<path>`.

`TRANSLATABLE_FIELDS` listet Textmuster pro Blocktyp; `translatableFields(block, definitions)` setzt Element-IDs und benutzerdefinierte `text`- und `textarea`-Felder ein. `SETTINGS_TRANSLATABLE_FIELDS` listet Einstellungstextpfade. Ein `text`-Pfad benennt immer ein vorhandenes Textfeld. Eine `set`-Überschreibung darf eine optionale Eigenschaft ergänzen, die im Standard fehlt, aber ihr übergeordnetes Objekt muss existieren. Strukturschlüssel (`id`, `type`, `children`, `l10n`) sind ausgeschlossen.

`set` lehnt außerdem `columns` einer Sektion und vollständige integrierte Listenpfade ab: `items` bei Menüs, `rows` und `rows.<id>.cells` bei Tabellen sowie `icons` bei Social-Blöcken. Diese strukturellen Überschreibungen ergeben `invalid_operation`; bearbeiten Sie stattdessen die Eigenschaften einzelner Elemente. Vollständige benutzerdefinierte `fieldValues.<key>`-Überschreibungen bleiben erlaubt.

Ein Pfad steht höchstens in `text` oder `set`; Schreiben in eines entfernt ihn aus dem anderen. Leere Ebenen, `text`, `set`, `l10n` und `settings.locales` werden weggelassen statt als `{}` oder `[]` gespeichert. Exakte Deklarationen stehen unter [Typen](/de/api/types#localization).

## Bearbeitung in einer Sprache

Das Menü **Sprachen** zeigt den Standard und jede Version mit Abdeckung. **Sprache hinzufügen** bietet konfigurierte, noch fehlende Sprachen an. **{language} entfernen** verlangt Bestätigung und entfernt die Ebenen dieser Version; dies lässt sich rückgängig machen.

Text- und Eigenschaftsänderungen in einer Sprachansicht betreffen nur diese Sprache. Hat ein übersetzbares Feld einen Standardwert, speichert eine Bearbeitung `text` mit `source`-Hash. Fehlt der Standardwert, etwa ein nicht vorhandener Preheader, speichert sie eine `set`-Überschreibung ohne Veraltungsprüfung. Ein Wert gleich dem Standard hinterlässt keine Überschreibung.

**Abweichend in {language}** markiert Eigenschaftsüberschreibungen. Das feldbezogene **Zurücksetzen** in der Werkzeugleiste stellt nur dieses Feld aus dem Standard wieder her und erhält benachbarte Überschreibungen. **Zurücksetzen** an der Blockmarkierung entfernt alle `set`-Überschreibungen dieses Blocks; seine `text`-Übersetzungen bleiben erhalten. **In {language} ausblenden** lässt einen Geisterblock auf der Arbeitsfläche stehen; **Anzeigen** stellt ihn wieder her. Der Renderer lässt ausgeblendete Blöcke aus.

Hinzufügen, Verschieben, Löschen, Duplizieren, Einfügen und Ziehen ändern den gemeinsamen Baum für alle Sprachen. Der Editor zeigt **Strukturänderungen gelten für jede Sprache** einmal pro Sitzung und Template. Eine Version in `settings.locales`, die in `localization.locales` fehlt, bleibt auswählbar, schreibgeschützt und als **Nicht aktiviert** markiert: Wert- und Strukturänderungen werden abgelehnt.

Das Löschen eines Basisfelds oder Listenelements entfernt in allen Sprachen Texteinträge mit nicht mehr auflösbarem Pfad und Überschreibungen mit nicht mehr auflösbarem Elternobjekt. Das Entfernen des Standard-Preheaders entfernt daher seine Textübersetzungen. Leere Lokalisierungsfelder entfallen. Rückgängig stellt zuerst die Basis und dann die entfernten Einträge wieder her; das Entfernen einer Sprache und Rückgängig ergeben wieder denselben Inhalt.

Die aktive Sprache ist Ansichtsstatus und wird nicht gespeichert. Sitzungen starten im Standard. `editor.getLocale()` liest sie; `editor.setLocale(tag)` wählt bei aktivierter Lokalisierung den Standard oder eine vorhandene Version. `onLocaleChange(tag)` meldet Wechsel, einschließlich Rückkehr zum Standard nach Entfernen oder Laden eines anderen Templates. Unbekannte Versionen werfen `SdkError` mit Code `unknown_locale`.

## Fehlende Werte {#missing-values}

Eine fehlende Übersetzung fällt auf den Standardsprachwert zurück. Der Block zeigt **Nicht übersetzt**, die Abdeckung meldet das Feld als fehlend und `localization.untranslated` gibt eine Warnung aus. Leere Standardwerte und ausgeblendete Blöcke zählen nicht als fehlend. Eine absichtlich leere Übersetzung ist ein Wert und löst keinen Fallback aus.

## Veraltete Werte {#out-of-date-values}

Jedes `LocalizedText.source` speichert beim Schreiben `sourceHash(defaultValue)`. `sourceHash` ist FNV-1a 32-Bit über UTF-8-Bytes, als acht kleingeschriebene Hexadezimalziffern. Ein geänderter Standard-Hash markiert die Übersetzung **Veraltet** und erzeugt `localization.stale`.

**Beibehalten** erhält den vorhandenen Übersetzungseintrag und aktualisiert seinen Quell-Hash, auch wenn der geänderte Standard inzwischen der Übersetzung entspricht. Die Abdeckung zählt ihn als übersetzt. Ausblenden und Anzeigen erhalten ebenfalls die Texteinträge. **Standard verwenden** entfernt den Ebenenwert des Felds und stellt den Fallback wieder her. Beide Aktionen erhalten benachbarte Überschreibungen. Im Standard zeigt **Veraltete Übersetzungen: {count}** betroffene Blöcke. Eigenschaftsüberschreibungen in `set` haben keinen Quell-Hash.

## Merge-Tags {#merge-tags}

Übernehmen Sie dieselben Merge-Tags einschließlich wiederholter Vorkommen in jedes übersetzte Textfeld. `localization.merge-tags-differ` vergleicht Tag-Multimengen mit dem Standard; der Editor verwendet dieselbe Merge-Tag-Liste in jeder Sprache. Die Regel ist eine Warnung, aber die CLI-Validierung behandelt abweichende Tags als blockierend und beendet mit `1`, auch bei `valid: true`. Fehlende und veraltete Übersetzungen allein bleiben Hinweise.

## Eine Sprache rendern

Mit installiertem `@templatical/types` und `@templatical/renderer` erstellt dieses vollständige TypeScript-Beispiel eine Version, schreibt Text und Richtung, prüft die Abdeckung und rendert deutsches MJML:

<<< @/snippets/localize-template.ts

`renderToMjml(content, { locale })` löst die Sprache vor dem Rendern auf. `editor.toMjml({ locale })` und `editor.toHtml({ locale })` akzeptieren dieselbe optionale Auswahl. Ohne Auswahl wird der Standard gerendert, unabhängig von der aktiven Editoransicht. Lokaler MJML-Export benötigt den optionalen Peer `@templatical/renderer`; HTML benötigt einen Provider mit `render.toHtml` oder `render.compileMjml`. Siehe [Rendering & Export](/de/backend/render).

`resolveLocale(content, locale)` ist rein: Es wendet Text, Überschreibungen und Einstellungen an, entfernt ausgeblendete Blöcke rekursiv, entfernt Lokalisierungsfelder und setzt das projizierte `settings.locale`. Fehlende Werte bleiben beim Standard. Unbekannte Versionen werfen `unknown_locale`. Projizierte Sprache und Richtung bestimmen MJML-`lang` und `dir`. Speichern Sie den Originalinhalt mit allen Versionen statt dieser Projektion.

Die Vorschau lokalisiert die aktive Sprache, setzt das Layout zusammen und ruft dann `resolvePreview` auf. Das zurückgegebene einfache Template wird direkt gerendert. Ein Sprachwechsel verwirft den Cache und Antworten für die vorherige Sprache.

**Benutzerdefinierte Blöcke:** Jeder `text`- oder `set`-Eintrag in der Ebene der angeforderten Sprache entfernt das Standardsprach-`renderedHtml` aus der Projektion. `renderedStylesheet` bleibt erhalten. Übergeben Sie `renderCustomBlock`, um die lokalisierten Felder zu rendern; ohne Callback wird der Block ausgelassen, statt den Standardsprach-Pre-Render anzuzeigen. Blöcke ohne Ebene für diese Sprache behalten ihr zwischengespeichertes HTML. Der Editor-Export lokalisiert vor dem Pre-Rendering und erzeugt übersetztes benutzerdefiniertes HTML. Siehe [Rendering benutzerdefinierter Blöcke](/de/api/renderer-typescript).

## Operationen und Zusammenarbeit

| Operation | Wirkung |
| --- | --- |
| `addLocale` | Fügt eine Version zu `settings.locales` hinzu |
| `removeLocale` | Entfernt die Version und alle zugehörigen Block- und Einstellungsebenen |
| `updateBlockLocale` | Schreibt `text`, `set`, `unset`-Pfade und `hidden` eines Blocks für eine Locale |
| `updateSettingsLocale` | Schreibt `text`, `set` und `unset` von Einstellungen für eine Locale |

Updates wenden zuerst `unset`, dann `text`, dann `set`, dann `hidden` an (nur Blöcke). `expect` prüft die aktuelle Ebene: Eine Abweichung ergibt `precondition_failed`. Ungültige Pfade, nicht übersetzbare `text`-Pfade und ungültige Locale-Operationen ergeben `invalid_operation`. Nur Locale-Operationen ändern Lokalisierungsfelder; generische `updateBlock` und `updateSettings` lehnen sie ab. `addBlock` darf `l10n` enthalten; `setContent` ersetzt alles. Verwenden Sie `applyOperations` und `invertOperations` aus `@templatical/types`.

`BlockLock.locale?: string | null` und `OperationLock.locale?: string | null` verwenden `null` (auch bei fehlender Angabe) für Standardsprache und Struktur. Eine lokalisierte Bearbeitung an (Block X, `de`) kollidiert mit einer Sperre einer anderen Sitzung auf (X, `de`) oder (X, `null`); eine `fr`-Sperre kann parallel bestehen. Jede andere Blockoperation kollidiert mit jeder Sperre einer anderen Sitzung auf X. Provider-Sperrmethoden akzeptieren eine optionale Locale. `onRemoteChange.locale` ist die Sprache der ersten Locale-Operation im Batch, sonst `null`. Exakte Verträge stehen unter [Zusammenarbeit](/de/backend/collaboration).

## Upgrade {#upgrading}

Aktualisieren Sie Renderer, Validator und Kollaborationsbackend **vor** dem Aktivieren von `localization`. Ältere Renderer ignorieren die Felder und rendern den Standard. Ältere strikte Validatoren lehnen `l10n` ab; ältere Kollaborationsbackends lehnen die neuen Operationen als `invalid_operation` ab. Ein Backend, das Sperr-`locale` ignoriert, serialisiert pro Block.

Die Erweiterung ist additiv und optional: Einsprachige Templates benötigen keine Migration und behalten ihr Lade-, Bearbeitungs-, Speicher- und Renderverhalten. Ohne `localization` gibt es keine Sprachen-UI; vorhandene Ebenen bleiben bei Standardsprachbearbeitungen und Speichern erhalten. Der Editor schreibt Lokalisierungsfelder erst nach Konfiguration und Hinzufügen einer Sprache durch den Autor.

## Vollständig getrennte Layouts

Für unabhängige Blockbäume oder Layouts pro Sprache speichern Sie separate Templates und wechseln mit `editor.load(id)`. Sprachversionen teilen eine Struktur.

## Grenzen

- Die Standardsprache lässt sich mit vorhandenen Versionen nicht ändern.
- Die Richtung kann pro Sprache abweichen; automatisches RTL-Spiegeln ist nicht implementiert.
- Wiederholbare Texte benutzerdefinierter Blöcke sind nur als Überschreibung möglich, da ihre Elemente keine IDs haben; überschreiben Sie das gesamte `fieldValues.<key>`.
- Eigene Blöcke eines Layouts (`init({ layout })`) sind nicht lokalisierbar; der Inhalt wird vor dem Zusammensetzen lokalisiert.
- Menüelemente, Tabellenzeilen und Zellen mit `.` in ihrer ID sind nicht lokalisierbar. Vom SDK erstellte IDs enthalten niemals `.`.
- Akzeptierte Tags haben eine Sprache aus 2–3 Buchstaben und optionale alphanumerische Untertags aus 2–8 Zeichen. Private-Use- (`x-…`) und Grandfathered-Tags (`i-…`) werden nicht akzeptiert.
- Der Cloud-Editor unterstützt noch keine Sprachversionen: `initCloud()` ignoriert `localization` und protokolliert eine Warnung.
- Das SDK übersetzt nicht: Sie oder Ihre eigene Pipeline schreiben die Werte.
- In einer Sprachansicht bearbeitet der KI-Chat die Standardsprache; sein Eingabefeld zeigt **Der KI-Chat bearbeitet die Standardsprache.** **Mit KI beheben** und **Alt-Text schreiben** sind in Sprachansichten ausgeblendet.

- Kommentare und Versionshistorie gelten pro Block und Template, nicht pro Sprache.
- Die CLI hat kein Flag für Definitionen benutzerdefinierter Blöcke; deshalb lehnt die Validierung benutzerdefinierte `text`-Pfade ab. Sowohl `validate` als auch `render` validieren ohne Definitionen. Verwenden Sie den Bibliotheksweg unten.
- Lokalisierte benutzerdefinierte Blöcke mit `text`- oder `set`-Einträgen benötigen `renderCustomBlock`; ohne Callback werden sie ausgelassen, auch beim CLI-Rendering von benutzerdefinierten `set`-Überschreibungen. Ihr zwischengespeichertes Standardsprach-HTML wird verworfen; Stylesheets bleiben erhalten.

## Ergebnis prüfen

Für eine gespeicherte `template.json` ohne benutzerdefinierte `text`-Pfade wählen Sie die Sprache in der CLI:

```bash
npx -y @templatical/template-tools validate template.json --locale de --json
npx -y @templatical/template-tools render template.json --locale de --format mjml --out template.de.mjml
```

`validateTemplate` prüft die aufgelösten Blöcke und Einstellungen jeder deklarierten Sprache gegen die normalen Schemas und nennt bei Projektionsfehlern die Locale. Gelöschte Pflichtfelder und ungültige Override-Typen scheitern auch dann, wenn eine andere Sprache für Lint gewählt ist. Ein Fehler im Linter selbst ergibt Exit `2`, mit Diagnose auf stderr und ohne Ergebnisdokument.

`validate --locale de` prüft Struktur und projizierten Inhalt, einschließlich `localization.untranslated`, `localization.stale` und `localization.merge-tags-differ`. Exit `0` bedeutet Erfolg, `1` ungültige Struktur, Fehler-Lint, abweichende Merge-Tags oder eine unbekannte Locale, `2` Fehlbedienung/Toolfehler (einschließlich fehlendem oder leerem `--locale`-Wert) und `3` eine fehlende optionale Abhängigkeit. Eine unbekannte Locale ergibt Exit `1`, schreibt `unknown_locale` auf stderr ohne Ergebnisdokument, auch mit `--json`. Ein fehlender oder leerer `--locale`-Wert ergibt Exit `2`. `valid: true` allein bedeutet nicht Exit `0`. Siehe [Template-Tools](/de/api/template-tools).

Für benutzerdefinierte Übersetzungen kann die CLI weder Definitionen übergeben noch einen eigenen Resolver zum Rendern lokalisierter benutzerdefinierter Blöcke nutzen. Verwenden Sie `validateTemplate(content, definitions)`, danach `lintTemplate(content, { customBlocks: definitions, contentLocale: "de" })` und `renderCustomBlock` zum Rendern. Dieses vollständige TypeScript-Beispiel benötigt `@templatical/types`, `@templatical/template-tools`, `@templatical/quality`, `@templatical/renderer` und `liquidjs`:

<<< @/snippets/localize-custom-block.ts

Prüfen Sie `validation.valid`, lesen Sie `issues` und bestätigen Sie, dass das MJML `Willkommen` statt des zwischengespeicherten `Welcome` enthält. Siehe [Rendering benutzerdefinierter Blöcke](/de/api/renderer-typescript) und die [CLI-Bibliotheks-API](/de/api/template-tools#nutzung-als-bibliothek).

## Im Playground

Das [Sprachen-Setup](https://play.templatical.com/scenes/languages) öffnet ein Template mit deutschem Text, einem anderen Hero-Bild, einem ausgeblendeten Block und einem veralteten Wert. Wechseln Sie zu Deutsch, bearbeiten Sie den Text und kehren Sie zu Englisch zurück, um zu prüfen, dass er unverändert bleibt. Wählen Sie **Keep**, um die Veraltet-Markierung zu entfernen, fügen Sie Französisch hinzu oder wählen Sie Arabisch für Inhalte von rechts nach links.
