---
title: Backend anbinden
description: Speichern, Versionsverlauf, Kommentare, gespeicherte Blöcke, Test-E-Mails und Rendering sind jeweils ein Konfigurationsschlüssel mit Methoden, die Sie implementieren — gegen Ihren eigenen Stack oder gegen Templatical Cloud.
---

# Backend anbinden

Der Editor bearbeitet eine Vorlage. Alles darum herum — wo die Vorlage gespeichert wird, wie ihre Vergangenheit aussieht, wer sie kommentiert hat, wohin ein Testversand geht, wie daraus versandfertiges HTML wird — liegt in Ihrem Stack, und der Editor erreicht es über ein einfaches Objekt, das Sie an `init()` übergeben.

Dieses Objekt ist ein **Provider**. Es gibt sechs davon, alle sind optional, und alle funktionieren gleich. Diese Seite beschreibt das Muster; jede folgende Seite behandelt genau einen Provider.

## Ein Schlüssel, ein Provider

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

Jeder Schlüssel steht für sich, und jede Funktion **fehlt vollständig, solange Sie ihren Schlüssel nicht übergeben**. Lassen Sie `versionHistory` weg, gibt es kein Verlaufs-Steuerelement — keine deaktivierte Schaltfläche, kein leeres Panel, und auch der zugehörige Code wird nicht geladen. Eine Fähigkeit existiert genau dann, wenn sie einen Ort hat, an den sie schreiben kann.

Nichts davon ist Voraussetzung für den Betrieb: `init({ container })` allein ist ein funktionierender Editor, der nichts persistiert.

## Die Oberfläche gehört dem Editor, der Transport gehört Ihnen

<!-- prettier-ignore -->
| Provider | Das liefert der Editor | Das implementieren Sie |
| --- | --- | --- |
| [Speichern & Laden](/de/backend/templates) | Namensfeld direkt im Header, Speichern-Schaltfläche, Statusanzeige, `Cmd`/`Strg`+`S`, Autosave, Warnung bei ungespeicherten Änderungen | `load` · `create` · `save` |
| [Versionsverlauf](/de/backend/version-history) | Header-Steuerelement, Versionsliste, Vorschau auf der Arbeitsfläche mit eigenem Banner, Wiederherstellen mit Rückfrage | `list` · `get` · `create` · `restore` |
| [Kommentare](/de/backend/comments) | Review-Panel, Threads und Antworten, Zähler-Badges pro Block, Auflösen und Wiederöffnen | `list` · `create` · `update` · `delete` · `setResolved` |
| [Gespeicherte Blöcke](/de/backend/saved-blocks) | Auswahlmodus auf der Arbeitsfläche, durchsuchbarer Browser mit Live-Vorschau, Einfügen an Position, Umbenennen, Löschen | `list` · `create` · `update` · `delete` |
| [Test-E-Mails](/de/backend/test-email) | Auslöser im Header, Empfängersteuerung, Formatprüfung, exakte Vorschau, Versand- und Fehlerzustände | `send` |
| [Rendering & Export](/de/backend/render) | `toMjml()` und `toHtml()`, vorab aufgelöste Custom Blocks, aufgelöste Schriften | eines von `toMjml` · `toHtml` · `compileMjml` |

Diese Trennung ist der Kern. Der Editor behält, was kleinteilig und für alle gleich ist — Änderungsverfolgung, ein verzögertes Autosave, das während Undo pausiert, eine Vorschau, die Anzeigebedingungen respektiert, die Rückfrage, bevor ein Wiederherstellen ungespeicherte Arbeit verwirft. Ihnen bleibt, was niemand für Sie schreiben kann: wohin die Daten gehen, wer sie lesen darf und wie Ihre API aussieht.

## Etwas abzuschalten ist eine Entscheidung, die Sie aussprechen

Bei den vier Providern, die etwas speichern, ist jede Mutation `false | fn` — und **erforderlich**, nicht optional:

```ts
savedBlocks: {
  list: async () => {
    const res = await fetch('/api/saved-blocks');
    return res.json();
  },
  create: (input) => post('/api/saved-blocks', input),
  update: false,  // diese Person darf ergänzen, aber nichts ändern
  delete: false,
}
```

Eine optionale Methode würde „Ich habe mich gegen delete entschieden" nicht von „Ich habe delete noch nicht geschrieben" unterscheidbar machen. Ein `false` entsteht nicht durch Vergessen.

Der Editor **verbirgt** dann, was ein Provider zurückhält, statt es zu deaktivieren — für eine Aktion, die nicht stattfinden kann, gibt es kein Bedienelement — und der Aufruf einer zurückgehaltenen Methode **wird abgelehnt** statt still erfolgreich zu sein, damit eine Verweigerung nie als Speichern durchgeht. Lesezugriffe sind die Ausnahme: `list` und das `get` des Versionsverlaufs lassen sich nicht abschalten, weil die Funktion ohne sie nichts anzuzeigen hätte.

Zwei Provider sind anders geformt, aus Gründen, die ihre eigenen Seiten nennen: Bei `render` ist jede Methode unabhängig optional, und `testEmail` besteht aus einem einzigen `send`.

