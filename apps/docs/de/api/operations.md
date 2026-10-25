---
title: Operationen
description: Das Operations-Vokabular, das Editor, CLI, Collaboration-Backends und Templatical Cloud teilen.
---

# Operationen

Eine Operation ist eine Änderung an einem Template: einen Block hinzufügen, verschieben, löschen oder ändern, die Einstellungen ändern oder den ganzen Inhalt ersetzen. Dieselben sechs Operationen sind überall unterwegs, wo sich ein Template außerhalb eines einzelnen Editors ändert:

- **[Zusammenarbeit](/de/backend/collaboration)** — ein Editor mit `init({ collaboration })` schickt jede Änderung als Batch von Operationen an Ihr Backend und wendet die Batches anderer an.
- **Die CLI** — `template-tools edit` wendet sie auf eine Template-Datei an.
- **Templatical Cloud** — speichert jeden Batch mit seiner Revision, und mit seinem MCP-Server verbundene KI-Agenten bearbeiten mit demselben Vokabular über `edit_template`.

`applyOperations` aus `@templatical/types` (MIT) wendet sie an. Der Server von Templatical Cloud verwendet eine Engine mit denselben Regeln, und gemeinsame Testfälle halten beide identisch.

## Die sechs Operationen

```json
{"op": "addBlock",       "block": {"id": "b2", "type": "paragraph", "content": "<p>Hi</p>", "styles": {"padding": {"top": 0, "right": 0, "bottom": 0, "left": 0}}}, "parent": null, "after": "b1"}
{"op": "moveBlock",      "blockId": "b2", "parent": {"sectionId": "s1", "column": 0}, "after": null}
{"op": "deleteBlock",    "blockId": "b2"}
{"op": "updateBlock",    "blockId": "b1", "set": {"content": "<p>Hello</p>"}, "unset": ["visibility"]}
{"op": "updateSettings", "set": {"width": 640}, "unset": ["preheaderText"]}
{"op": "setContent",     "content": {"blocks": [], "settings": {"width": 600, "backgroundColor": "#ffffff", "textColor": "#1a1a1a", "linkUnderline": true, "fontFamily": "Arial", "locale": "en"}}}
```

Die Annahme einer Operation durch die Engine ersetzt keine Schema-Validierung: Führen Sie `template-tools validate` für das resultierende Template aus.

Ein Batch ist eine Liste von Operationen. Er wird der Reihe nach angewendet, jede Operation sieht die vorherigen, und alles oder nichts: Wird eine abgelehnt, gilt keine Operation des Batches.

### Positionen

Positionen nennen einen Nachbarblock, nie einen Index, sodass eine Operation dasselbe bedeutet, auch wenn vorher die Änderung eines anderen ankommt.

- `parent` ist `null` für die oberste Ebene oder `{"sectionId": "…", "column": 0}` für eine Spalte einer Sektion. `column` ist ein 0-basierter Index in die `children` der Sektion.
- `after` ist die ID des Blocks, hinter dem der Block landet, oder `null`, damit er als erster landet. Bei `moveBlock` zählen die Nachbarn im Zielcontainer ohne den verschobenen Block.
- `parent` und `after` sind bei `addBlock` und `moveBlock` Pflicht, auch wenn sie `null` sind.

### Sektionen und Spalten

- Eine Sektion steht nur auf der obersten Ebene. Eine Sektion in eine Spalte hinzuzufügen oder zu verschieben wird abgelehnt, ebenso eine neue Sektion mit einer Sektion unter ihren Kindern.
- `deleteBlock` auf einer Sektion löscht ihre Blöcke mit.
- `updateBlock` ersetzt jeden Schlüssel in `set` vollständig, ein `styles`-Objekt eingeschlossen, und entfernt die Schlüssel in `unset`. `id`, `type` und `children` lassen sich weder setzen noch entfernen, und `columns` einer Sektion lässt sich nicht entfernen.
- `set: {"columns": …}` auf einer Sektion passt ihre `children` an die Spaltenzahl des Layouts an: `"1"` hat eine Spalte, `"3"` hat drei, jedes andere Layout (`"2"`, `"2-1"`, `"1-2"`) hat zwei. Beim Vergrößern kommen leere Spalten hinzu. Beim Verkleinern fallen hintere Spalten nur weg, wenn sie leer sind; verschieben Sie ihre Blöcke also zuerst.
- Ein neuer Block braucht eine nicht leere String-`id` und einen String-`type`, und jede ID darin, die Kinder einer neuen Sektion eingeschlossen, muss im Template neu sein.

