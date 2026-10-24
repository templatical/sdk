---
title: Zusammenarbeit
description: Gemeinsames Bearbeiten in Echtzeit über Ihr eigenes Backend — geordnete Operationen, Präsenz und Block-Sperren.
---

# Zusammenarbeit

Geben Sie dem Editor einen Collaboration-Provider, und mehrere Personen können ein Template gleichzeitig bearbeiten. Jede Änderung erreicht Ihr Backend als Batch von [Operationen](/de/api/operations), Ihr Backend bringt die Batches in eine Reihenfolge, und jeder Editor wendet sie in dieser Reihenfolge an. Wer einen Block auswählt, sperrt ihn, sodass nie zwei Personen in denselben Block tippen, und alle sehen, wer das Template sonst noch geöffnet hat.

```ts
import { init } from '@templatical/editor';

let sessionId = '';

const editor = await init({
  container: '#editor',
  user: { id: 'u_7', name: 'Ada Lovelace' },
  templates: myTemplatesProvider, // `load` returns the template's `revision`
  collaboration: {
    join: (templateId, session, handlers) => {
      sessionId = session.sessionId;
      return myRealtime.join(templateId, session, handlers);
    },
    submit: (templateId, batch) =>
      api(`/api/templates/${templateId}/operations`, {
        method: 'POST',
        headers: { 'X-Session-Id': sessionId },
        body: JSON.stringify(batch),
      }),
    operationsAfter: (templateId, revision) =>
      api(`/api/templates/${templateId}/operations?after=${revision}`, {
        headers: { 'X-Session-Id': sessionId },
      }),
    acquireLock: (templateId, blockId) =>
      api(`/api/templates/${templateId}/locks`, {
        method: 'POST',
        headers: { 'X-Session-Id': sessionId },
        body: JSON.stringify({ blockId }),
      }),
    renewLock: (templateId, blockId) =>
      api(`/api/templates/${templateId}/locks/${blockId}`, {
        method: 'PUT',
        headers: { 'X-Session-Id': sessionId },
      }),
    releaseLock: async (templateId, blockId) => {
      await fetch(`/api/templates/${templateId}/locks/${blockId}`, {
        method: 'DELETE',
        headers: { 'X-Session-Id': sessionId },
        keepalive: true,
      });
    },
  },
});

await editor.load('tpl_123');
```