::: warning Keine Sicherheitsgrenze
Provider laufen im Browser der Nutzenden. Diese Flags formen die Oberfläche; Ihre API schützen sie nicht. Jede Regel, auf die es ankommt — wer eine Vorlage öffnen darf, wer einen geteilten gespeicherten Block löschen darf, welche Adresse ein Test erreichen darf — muss zusätzlich auf Ihrem Server durchgesetzt werden.
:::

## Die Identität gehört Ihrem Speicher

IDs kommen aus Ihrem `create()` zurück; der Editor erfindet keine. Eine Vorlagen-ID ist ein Datenbankschlüssel, ein Slug, eine Dokument-ID — was auch immer Ihr Speicher bereits verwendet.

Diese ID ist auch der Verbindungsschlüssel. Versionsverlauf und Kommentare sind beide an eine Vorlage gebunden, weshalb ihre Bedienelemente erst erscheinen, sobald `create()` oder `load()` eine angehängt hat — `templates` ist der Provider, auf dem diese beiden aufsetzen.

## Wenn eine Methode ablehnt

Jede Provider-Methode darf ablehnen, und der Editor nimmt eine Ablehnung wörtlich: Er meldet den Fehler über `onError`, zeigt ihn dort, wohin die Nutzenden gerade schauen (Speicherstatus, der geöffnete Dialog), und **lässt seinen eigenen Zustand unberührt**. Nichts wird als gespeichert markiert, was es nicht ist, und ein fehlgeschlagenes Löschen lässt keinen Eintrag aus der Liste verschwinden.

Schreiben Sie diese Meldungen für die Person, die sie lesen wird — mehrere landen wortgleich in der Oberfläche.

## Templatical Cloud ist eine dieser Implementierungen

Templatical Cloud ist kein anderer Editor, kein Fork und keine Codebasis-Obermenge. Es ist eine Erstanbieter-Implementierung genau dieser Schnittstellen: eine Editor-Komponente, ein Kern, ein Header hinter beiden Einstiegspunkten.

**Zwei der sechs nehmen bei `initCloud()` denselben Schlüssel mit demselben Typ**, ein Wechsel zwischen beiden ist also eine Löschung und kein Umbau:

```ts
// Clouds Blockbibliothek und Clouds Versand:
await initCloud({ container, auth });

// Ihre eigenen, auf Cloud:
await initCloud({ container, auth, savedBlocks: mine, testEmail: mine });
```

Diese beiden lassen sich gefahrlos mischen, weil Cloud sie nie eigenständig nutzt: Gespeicherte Blöcke werden auf die Arbeitsfläche kopiert und sonst nirgends gelesen, und Cloud verschickt von sich aus keine Test-E-Mail.

Die übrigen vier werden abgelehnt, aus zwei Gründen — ein aus JavaScript übergebener Provider wird mit einer Konsolenwarnung ignoriert:

<!-- prettier-ignore -->
| Schlüssel | Warum `initCloud()` ihn ablehnt |
| --- | --- |
| `templates`, `versionHistory`, `comments`, `user` | **An eine von Cloud ausgestellte Vorlagen-ID gebunden.** Cloud verankert Versionen und Kommentare an eigenen IDs und signiert die Autorenschaft gegen das Auth-Token. Ein Speicher, für den Cloud nie IDs ausgestellt hat, lässt sich deshalb nicht an Funktionen anschließen, die Cloud hostet. |
| `render` | **Cloud rendert für den Versand eigenständig** — Test-E-Mail, geplante Sendungen und Exporte. Ein Provider würde ändern, was Sie in der Vorschau sehen und exportieren, nie das, was Cloud versendet. |

Jede Seite in diesem Abschnitt endet damit, was Cloud für diese Fähigkeit implementiert — für alle, die zwischen Selbstbauen und Zukaufen abwägen.

## Was kein Provider ist

- **Bilder.** Medien haben eine Schnittstelle, aber sie ist ein Callback und kein Provider-Objekt: `onRequestMedia` öffnet Ihre eigene Auswahl und gibt zurück, was gewählt wurde. Dokumentiert ist das gemeinsam mit der übrigen Bildbehandlung unter [Bilder](/de/guide/images).
- **Vorschaudaten.** `resolvePreview` übergibt die Vorlage an Ihr Backend und rendert, was zurückkommt, sodass eine Vorschau echte Empfängerdaten statt Merge-Tag-Labels zeigt. Siehe [Vorschau-Rendering](/de/guide/preview-rendering).
- **KI und Echtzeit-Zusammenarbeit.** Heute [Cloud](/de/cloud/)-Funktionen, für die es noch keinen offenen Vertrag gibt.

## Eigene Oberflächen bauen

Der reaktive Zustand hinter drei dieser Panels wird aus `@templatical/core` exportiert — `useSavedBlocks`, `useVersionHistory` und `useComments` —, sodass ein Provider Ihre eigene Oberfläche versorgen kann, ganz ohne eingebundenen Editor. Die jeweilige Oberfläche steht im Abschnitt *Headless-Nutzung* der einzelnen Seiten.