### Vorbedingungen

Jede Operation außer `addBlock` und `setContent` kann `expect` mitführen, das gelten muss, bevor sie angewendet wird. Bei einer Abweichung wird die Operation mit `precondition_failed` abgelehnt. Rückgängig nutzt das: Ein Rückgängig-Schritt, den die Änderung eines anderen überholt hat, wird abgelehnt, statt sie zu überschreiben.

- `updateBlock` und `updateSettings`: `expect` ordnet Schlüsseln ihre erwarteten aktuellen Werte zu. `null` passt zu einem `null`-Wert oder einem fehlenden Schlüssel.
- `moveBlock`: `expect.parent` und `expect.after` sind die aktuelle Position des Blocks. Ein fehlender Schlüssel zählt als `null`.
- `deleteBlock`: `expect.block` ist der ganze aktuelle Block, Kinder eingeschlossen, exakt verglichen.
- Werte werden wie JSON verglichen: Die Reihenfolge der Objektschlüssel spielt keine Rolle, Arrays werden der Reihe nach verglichen und Zahlen nach Wert, sodass `1` gleich `1.0` ist. `set`, `unset` und `expect` mit dem Wert `null` zählen als nicht angegeben.

### Sperren

Ein Backend übergibt die Sperren, die es hält, und die handelnde Sitzung: `applyOperations(content, ops, { locks, session })`, mit `locks` als `[{ blockId, sessionId }]`.

- `updateBlock`, `moveBlock` und `deleteBlock` auf einem Block, den eine andere Sitzung hält, werden mit `lock_held` abgelehnt. Beim Verschieben oder Löschen einer Sektion zählt auch jeder Block darin.
- `setContent` wird mit `locked_by_others` abgelehnt, solange eine andere Sitzung eine Sperre hält.
- Mit `session` gleich `null` (eine serverseitige Änderung) gehört jede Sperre jemand anderem.

<!-- locale-operations:start -->
## Locale-Operationen

`addLocale`, `removeLocale`, `updateBlockLocale` und `updateSettingsLocale` verwalten Sprachversionen im gemeinsamen Baum des SDK. Cloud-Backends und gehostetes MCP unterstützen diese Operationen nicht; aktualisieren Sie Renderer, Validator und Collaboration-Backend, bevor Sie lokalisierte Inhalte speichern.

Der folgende Batch beginnt mit Absatz `b1` mit `<p>Original</p>`, Standardsprache `en`, Richtung `ltr` und ohne Sprachversionen. Er fügt Deutsch hinzu, schreibt einen deutschen Wert, blendet den Block auf Deutsch aus, überschreibt die Richtung und entfernt dann Deutsch samt seinen Ebenen. `source` ist `sourceHash("<p>Original</p>")`.

```json
{"op":"addLocale","locale":"de"}
{"op":"updateBlockLocale","blockId":"b1","locale":"de","text":{"content":{"value":"<p>Hallo</p>","source":"f898b751"}},"hidden":true}
{"op":"updateSettingsLocale","locale":"de","set":{"direction":"rtl"}}
{"op":"removeLocale","locale":"de","expect":{"blocks":{"b1":{"text":{"content":{"value":"<p>Hallo</p>","source":"f898b751"}},"hidden":true}},"settings":{"set":{"direction":"rtl"}}}}
```

| Operation | Vertrag |
|---|---|
| `addLocale` | `locale: string`; `position?: number` fügt in `settings.locales` ein, standardmäßig am Ende. Die Position muss eine Ganzzahl von 0 bis zur aktuellen Länge sein. Standard (`settings.locale ?? "en"`) und vorhandene Versionen werden ohne Beachtung der Groß-/Kleinschreibung abgelehnt. |
| `removeLocale` | `locale: string`; `expect?: { blocks: Record<string, BlockLocaleLayer>; settings?: SettingsLocaleLayer }` vergleicht alle Ebenen exakt. `blocks` enthält Ebenen nach Block-ID; eine fehlende ID bedeutet keine Ebene. Das separate Feld `settings` enthält die Einstellungsebene; fehlt es, gibt es keine. `expect: { blocks: {} }` verlangt keine Block- oder Einstellungsebenen, auch bei einem Block namens `"settings"`. Entfernt die Sprache und alle Block- und Einstellungsebenen, auch in Spalten. |
| `updateBlockLocale` | `blockId: string`; `locale: string`; `text?: Record<string, LocalizedText>`; `set?: Record<string, unknown>`; `unset?: string[]`; `hidden?: boolean`; `expect?: LocaleLayerExpect`. Mindestens ein Änderungsfeld muss vorhanden sein. |
| `updateSettingsLocale` | `locale: string`; `text?: Record<string, LocalizedText>`; `set?: Record<string, unknown>`; `unset?: string[]`; `expect?: Omit<LocaleLayerExpect, "hidden">`. Mindestens ein Änderungsfeld muss vorhanden sein. Kein Ausblendestatus und keine Sperren. |

