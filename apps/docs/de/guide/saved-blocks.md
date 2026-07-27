---
title: Gespeicherte Blöcke
description: Ermöglichen Sie Ihren Nutzern, wiederverwendbare Blockgruppen zu speichern und in andere Vorlagen einzufügen — mit Ihrem eigenen Speicher.
---

# Gespeicherte Blöcke

Gespeicherte Blöcke ermöglichen es Ihren Nutzern, eine Gruppe von Blöcken festzuhalten — einen Header, einen Footer, ein Produktraster, einen CTA — und sie in jede andere Vorlage einzufügen.

Der Editor übernimmt das gesamte Erlebnis: eine Speicheraktion an jedem Block, einen durchsuchbaren Browser mit Live-Vorschau, Einfügen an beliebiger Position, Umbenennen und Löschen. **Der Speicher liegt bei Ihnen.** Implementieren Sie eine kleine Provider-Schnittstelle für Ihre eigene API, und die Funktion wird aktiv.

::: tip Nicht dasselbe wie benutzerdefinierte Blöcke
[Benutzerdefinierte Blöcke](/de/guide/custom-blocks) sind *von Entwicklern definierte Blocktypen* mit eigener Vorlage und eigenen Feldern. Gespeicherte Blöcke sind *Instanzen* gewöhnlicher Blöcke, die Endnutzer speichern und wiederverwenden. Beide sind voneinander unabhängig.
:::

## Schnellstart

Am schnellsten probieren Sie es mit dem mitgelieferten browserlokalen Provider aus — ohne Backend:

```js
import { init, createLocalStorageSavedBlocksProvider } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  savedBlocks: createLocalStorageSavedBlocksProvider(),
});
```

Damit werden Einträge im `localStorage` unter `templatical:saved-blocks` gespeichert. Geeignet für Demos, Prototypen und die Nutzung auf einem einzelnen Gerät — die Einträge liegen in einem Browserprofil, werden nicht zwischen Geräten oder Nutzern synchronisiert und verschwinden, wenn die Websitedaten gelöscht werden. Für den Produktivbetrieb stellen Sie Ihren eigenen Provider bereit.

## Eigenen Speicher anbinden

`savedBlocks` akzeptiert jedes Objekt, das `SavedBlocksProvider` implementiert — vier Mitglieder. `list` ist eine Methode; jede Mutation ist **entweder eine Funktion oder `false`**:

```ts
interface SavedBlocksProvider {
  list(params?: { search?: string; category?: string }): Promise<SavedBlock[]>;

  create: false | ((input: SavedBlockInput) => Promise<SavedBlock>);
  update: false | ((id: string, patch: SavedBlockPatch) => Promise<SavedBlock>);
  delete: false | ((id: string) => Promise<void>);
}
```

Mit `false` teilen Sie dem Editor mit, dass die aktuelle Person diese Aktion nicht ausführen darf; er blendet das Bedienelement dann aus, statt einen Versuch zuzulassen, der scheitern muss. Die drei sind absichtlich erforderlich und nicht optional: Das Abschalten soll eine Entscheidung sein, die Sie festhalten — nicht etwas, das durch eine vergessene Methode entsteht.

Eine minimale REST-Implementierung:

```ts
import { init } from '@templatical/editor';
import type { SavedBlocksProvider } from '@templatical/editor';

const json = (res: Response) => {
  if (!res.ok) throw new Error(`Anfrage für gespeicherte Blöcke fehlgeschlagen: ${res.status}`);
  return res.json();
};

const savedBlocks: SavedBlocksProvider = {
  // Geben Sie alles zurück, was die aktuelle Nutzerin sehen darf — grenzen Sie
  // hier nach Nutzer, Team oder Konto ab. Der Editor ruft diese Methode ohne
  // Argumente auf und filtert im Browser; Sie müssen Suche und Kategoriefilter
  // also nicht selbst implementieren.
  list: () => fetch('/api/saved-blocks').then(json),

  create: (input) =>
    fetch('/api/saved-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then(json),

  update: (id, patch) =>
    fetch(`/api/saved-blocks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(json),

  delete: (id) =>
    fetch(`/api/saved-blocks/${id}`, { method: 'DELETE' }).then((res) => {
      if (!res.ok) throw new Error(`Löschen fehlgeschlagen: ${res.status}`);
    }),
};

