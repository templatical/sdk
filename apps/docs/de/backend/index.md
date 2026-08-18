---
title: Backend anbinden
description: Speichern, Versionsverlauf, Kommentare, gespeicherte Blöcke, Test-E-Mails und Rendering sind jeweils ein Konfigurationsschlüssel mit Methoden, die Sie implementieren — gegen Ihren eigenen Stack oder gegen Templatical Cloud.
---

# Backend anbinden

Der Editor bearbeitet eine Vorlage. Wo diese Vorlage gespeichert wird, wie ihre Vergangenheit aussieht, wer sie kommentiert hat, wohin ein Testversand geht, wie daraus versandfertiges HTML wird — all das liegt in Ihrem Stack, und der Editor erreicht es über ein einfaches Objekt, das Sie an `init()` übergeben.

Dieses Objekt ist ein **Provider**. Es gibt sechs davon, alle sind optional, und alle funktionieren gleich.

## Die sechs Provider

```ts
import { init } from '@templatical/editor';

await init({
  container: '#editor',

  templates: myTemplateStore, // speichern und laden
  versionHistory: myVersionStore, // frühere Stände — ansehen, Vorschau, wiederherstellen
  comments: myCommentStore, // Review in Threads, pro Block verankert
  savedBlocks: myBlockLibrary, // wiederverwendbare Blockgruppen
  testEmail: mySender, // diese Vorlage an eine Person mailen
  render: myRenderer, // MJML- und HTML-Ausgabe
});
```

Jeder Schlüssel steht für sich, und jede Funktion **fehlt, solange Sie ihren Schlüssel nicht übergeben**: kein `versionHistory`, kein Verlaufs-Steuerelement — keine deaktivierte Schaltfläche, kein leeres Panel, und auch der zugehörige Code wird nicht geladen.

`init({ container })` allein ist ein funktionierender Editor, der nichts persistiert.

## Was Sie implementieren

<!-- prettier-ignore -->
| Provider | Das liefert der Editor | Das implementieren Sie |
| --- | --- | --- |
| [Speichern & Laden](/de/backend/templates) | Namensfeld direkt im Header, Speichern-Schaltfläche, Statusanzeige, `Cmd`/`Strg`+`S`, Autosave, Warnung bei ungespeicherten Änderungen | `load` · `create` · `save` |
| [Versionsverlauf](/de/backend/version-history) | Header-Steuerelement, Versionsliste, Vorschau auf der Arbeitsfläche mit eigenem Banner, Wiederherstellen mit Rückfrage | `list` · `get` · `create` · `restore` |
| [Kommentare](/de/backend/comments) | Review-Panel, Threads und Antworten, Zähler-Badges pro Block, Auflösen und Wiederöffnen | `list` · `create` · `update` · `delete` · `setResolved` |
| [Gespeicherte Blöcke](/de/backend/saved-blocks) | Auswahlmodus auf der Arbeitsfläche, durchsuchbarer Browser mit Live-Vorschau, Einfügen an Position, Umbenennen, Löschen | `list` · `create` · `update` · `delete` |
| [Test-E-Mails](/de/backend/test-email) | Auslöser im Header, Empfängersteuerung, Formatprüfung, exakte Vorschau, Versand- und Fehlerzustände | `send` |
| [Rendering & Export](/de/backend/render) | `toMjml()` und `toHtml()`, vorab aufgelöste Custom Blocks, aufgelöste Schriften | eines von `toMjml` · `toHtml` · `compileMjml` |

Der Editor behält, was kleinteilig und für alle gleich ist: Änderungsverfolgung, ein verzögertes Autosave, das während Undo pausiert, eine Vorschau, die Anzeigebedingungen respektiert, die Rückfrage, bevor ein Wiederherstellen ungespeicherte Arbeit verwirft. Ihnen bleibt, wohin die Daten gehen, wer sie lesen darf und wie Ihre API aussieht.

## Eine Mutation deaktivieren

Bei den vier speichernden Providern ist jede Mutation `false | fn` — und **erforderlich**, nicht optional:

```ts
savedBlocks: {
  list: async () => {
    const res = await fetch('/api/saved-blocks');
    return res.json();
  },
  create: (input) => post('/api/saved-blocks', input),
  update: false,  // darf ergänzen, aber nichts ändern
  delete: false,
}
```

- Eine zurückgehaltene Aktion wird **verborgen**, nicht deaktiviert — für etwas, das nicht stattfinden kann, gibt es kein Bedienelement.
- Der Aufruf einer zurückgehaltenen Methode **wird abgelehnt**, damit eine Verweigerung nie als Speichern durchgeht.
- `list` — und das `get` des Versionsverlaufs — lässt sich nicht abschalten. Ohne sie hätte die Funktion nichts anzuzeigen.