`locale` muss `isLocaleTag` erfüllen: `/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/`. Tags außerhalb dieses Musters, darunter `x-acme` und `i-klingon`, werden abgelehnt. Jede Operation außer dem Hinzufügen verlangt den exakten Tag in `settings.locales`; ungültige Tags und unbekannte Versionen ergeben `invalid_operation`.

`LocalizedText` ist `{ value: string; source: string }`. Textpfade müssen `TRANSLATABLE_FIELDS` des Blocktyps oder `SETTINGS_TRANSLATABLE_FIELDS` (`preheaderText`) für Einstellungen entsprechen und in der Basis auflösbar sein. Pfade verwenden Element-IDs, etwa `items.i1.text`; IDs mit `.` sind nicht adressierbar. Ein `set`-Pfad muss auflösbar sein oder einen vorhandenen Objekt-Elternpfad haben. Prototypsegmente (`__proto__`, `constructor`, `prototype`) und leere Segmente werden abgelehnt. Block-Overrides dürfen nicht mit `id`, `type`, `children` oder `l10n` beginnen; Einstellungs-Overrides nicht mit `locale`, `locales` oder `l10n`.

Die Engine wendet zuerst `unset` an (auf beide Maps), dann `text`, dann `set`, dann `hidden`. Ein Pfad in einer Map wird aus der anderen gelöscht. `hidden: false` entfernt das Flag. Leere Maps, Ebenen und Lokalisierungscontainer werden weggelassen; das Entfernen der letzten Version lässt `settings.locales` weg.

`set: { path: null }` speichert einen löschenden Override: Die Eigenschaft fehlt in der `resolveLocale`-Projektion dieser Sprache. `unset: [path]` entfernt den Override, sodass wieder der Wert der Standardsprache gilt. Ebenen speichern niemals `undefined`; undefinierte `text`- oder `set`-Einträge und Texteinträge ohne die Strings `value` und `source` werden mit `invalid_operation` abgelehnt. Jeder `unset`-Pfad muss nicht leer sein und `isSafePath` erfüllen, auch wenn der Basispfad nicht mehr existiert; sichere verwaiste Pfade bleiben entfernbar.

### Overrides löschen

Dieser separate Batch beginnt mit Deutsch bereits in `settings.locales`, Block `b1` mit `styles.backgroundColor: "#ffffff"` und Einstellungen mit `linkColor: "#1d4ed8"`. Die ersten beiden Operationen lassen diese Eigenschaften auf Deutsch fehlen. Die letzten beiden entfernen die löschenden Overrides und stellen die Standardwerte wieder her. Die Basiswerte bleiben unverändert.

```json
{"op":"updateBlockLocale","blockId":"b1","locale":"de","set":{"styles.backgroundColor":null}}
{"op":"updateSettingsLocale","locale":"de","set":{"linkColor":null}}
{"op":"updateBlockLocale","blockId":"b1","locale":"de","unset":["styles.backgroundColor"]}
{"op":"updateSettingsLocale","locale":"de","unset":["linkColor"]}
```

`LocaleLayerExpect` ist `{ text?: Record<string, LocalizedText | null>; set?: Record<string, unknown>; hidden?: boolean }`. Text- und Override-Prüfungen vergleichen den aktuellen Ebenenwert, fehlende Werte zählen als `null`. Eine Ausblendeprüfung vergleicht `layer.hidden === true`. Eine Abweichung ergibt `precondition_failed`. Block-Locale-Updates prüfen Form, benannten Block (`block_missing`), Pfade, Sperren, Vorbedingungen und dann die Änderung.

Eine Sperre kann `locale?: string | null` tragen. Eine fehlende oder `null`-Locale sperrt Standard und Struktur. Ein Block-Locale-Update kollidiert mit der Sperre einer anderen Sitzung auf demselben Block und derselben Sprache oder auf der Struktur (`lock_held`, mit `blockId`). Verschiedene Sprachen können gleichzeitig bearbeitet werden. Strukturelle Block-Updates, Verschieben und Löschen kollidieren mit jeder Locale-Sperre auf den betroffenen Blöcken. Hinzufügen und Entfernen von Sprachen sowie Einstellungs-Locale-Updates ignorieren Sperren.