await init({ container: '#editor', savedBlocks });
```

### Die Datenstruktur

```ts
interface SavedBlock {
  id: string;            // von Ihrem Speicher zugewiesen, von create() zurückgegeben
  name: string;
  content: Block[];      // Blöcke der obersten Ebene; eine Section enthält ihre eigenen Kinder
  category?: string;     // optional — freie Gruppierung, steuert den Filter im Browser
  canUpdate?: boolean;   // optional — fehlt = erlaubt; false verbietet
  canDelete?: boolean;
  createdAt?: string;    // optional — nur Anzeige, ohne Einfluss auf die Reihenfolge
  updatedAt?: string;
}
```

Fünf Punkte des Vertrags sind wichtig:

- **Die `id` gehört Ihrem Speicher.** Der Editor erzeugt keine eigene, sondern verwendet, was `create()` zurückgibt. Grenzen Sie Einträge pro Nutzer, pro Team oder pro Konto ab, wie Sie möchten — für den Editor macht das keinen Unterschied.
- **Umbenennen ist `update(id, { name })`, Umkategorisieren `update(id, { category })`.** Es gibt für beides keine separate Methode; `update` nimmt ein partielles Patch-Objekt.
- **Die Reihenfolge liegt bei Ihnen.** Der Editor stellt die Einträge genau in der Reihenfolge dar, die `list()` zurückgibt, und sortiert nie um — weder nach Datum noch nach Name. Das Filtern grenzt die Liste ein, ohne sie umzuordnen. Sortieren Sie serverseitig, wie Sie möchten.
- **Das Filtern übernimmt der Editor, nicht Sie.** Suchfeld und Kategoriefilter des Browsers arbeiten im Speicher auf dem, was `list()` zurückgegeben hat — ein Provider, der einfach ein Array liefert, erhält beides ohne Zutun. `list()` akzeptiert zwar ein `{ search, category }`-Objekt, doch der Editor sendet es nie; es kommt nur an, wenn Sie `useSavedBlocks` selbst ansteuern (siehe [Headless-Nutzung](#headless-nutzung)). Welche Einträge jemand überhaupt sehen darf, entscheiden weiterhin ausschließlich Sie in `list()`.
- **Sie entscheiden, wer was ändern darf.** Übergeben Sie `false` für `create`, `update` oder `delete`, um die Aktion vorzuenthalten, und setzen Sie `canUpdate` / `canDelete` an einzelnen Einträgen für Ausnahmen. Siehe [Berechtigungen steuern](#berechtigungen-steuern).
- **Zeitstempel dienen nur der Anzeige.** Jeder Eintrag zeigt eine relative Angabe wie „vor 5 Min." (aus `updatedAt`, ersatzweise `createdAt`); das absolute Datum erscheint beim Überfahren. Auf die Reihenfolge haben sie keinen Einfluss. Beide Felder sind optional — ohne sie entfällt einfach die Angabe.

### Berechtigungen steuern

Zwei unabhängige Hebel, beide in Ihrer Hand:

**Eine ganze Fähigkeit vorenthalten**, indem Sie `false` statt einer Funktion übergeben. Der Editor blendet aus, was er nicht kann — keine Lesezeichen-Aktion an Blöcken, wenn `create` aus ist (und damit gar kein Speicherablauf), kein Umbenennen bei `update: false`, kein Löschen bei `delete: false`.

```ts
const savedBlocks: SavedBlocksProvider = {
  list: () => fetch('/api/saved-blocks').then(json),

  // Diese Person darf hinzufügen, aber Bestehendes nie ändern oder entfernen.
  create: (input) => post('/api/saved-blocks', input),
  update: false,
  delete: false,
};
```

**Einen einzelnen Eintrag ausnehmen**, indem Sie `canUpdate` / `canDelete` mitliefern. Fehlt der Wert, ist die Aktion erlaubt — die Felder dienen ausschließlich dem Verbieten, Sie setzen sie also nur bei den Ausnahmen. Liefern Sie sie aus Ihrer API, wo die Antwort ohnehin bekannt ist; der Editor ermittelt nichts selbst und zieht Ihre Angabe nicht in Zweifel.

```json
[
  { "id": "1", "name": "Mein Header", "content": [] },
  { "id": "2", "name": "Team-Footer", "content": [], "canUpdate": false, "canDelete": false }
]
```

Damit entsteht eine Bibliothek, in der die Person den eigenen Eintrag bearbeiten und den geteilten nur einfügen kann. Die beiden Hebel greifen nur in einer Richtung zusammen: `canUpdate: true` kann ein als `false` übergebenes `update` nicht wieder aktivieren — die Fähigkeit hat Vorrang.

#### Eine schreibgeschützte Bibliothek

Setzen Sie alle drei auf `false`, erhalten Sie eine kuratierte Bibliothek, die Nutzer durchsehen, in der Vorschau ansehen und einfügen, aber nie verändern können:

```ts
const savedBlocks: SavedBlocksProvider = {
  list: () => fetch('/api/saved-blocks').then(json),
  create: false,
  update: false,
  delete: false,
};
```

Das Einfügen funktioniert weiterhin, denn es berührt ausschließlich die Arbeitsfläche — Ihren Speicher erreicht dabei nichts. `list` ist das einzige Mitglied, das sich nicht abschalten lässt; ohne es hätte die Funktion nichts zu zeigen.

::: tip Bedienelemente, keine Sicherheitsgrenze
Ein ausgeblendetes Element verhindert, dass der Editor die Aktion anbietet — es hält niemanden auf, der es darauf anlegt. Erzwingen Sie Berechtigungen zusätzlich in Ihrer API: Die Provider-Methoden laufen im Browser der Nutzerin.
:::

### Fehlerbehandlung

Jede Methode kann ablehnen. Der Editor meldet den Fehler über den `onError`-Callback des Editors und lässt seine Liste im Speicher unverändert — ein fehlgeschlagenes Löschen lässt einen Block also nicht aus der Oberfläche verschwinden. Der Speicherdialog zeigt die Fehlermeldung zusätzlich direkt an.

## Was Nutzer sehen

Sobald ein Provider konfiguriert ist:

- **Speichern** — beim Auswählen eines Blocks der obersten Ebene erscheint eine Lesezeichen-Aktion, die eine *Auswahl-Sitzung* startet: dieser Block ist ausgewählt, weitere kommen per einfachem Klick hinzu oder fallen wieder heraus (ohne Zusatztasten). Eine Leiste über der Arbeitsfläche zeigt die Anzahl mit „Speichern" und „Abbrechen"; anschließend öffnet sich ein Dialog, der den Namen erfragt und die ausgewählten Blöcke in einer Vorschau zeigt. Esc bricht ab, Enter bestätigt.
  Die Vorschau listet die Blöcke in der Reihenfolge auf, in der Sie sie ausgewählt haben. Jede Zeile hat einen Anfasser, mit dem Sie sie ziehen können — oder Pfeil nach oben / Pfeil nach unten, während der Anfasser fokussiert ist —, sodass Sie vor dem Speichern umsortieren können. In der Reihenfolge, in der die Liste am Ende steht, werden die Blöcke gespeichert. Ein Klick innerhalb einer Section wählt die gesamte Section aus — Section-Kinder sind nicht einzeln speicherbar, da eine Section ihre Spalten samt Inhalt mitnimmt.
  Der Dialog fragt zusätzlich eine optionale **Kategorie** ab und schlägt dabei die bereits verwendeten vor.
- **Durchsuchen** — sobald mindestens ein Block gespeichert ist, erscheint ein Eintrag in der linken Leiste, der einen durchsuchbaren Browser mit Live-Vorschau öffnet.
- **Kategorisieren** — eine Kategorie ist freier Text, flach und optional; es gibt weder Ordner noch Verschachtelung. Sobald irgendetwas kategorisiert ist, zeigt der Browser einen Kategoriefilter mit genau den verwendeten Kategorien — eine Kategorie existiert so lange, wie ein Eintrag sie trägt. Suche und Kategoriefilter grenzen die Liste gemeinsam ein.
- **Einfügen** — wählen Sie eine Position (am Anfang, nach einem bestehenden Block oder am Ende) und fügen Sie ein. Eingefügte Blöcke erhalten immer **neue IDs**, sodass zweimaliges Einfügen desselben Eintrags nie kollidiert.
- **Umbenennen / Umkategorisieren / Löschen** — direkt in jeder Zeile des Browsers; die Bearbeitungszeile umfasst Name und Kategorie, und ein leeres Kategoriefeld hebt die Kategorisierung auf. Das Löschen wird zuvor bestätigt.

## Standardmäßig deaktiviert

Lassen Sie `savedBlocks` weg, und die Funktion ist vollständig abwesend: keine Speicheraktion, kein Eintrag in der Leiste und **kein zugehöriger Code wird geladen**. Die Oberfläche ist in verzögert geladene Chunks aufgeteilt, die erst beim Öffnen eines Dialogs abgerufen werden — wer gespeicherte Blöcke nicht nutzt, zahlt also nichts dafür.

## Templatical Cloud

Mit [`initCloud()`](/de/cloud/getting-started) sind gespeicherte Blöcke automatisch an das Cloud-Backend angebunden — serverseitig persistiert und im Team geteilt, getrennt pro Projekt und Mandant. Sie übergeben keinen Provider; Cloud stellt seine eigene Implementierung derselben Schnittstelle bereit.

Deaktivieren Sie die Funktion explizit, wenn Sie sie nicht möchten:

```js
await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  savedBlocks: false,
});
```

In Cloud hängt die Verfügbarkeit zusätzlich von Ihrem Tarif ab — enthält ein Tarif keine gespeicherten Blöcke, bleibt die Oberfläche ausgeblendet.

## Headless-Nutzung

Die reaktive Zustandsebene wird aus `@templatical/core` exportiert, falls Sie eine eigene Oberfläche über einem Provider bauen möchten:

```ts
import { useSavedBlocks } from '@templatical/core';