`render` und `testEmail` sind anders geformt, wie ihre eigenen Seiten beschreiben: Bei `render` ist jede Methode unabhängig optional, und `testEmail` besteht aus einem einzigen `send`.

::: tip Warum erforderlich und nicht optional
Eine optionale Methode würde „Ich habe mich gegen delete entschieden" nicht von „Ich habe delete noch nicht geschrieben" unterscheidbar machen. Ein `false` entsteht nicht durch Vergessen.
:::

::: warning Keine Sicherheitsgrenze
Provider laufen im Browser der Nutzenden. Diese Flags formen die Oberfläche; Ihre API schützen sie nicht. Wer eine Vorlage öffnen darf, wer einen geteilten gespeicherten Block löschen darf, welche Adresse ein Test erreichen darf — setzen Sie all das zusätzlich auf Ihrem Server durch.
:::

## IDs

IDs kommen aus Ihrem `create()` zurück; der Editor erfindet keine. Eine Vorlagen-ID ist, was auch immer Ihr Speicher bereits verwendet — ein Datenbankschlüssel, ein Slug, eine Dokument-ID.

Diese ID ist auch der Verbindungsschlüssel. Versionsverlauf und Kommentare sind beide an eine Vorlage gebunden, ihre Bedienelemente erscheinen also erst, sobald `create()` oder `load()` eine angehängt hat.

## Fehler

Jede Provider-Methode darf ablehnen. Der Editor meldet den Fehler über `onError`, zeigt ihn dort, wohin die Nutzenden gerade schauen — Speicherstatus, geöffneter Dialog — und **lässt seinen eigenen Zustand unberührt**. Nichts wird als gespeichert markiert, was es nicht ist, und ein fehlgeschlagenes Löschen lässt keinen Eintrag aus der Liste verschwinden.

Mehrere dieser Meldungen landen wortgleich in der Oberfläche — schreiben Sie sie für die Person, die sie lesen wird.

## Keine Provider

- **Bilder** — `onRequestMedia` ist ein Callback und kein Provider-Objekt: Es öffnet Ihre eigene Auswahl und gibt zurück, was gewählt wurde. Siehe [Bilder](/de/guide/images).
- **Vorschaudaten** — `resolvePreview` übergibt die Vorlage an Ihr Backend und rendert, was zurückkommt, sodass eine Vorschau echte Empfängerdaten statt Merge-Tag-Labels zeigt. Siehe [Vorschau-Rendering](/de/guide/preview-rendering).
- **KI und Echtzeit-Zusammenarbeit** — heute [Cloud](/de/cloud/)-Funktionen, für die es noch keinen offenen Vertrag gibt.

## Headless-Nutzung

`useSavedBlocks`, `useVersionHistory` und `useComments` werden aus `@templatical/core` exportiert, sodass ein Provider Ihre eigene Oberfläche versorgen kann, ganz ohne eingebundenen Editor. Die jeweilige Oberfläche steht im Abschnitt *Headless-Nutzung* der einzelnen Seiten.

## Templatical Cloud

Sie möchten das alles nicht selbst bauen? Templatical Cloud implementiert alle sechs Verträge. Richten Sie `initCloud()` auf einen Auth-Endpunkt, und Speichern, Versionsverlauf, Kommentare, gespeicherte Blöcke, Testversand und Rendering funktionieren — ohne eigenen Speicher, ohne selbst geschriebene Endpunkte, ohne gehosteten MJML-Compiler.

```ts
import { initCloud } from '@templatical/editor';

const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
});
```

Hinzu kommt, wofür der Open-Source-Editor überhaupt keinen Vertrag hat:

- **KI** — Inhalte aus einem Prompt erzeugen, eine Auswahl umformulieren, ein Design in eine Vorlage verwandeln
- **Echtzeit-Zusammenarbeit** — Live-Cursor, Präsenz und Block-Sperren über einen verwalteten WebSocket
- **Medienbibliothek** — Uploads, Ordner, Suche und Zuschnitt
- **Template-Bewertung** — automatische Prüfungen auf Zustellbarkeit und Barrierefreiheit

Derselbe Editor, dasselbe Blockmodell, dieselben Verträge: Cloud ist eine Erstanbieter-Implementierung der Schnittstellen auf dieser Seite, kein Fork. Sie können weiterhin Ihre eigene Blockbibliothek oder Ihren eigenen Versand mitbringen und den Rest Cloud überlassen.

[Templatical Cloud entdecken →](/de/cloud/)
