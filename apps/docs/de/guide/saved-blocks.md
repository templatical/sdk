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

`savedBlocks` akzeptiert jedes Objekt, das `SavedBlocksProvider` implementiert — vier Methoden, die Promises zurückgeben:

```ts
interface SavedBlocksProvider {
  list(params?: { search?: string }): Promise<SavedBlock[]>;
  create(input: { name: string; content: Block[] }): Promise<SavedBlock>;
  update(
    id: string,
    patch: Partial<{ name: string; content: Block[] }>,
  ): Promise<SavedBlock>;
  delete(id: string): Promise<void>;
}
```

Eine minimale REST-Implementierung:

```ts
import { init } from '@templatical/editor';
import type { SavedBlocksProvider } from '@templatical/editor';

const json = (res: Response) => {
  if (!res.ok) throw new Error(`Anfrage für gespeicherte Blöcke fehlgeschlagen: ${res.status}`);
  return res.json();
};

const savedBlocks: SavedBlocksProvider = {
  list: ({ search } = {}) =>
    fetch(`/api/saved-blocks?search=${encodeURIComponent(search ?? '')}`).then(json),

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
  created_at?: string;   // optional — nur Anzeige, ohne Einfluss auf die Reihenfolge
  updated_at?: string;
}
```

Vier Punkte des Vertrags sind wichtig:

- **Die `id` gehört Ihrem Speicher.** Der Editor erzeugt keine eigene, sondern verwendet, was `create()` zurückgibt. Grenzen Sie Einträge pro Nutzer, pro Team oder pro Konto ab, wie Sie möchten — für den Editor macht das keinen Unterschied.
- **Umbenennen ist `update(id, { name })`.** Es gibt keine separate Rename-Methode; `update` nimmt ein partielles Patch-Objekt.
- **Die Reihenfolge liegt bei Ihnen.** Der Editor stellt die Einträge genau in der Reihenfolge dar, die `list()` zurückgibt, und sortiert nie um — weder nach Datum noch nach Name. Die Suche filtert die Liste, ohne sie umzuordnen. Sortieren Sie serverseitig, wie Sie möchten.
- **Zeitstempel dienen nur der Anzeige.** Jeder Eintrag zeigt eine relative Angabe wie „vor 5 Min." (aus `updated_at`, ersatzweise `created_at`); das absolute Datum erscheint beim Überfahren. Auf die Reihenfolge haben sie keinen Einfluss. Beide Felder sind optional — ohne sie entfällt einfach die Angabe.

### Fehlerbehandlung

Jede Methode kann ablehnen. Der Editor meldet den Fehler über den `onError`-Callback des Editors und lässt seine Liste im Speicher unverändert — ein fehlgeschlagenes Löschen lässt einen Block also nicht aus der Oberfläche verschwinden. Der Speicherdialog zeigt die Fehlermeldung zusätzlich direkt an.

## Was Nutzer sehen

Sobald ein Provider konfiguriert ist:

- **Speichern** — eine Lesezeichen-Aktion in der Hover-Leiste jedes Blocks öffnet einen Dialog, in dem der Block benannt und ausgewählt wird, welche Blöcke der obersten Ebene enthalten sein sollen.
- **Durchsuchen** — sobald mindestens ein Block gespeichert ist, erscheint ein Eintrag in der linken Leiste, der einen durchsuchbaren Browser mit Live-Vorschau öffnet.
- **Einfügen** — wählen Sie eine Position (am Anfang, nach einem bestehenden Block oder am Ende) und fügen Sie ein. Eingefügte Blöcke erhalten immer **neue IDs**, sodass zweimaliges Einfügen desselben Eintrags nie kollidiert.
- **Umbenennen / Löschen** — direkt in jeder Zeile des Browsers; das Löschen wird zuvor bestätigt.

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
  load,        // (search?) => Promise<void>
  create,      // (name, content) => Promise<SavedBlock>
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