const {
  savedBlocks, // Ref<SavedBlock[]>
  isLoading,   // Ref<boolean>
  categories,  // ComputedRef<string[]> — verwendete Kategorien, sortiert
  canCreate,   // ComputedRef<boolean> — hat der Provider create geliefert?
  canUpdate,
  canDelete,
  canUpdateBlock, // (block) => boolean — Fähigkeit UND das Flag des Eintrags
  canDeleteBlock,
  load,        // (params?: { search?, category? }) => Promise<void>
  create,      // (name, content, category?) => Promise<SavedBlock>
  update,      // (id, patch) => Promise<SavedBlock>
  remove,      // (id) => Promise<void>
} = useSavedBlocks({
  provider,
  onError: (error) => {
    /* behandeln */
  },
});
```

Die Liste bleibt nach jedem erfolgreichen Aufruf synchron — beim Erstellen vorangestellt, beim Aktualisieren ersetzt, beim Löschen entfernt — und Fehler werden nach der Meldung an `onError` erneut geworfen.

Prüfen Sie `canCreate` / `canUpdateBlock` / `canDeleteBlock`, bevor Sie eine Aktion in Ihrer eigenen Oberfläche anbieten. Der Aufruf einer Mutation, die der Provider vorenthält — oder die ein Eintrag verbietet —, wird abgelehnt statt still erfüllt, sodass niemand eine Ablehnung für ein Speichern halten kann.