`api` ist Ihr eigener Fetch-Helfer; bei einer abgelehnten Anfrage muss der Fehler den HTTP-Status als `statusCode` sowie `code`, `holder` und `holders` der Antwort enthalten (siehe [Ablehnungen](#ablehnungen)), weil ein fehlender Status als Netzwerkfehler zählt und die Anfrage erneut versucht wird.

Das Backend kombiniert `X-Session-Id` mit dem authentifizierten Nutzer, um den Besitzer der Sperre zu bestimmen.

## Was der Editor macht

- **Er schickt jede Änderung als Operationen.** Der Editor vergleicht den Canvas mit dem, was er zuletzt geschickt hat, und macht aus dem Unterschied einen Batch: Aus Ziehen wird ein `moveBlock`, aus Tippen ein `updateBlock`. Tippen in einen Block wartet auf eine Pause von 300 ms, höchstens eine Sekunde; alles andere geht sofort. Es ist immer nur ein Batch unterwegs, sodass die Batches einer Sitzung der Reihe nach ankommen, und ein Batch, der unterwegs scheitert, wird mit derselben `batchId` erneut geschickt.
- **Er wendet die Batches aller in Revisionsreihenfolge an.** Batches anderer Sitzungen werden gepuffert und strikt nach Revision angewendet, die noch unbestätigten eigenen Änderungen darüber. Eine Lücke, die sich nicht innerhalb einer Sekunde schließt, holt er mit `operationsAfter`.
- **Er sperrt den ausgewählten Block.** Wer einen Block auswählt, nimmt seine Sperre; ein Block, den eine andere Sitzung hält, zeigt Name und Farbe der haltenden Person und lässt sich nicht auswählen. Sperren werden alle 10 Sekunden erneuert und beim Abwählen, beim Laden eines anderen Templates und beim Schließen der Seite freigegeben.
- **Er zeigt, wer da ist.** Die Kopfzeile zeigt einen Avatar pro Person: Die Sitzungen eines Nutzers in mehreren Tabs zählen einmal, jeder Gast zählt für sich.
- **Er macht aus Merge-Tags in ankommenden Batches Tags.** Ein Batch einer anderen Sitzung – eines Agenten, eines anderen Editors, eines Servers – bekommt die nackten Tokens in Titeln und Absätzen beim Ankommen umgewandelt, so wie [geladene Inhalte](/de/guide/merge-tags#tokens-in-geladenen-inhalten), und dafür wird nichts zurückgeschickt. Ankommende Batches werden ohne ihr `expect` angewendet: Das hat Ihr Backend schon gegen seine eigene Kopie geprüft.
- **Er zeigt Änderungen von Agenten.** Ein Batch, dessen Actor `type: 'mcp'` hat, zeigt einen Hinweis mit `actor.client` und `actor.name` („Claude für Ada hat 3 Blöcke geändert“) und umrandet die geänderten Blöcke für 2 Sekunden. Ein Resync, dessen `actor` `type: 'mcp'` hat, zeigt „Claude für Ada hat die Vorlage aktualisiert“, ohne Rahmen. Batches und Resyncs eines Agenten innerhalb von 2 Sekunden teilen sich einen Hinweis. Agenten brauchen keine Präsenz und nehmen keine Sperren.
- **Zeigt KI-Änderungen.** Ein Batch mit `actor.type: 'ai'` zeigt „AI (for Ada) changed 3 blocks“ und umrahmt die geänderten Blöcke. Ein Re-Sync zeigt einen Template-Aktualisierungshinweis ohne eigenen Block-Rahmen. Die anfragende Sitzung sieht beim Batch nur den Rahmen und keinen Hinweis. Die Operationen eines [KI-Providers](/de/backend/ai) erreichen Ihr Backend als Batches dieser Person mit `origin: 'ai'`.
- **Er macht mit Operationen rückgängig.** Rückgängig und Wiederholen schicken die Umkehrung Ihrer eigenen Batches, jeweils abgesichert durch das, was sie vorzufinden erwarten. Ein Rückgängig-Schritt, den die Änderung eines anderen überholt hat, wird abgelehnt und mit einem Hinweis übersprungen, nie über deren Arbeit angewendet. Änderungen anderer landen nie in Ihrem Verlauf.
- **Er speichert nur Umbenennungen.** Der Inhalt erreicht Ihr Backend über `submit`, deshalb erhält `templates.save` nur noch einen neuen Namen, nachdem die Batches des Editors bestätigt sind. Autosave funktioniert weiter: Es wartet die Batches ab und benennt bei Bedarf um.
- **Er sagt es dem Nutzer**, wenn eine Auswahl oder eine Änderung abgelehnt wurde, wenn ein Rückgängig-Schritt übersprungen wurde, wenn eine Version nicht wiederhergestellt werden kann, weil andere Sperren halten, und solange die Verbindung weg ist.

## Der Vertrag

<<< @/snippets/collaboration-contract.ts

Die Deklarationen geben alle Felder, optionale Werte und Nullbarkeit an. `OperationBatch.ops` enthält 1–100 Operationen in Anwendungsreihenfolge; `batchId` ist eine vom Editor erzeugte UUID. `RevisionedBatch.createdAt` ist optional; wenn Ihr Backend einen Zeitstempel liefert, verwenden Sie ISO 8601. `BlockLock.expiresAt` ist ISO 8601. Da Verlängerungen nicht gesendet werden, entfernt eine andere Sitzung eine Sperre erst bei Freigabe oder beim Verlassen der Sitzung, nicht anhand dieses Zeitstempels. `CollaborationActor.id` ist für `api` `null`, `sessionId` für `api` und `mcp` `null`; `CollaborationMember.userId` ist bei Gästen `null`.

### `join`

Wird aufgerufen, wenn ein Template geladen ist, mit der Sitzungs-ID dieses Editors (einer UUID, die der Editor erzeugt). Abonnieren Sie die Events des Templates und antworten Sie dann mit seiner aktuellen Revision, den nicht abgelaufenen Sperren und allen, die es geöffnet haben, diese Sitzung eingeschlossen. Rufen Sie für alles, was danach passiert, die Handler auf; `leave()` beendet das.

Nach einem Reconnect wird `join` für dasselbe Template erneut aufgerufen: Antworten Sie mit frischem Zustand, ohne doppelt zu abonnieren. Rufen Sie `onConnectionChange` auf, wenn Ihre Echtzeitverbindung abbricht und zurückkommt; bei `connected` tritt der Editor erneut bei und holt auf.

### `submit`

Wenden Sie die Operationen des Batches auf das Template an, der Reihe nach und alles oder nichts, und antworten Sie mit der Revision, die dabei entstanden ist. `baseRevision` ist die letzte Revision, die der Editor bestätigt hatte; Batches werden auf den aktuellen Inhalt angewendet, wie auch immer er gerade aussieht, und genau dafür gibt es die Nachbar-Anker und Vorbedingungen der Operationen. Eine `batchId`, die Sie schon angewendet haben, antwortet mit der Revision dieses Batches und wendet nichts an, denn der Editor schickt nach einem Fehler unterwegs erneut. Schicken Sie den Batch mit seiner Revision und seinem Actor über `onBatch` an jede andere Sitzung.

### `operationsAfter`

Antworten Sie mit jedem Batch nach `revision`, der Reihe nach. Haben Sie nicht mehr alle, antworten Sie `{ revision, resync: true }`, und der Editor lädt das Template über `templates.load` neu. Rufen Sie `onResync(revision, actor)` für eine Änderung auf, die Batches nicht beschreiben können, etwa ein `setContent`, eine wiederhergestellte Version oder einen Broadcast, der für Ihren Transport zu groß ist. `actor` ist, wer die Änderung gemacht hat, in der Form eines Batch-Actors; der Editor nutzt ihn nur für den Hinweis zu einem Agenten oder zur KI, und ohne ihn ändert sich sonst nichts.

### Sperren

`acquireLock` gewährt die Sperre oder lehnt mit `lock_held` und der haltenden Person ab; `renewLock` verlängert sie oder lehnt mit `lock_lost` ab; `releaseLock` gibt sie frei und scheitert nie. Schicken Sie `onLock` und `onUnlock` an die anderen Sitzungen. Die drei Methoden sind nur gemeinsam optional: Ohne sie nimmt der Editor keine Sperren.

### Ablehnungen

Der Editor liest `statusCode` für die Entscheidung über Wiederholungen sowie `code` und `holder` oder `holders` für Ablehnungen. `CollaborationConflict` aus `@templatical/types` trägt sie, und jeder Fehler mit denselben Feldern funktioniert.

| `code` | Von | Der Editor |
|---|---|---|
| einer der [Operations-Fehler](/de/api/operations#fehler) | `submit` | Verwirft den Batch, stellt den Stand Ihres Backends wieder her und sagt, dass die Änderung nicht gespeichert wurde, bei `lock_held` mit der haltenden Person |
| `content_too_large` | `submit` | Verwirft den Batch und sagt, dass die Änderung zu groß war |
| `lock_held` (mit `holder`) | `acquireLock` | Wählt ab und sagt, wer den Block bearbeitet |
| `lock_lost` | `renewLock` | Nimmt die Sperre erneut, wenn der Block noch ausgewählt ist |

Netzwerkfehler, 5xx, 408 und 429 werden mit derselben `batchId` nach 1, 2, 5, 10 und 30 Sekunden erneut versucht.

## Templates

Mit einem Collaboration-Provider muss `templates.load` neben dem Inhalt die `revision` des Templates liefern und kann seine nicht abgelaufenen `locks` liefern. `templates.save` erhält nur `{ name }`; der Inhalt ist schon auf Ihrem Backend. `create` funktioniert wie gewohnt und beginnt ein Template bei Revision 0.

## Ein Backend bauen

### Einen Batch anwenden

Trägt ein Batch `origin: 'ai'`, senden Sie ihn mit `actor.type: 'ai'` und derselben `id`, demselben `name` und derselben `sessionId` weiter; die Editoren kennzeichnen ihn als Änderung der KI. Der Host des Playgrounds macht das so.

```ts
import { applyOperations, OperationError } from '@templatical/types';

app.post('/api/templates/:id/operations', async (req, res) => {
  const { batchId, ops } = req.body;
  const sessionId = req.get('X-Session-Id') ?? null; // however you identify it
  const template = await db.templates.lockForUpdate(req.params.id);

  const known = await db.batches.find(template.id, batchId);
  if (known) return res.json({ revision: known.revision });

  const locks = await db.locks.unexpired(template.id);
  let content;
  try {
    content = applyOperations(template.content, ops, {
      locks: locks.map((lock) => ({ blockId: lock.blockId, sessionId: lock.owner })),
      session: sessionId ? ownerOf(req.user, sessionId) : null,
    });
  } catch (error) {
    if (!(error instanceof OperationError)) throw error;
    return res.status(error.code === 'invalid_operation' ? 422 : 409).json({
      message: error.message,
      code: error.code,
      opIndex: error.opIndex,
    });
  }

  const revision = template.revision + 1;
  await db.templates.update(template.id, { content, revision });
  const batch = { revision, batchId, actor: actorOf(req.user, sessionId), ops };
  await db.batches.insert(template.id, batch);
  realtime.toOthers(template.id, sessionId, 'batch', batch);
  res.json({ revision });
});
```

Wenden Sie die Batches eines Templates nacheinander an: Zwei gleichzeitig angewendete würden dieselbe Revision lesen. Verwenden Sie dasselbe `applyOperations` wie der Editor, damit ein Batch, den der Editor für gültig hielt, auch auf Ihrem Server gültig ist.

### Sperren und Besitz

Eine Sperre gehört einer Sitzung und der Identität dahinter zugleich: der Nutzer-ID oder `guest:<sessionId>` für eine Sitzung ohne Nutzer. Vergleichen Sie beides, wie `ownerOf` oben, damit eine aus der Anfrage eines anderen Nutzers übernommene Sitzungs-ID nicht auf dessen Sperre wirken kann. Geben Sie Sperren eine kurze Laufzeit (Templatical Cloud verwendet 30 Sekunden; der Editor erneuert alle 10), und wenn eine Sitzung einen neuen Block nimmt, geben Sie den zuvor gehaltenen frei. Überlassen Sie die Sperrprüfung `applyOperations`: Übergeben Sie jede nicht abgelaufene Sperre mit ihrem Besitzer und den handelnden Besitzer als `session`.

### Aufholen

Behalten Sie die letzten Batches für `operationsAfter`. Wie viele, entscheiden Sie: Fragt ein Editor nach Revisionen, die Sie nicht mehr haben, antworten Sie mit `resync`, und er lädt das Template neu.

### Präsenz

Mitglieder sind Sitzungen, nicht Nutzer: Derselbe Nutzer in zwei Tabs sind zwei Mitglieder, und der Editor fasst sie zusammen. Geben Sie jedem Mitglied eine Farbe, die für dieselbe Person überall gleich bleibt, zum Beispiel aus einem Hash der Nutzer-ID.

## Ohne Echtzeit

Ein Backend ohne Echtzeitkanal kann trotzdem geordnet zusammenarbeiten: `join` antwortet mit der Revision und leeren `locks` und `members` und ruft nie einen Handler auf, und der Provider hat keine Sperr-Methoden. Jede Änderung geht weiter über `submit`, Ablehnungen funktionieren weiter, und Änderungen anderer erscheinen, wenn das Template neu geladen wird.

## Events

`init({ onRemoteChange })` wird mit `{ actor, ops }` aufgerufen, nachdem der Batch einer anderen Sitzung auf dem Canvas angewendet wurde. Für die eigenen Änderungen dieses Editors wird es nicht aufgerufen, ebenso wenig für einen Resync, der das Template neu lädt.

## Im Playground

Das Setup **Collaboration** führt diesen Vertrag zwischen Browser-Tabs aus, über ein Backend, das in einem Shared Worker auf `applyOperations` aufbaut. Öffnen Sie es in zwei Tabs und hängen Sie an einen `?user=Ada` an, um ihn anzumelden.

[Im Playground öffnen](https://play.templatical.com/scenes/collaboration)
