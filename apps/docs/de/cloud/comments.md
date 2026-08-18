---
title: Kommentare
description: Templatical Cloud als eine Implementierung des Kommentar-Vertrags.
---

# Kommentare

Kommentare sind ein [offener Vertrag](/de/backend/comments). Templatical Cloud implementiert ihn genauso, wie Ihr eigenes Backend es täte.

```ts
const editor = await initCloud({ container: '#editor', auth: { url: '/api/token' } });
```

Nichts zu konfigurieren. Cloud liefert den Provider und die Identität, und die Kommentar-Schaltfläche im Header erscheint, sobald eine Vorlage gespeichert ist.

## Der Adapter

| Methode | Cloud |
|---|---|
| `list` | Jeder Thread der Vorlage, jeweils mit seinen Antworten |
| `create` | Speichert einen Kommentar oder eine Antwort, **signiert** mit dem User-Claim des Tokens |
| `update` | Bearbeitet den Text eines Kommentars |
| `delete` | Entfernt einen Kommentar und bei einem Wurzelkommentar auch dessen Antworten |
| `setResolved` | Markiert einen Thread als gelöst oder öffnet ihn wieder |
| `subscribe` | Bindet den Echtzeit-Kanal von Cloud, sodass der Kommentar einer Kollegin während des Schreibens erscheint |

Alle vier Mutationen sind aktiviert: Kommentar-Speicherung und ihre Echtzeit-Verteilung sind genau das, was die Plan-Funktion `commenting` bezahlt — es gibt also keine Cloud-Stufe, die einen Thread lesen, aber nicht darauf antworten kann.

## Verfügbarkeit

Drei Bedingungen, von denen keine die andere impliziert:

- **`commenting: false`** schaltet die Funktion vollständig ab.
- **Die Plan-Funktion `commenting`** muss gewährt sein.
- **Die Vorlage muss gespeichert sein.** Cloud verankert einen Kommentar serverseitig, es muss also eine gespeicherte Vorlage geben, an der er hängt — die Kommentar-Schaltfläche erscheint vor dem ersten Speichern nicht.

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  commenting: false, // aus
  onComment: (event) => {
    // 'created' | 'updated' | 'deleted' | 'resolved' | 'unresolved'
    console.log(event.type, event.comment.id);
  },
});
```

## Autoren-Identität

Cloud sendet bei jedem Schreibvorgang `user_id` / `user_name` / `user_signature` mit, entnommen aus dem `user`-Claim des Auth-Tokens und von seinem Backend geprüft. Daher nimmt `initCloud()` **keinen `user`-Schlüssel** an: Es füllt `init({ user })` aus genau diesem Claim, und eine vom Browser gelieferte Identität könnte der vom Server geprüften nur widersprechen.

Ein Projekt, dessen Token-Endpunkt den `user`-Claim weglässt, erhält überhaupt keine Kommentar-Funktion — [nicht verfügbar, niemals anonym](/de/backend/comments#autoren-identitat).

## Eigene Implementierung

Innerhalb von `initCloud()` geht das nicht — dieselbe Grenze, die [`templates`](/de/backend/templates) und der [Versionsverlauf](/de/cloud/version-history) ziehen, und aus demselben Grund.

Ein Kommentar ist an eine Vorlagen-ID gebunden, die **Cloud ausgestellt** hat, und seine Autorenschaft wird vom Token von Cloud signiert. Ein vom Consumer gelieferter Provider würde die UI steuern, während der eigene Speicher von Cloud derjenige bliebe, in den der Server schreibt und den er abrechnet.

`initCloud({ comments })` steht daher nicht im Konfigurationstyp, und ein aus JavaScript übergebener Provider wird mit einer Konsolenwarnung ignoriert.

Bringen Sie Ihren eigenen mit [`init()`](/de/backend/comments) mit — dort gehört Ihnen der gesamte Satz: Vorlagen, Versionsverlauf, Kommentare, Rendering.

## Headless-Nutzung

`useComments` und `useCommentListener` liegen in `@templatical/core` und nehmen einen Provider entgegen. Der Adapter von Cloud ist `createCloudCommentsProvider` aus `@templatical/core/cloud`:

```ts
import { useComments, useCommentListener } from '@templatical/core';
import { createCloudCommentsProvider } from '@templatical/core/cloud';

const provider = createCloudCommentsProvider({
  authManager,
  channel,                                 // Ref<PresenceChannel | null>
  getSocketId: () => websocket.getSocketId(),
});

const comments = useComments({
  provider,
  getTemplateId: () => templateId,
  getUser: () => ({ id: authManager.userConfig.id, name: authManager.userConfig.name }),
});

useCommentListener({ comments, provider, getTemplateId: () => templateId });
```

Die vollständige reaktive Oberfläche steht im [Kommentar-Leitfaden](/de/backend/comments#headless-nutzung).