Nur Locale-Operationen ändern bestehende Lokalisierungscontainer: `updateBlock` lehnt `l10n` in `set` oder `unset` ab; `updateSettings` lehnt `locales` und `l10n` ab und verbietet das Setzen oder Entfernen von `locale`, solange Versionen existieren (`invalid_operation`). `addBlock` darf `l10n` mitbringen, `setContent` ersetzt alles.

`invertOperations` schützt das Rückgängigmachen. Die Umkehrung von `addLocale` verlangt leere Ebenen. Die Umkehrung von `removeLocale` stellt die alte Listenposition, dann Block- und Einstellungsebenen mit Prüfungen auf leere Pfade wieder her. Umkehrungen von Locale-Updates stellen beide Maps und den Ausblendestatus wieder her und erwarten die Werte der Vorwärtsoperation.

### Prüfung

Führen Sie `pnpm --filter @templatical/types exec vitest run tests/operations.test.ts tests/invert-operations.test.ts` für gemeinsame Fixtures und geschützte Umkehrungen aus. Führen Sie `template-tools validate` für das resultierende Template aus; die Engine-Annahme validiert das Schema nicht.
<!-- locale-operations:end -->

## Fehler

Ein abgelehnter Batch wirft einen `OperationError` mit `code` und `opIndex`, dem 0-basierten Index der abgelehnten Operation.

| Code | Wann | Templatical Cloud antwortet |
|---|---|---|
| `block_exists` | Die ID eines neuen Blocks oder eine ID darin gibt es im Template schon | 409 |
| `block_missing` | Der Block oder die Eltern-Sektion fehlt | 409 |
| `anchor_missing` | Der `after`-Block ist nicht im Zielcontainer | 409 |
| `precondition_failed` | `expect` gilt nicht | 409 |
| `lock_held` | Eine andere Sitzung hält den Block | 409 |
| `locked_by_others` | Eine andere Sitzung hält eine Sperre, bei `setContent` | 409 |
| `invalid_operation` | Die Operation ist fehlerhaft oder kann nie gelten | 422 |

### Welcher Fehler gewinnt

Verletzt eine Operation mehrere Regeln, entscheidet die erste fehlschlagende Prüfung:

1. Ihre Form (`invalid_operation`): eine fehlerhafte Operation, ein fehlender Pflichtschlüssel, eine neue Sektion mit Eltern, `id`/`type`/`children` in `set` oder `unset`, `columns` einer Sektion in `unset`.
2. Die Blöcke, die sie nennt (`block_missing`, `block_exists`).
3. Sperren (`lock_held`, `locked_by_others`).
4. Vorbedingungen (`precondition_failed`).
5. Platzierung (`invalid_operation`): eine Sektion in eine Spalte, ein Block hinter sich selbst.
6. Der Zielcontainer: `block_missing` für eine fehlende Eltern-Sektion; `invalid_operation` für Eltern, die keine Sektion sind, oder eine Spalte außerhalb des Bereichs.
7. Der Anker (`anchor_missing`).
8. Die Änderung selbst (`invalid_operation`): ein Layout, das Spalten mit Blöcken wegfallen ließe.

## Operationen anwenden

```ts
import {
  applyOperations,
  OperationError,
  type Operation,
} from '@templatical/types';

const ops: Operation[] = [
  { op: 'updateBlock', blockId: 'b1', set: { content: '<p>Hello</p>' } },
];

try {
  const next = applyOperations(template.content, ops, {
    locks: [{ blockId: 'b4', sessionId: 'f7c1…' }],
    session: requestSessionId,
  });
  // `next` speichern
} catch (error) {
  if (error instanceof OperationError) {
    // error.code, error.opIndex
  }
  throw error;
}
```

`applyOperations` liefert ein neues Dokument und verändert das übergebene nie. `applyOperationsInPlace` ändert es direkt, für eine Kopie, die Sie verwerfen können. `getColumnCount(layout)` ist die Layout-Regel von oben.

## In der CLI

```bash
npx -y @templatical/template-tools edit emails/welcome.json \
  --op '{"op":"updateBlock","blockId":"button_1","set":{"backgroundColor":"#1d4ed8"}}'
```

`--ops <file>` nimmt ein JSON-Array für einen Batch. Siehe [Template Tools](/de/api/template-tools).
