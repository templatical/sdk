---
title: Kommentare
description: Ein Review-Gespräch mit Threads an einer Vorlage — über Ihren eigenen Speicher oder den von Templatical Cloud.
---

# Kommentare

Geben Sie dem Editor einen Ort, an dem er Kommentare lesen und schreiben kann, und er erhält ein Review-Panel: Threads mit Antworten, Anker an einzelnen Blöcken, Lösen und Wiedereröffnen sowie eine Zähler-Markierung an jedem kommentierten Block im Canvas.

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  templates: myTemplatesProvider,
  user: { id: 'u_7', name: 'Ada Lovelace' },
  comments: {
    list: async (templateId) => {
      const res = await fetch(`/api/templates/${templateId}/comments`);
      return res.json();
    },

    create: async (templateId, input) => {
      const res = await fetch(`/api/templates/${templateId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return res.json();
    },

    update: async (templateId, commentId, patch) => {
      const res = await fetch(
        `/api/templates/${templateId}/comments/${commentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
      );
      return res.json();
    },
    delete: async (templateId, commentId) => {
      await fetch(`/api/templates/${templateId}/comments/${commentId}`, {
        method: 'DELETE',
      });
    },
    setResolved: async (templateId, commentId, resolved) => {
      const res = await fetch(
        `/api/templates/${templateId}/comments/${commentId}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolved }),
        },
      );
      return res.json();
    },
  },
});
```

**Standardmäßig weggelassen.** Ohne Provider werden das Panel, sein Auslöser und die Block-Markierungen nicht gerendert, und keiner dieser UI-Teile wird geladen.

Kommentare sind an eine Vorlagen-ID gebunden, daher erscheint das Panel erst, sobald `create()` oder `load()` eine angehängt hat. Siehe [Speichern & Laden](/de/backend/templates).


## Autoren-Identität

`user` ist ein **Schlüssel auf oberster Ebene**, und Kommentare setzen ihn voraus. Ohne Autorenschaft meldet sich die Funktion als nicht verfügbar, statt einen anonymen Kommentar zu schreiben: kein Auslöser, kein Panel, keine Markierungen.

```ts
init({ container, user: { id: 'u_7', name: 'Ada Lovelace' } });
```

`user.id` wird mit der `author.id` jedes Kommentars verglichen, um zu entscheiden, was bearbeitet oder gelöscht werden darf. `user.name` erscheint an den Kommentaren, die diese Sitzung schreibt.

::: tip Warum außerhalb des Providers
Die Präsenzanzeige der Zusammenarbeit braucht denselben Wert. Eine Kopie im Kommentar-Provider wäre das Erste, was auseinanderdriftet, sobald eine zweite Funktion ihn ebenfalls braucht.
:::

::: warning Keine Sicherheitsgrenze
`user` identifiziert die Person gegenüber der Editor-UI, im Browser der Person selbst. Ordnen Sie Schreibvorgänge serverseitig zu, aus der Sitzung, der Ihr Backend bereits vertraut. Nichts hier verhindert, dass ein Browser einen anderen Namen behauptet.
:::

## Der Vertrag

```ts
interface Comment {
  id: string;
  body: string;
  author: { id: string; name: string };
  createdAt: string;
  updatedAt?: string;
  blockId?: string | null;
  parentId?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: { id: string; name: string } | null;
  replies?: Comment[];
}

interface CommentsProvider {
  list(templateId: string, params?: CommentsListParams): Promise<Comment[]>;
  create:      false | ((templateId: string, input: CommentInput) => Promise<Comment>);
  update:      false | ((templateId: string, commentId: string, patch: CommentPatch) => Promise<Comment>);
  delete:      false | ((templateId: string, commentId: string) => Promise<void>);
  setResolved: false | ((templateId: string, commentId: string, resolved: boolean) => Promise<Comment>);
  subscribe?:  (templateId: string, onChange: (change: CommentChange) => void) => () => void;
}
```

`list` lässt sich nicht abschalten — ohne es hätte das Panel nichts anzuzeigen. Jede der vier Mutationen nimmt `false` anstelle einer Funktion und ist **erforderlich**, nicht optional: Ein `false` erklärt die Aktion für nicht verfügbar, und der Editor blendet sie aus, statt sie zu deaktivieren. Siehe [Review nur zum Lesen](#review-nur-zum-lesen).

Der Editor rendert die Reihenfolge von `list()` unverändert und sortiert nie um. Die Reihenfolge entscheidet Ihr Speicher.

### Thread-Tiefe

Eine Ebene. Ein Thread-Wurzelkommentar trägt `replies`; eine Antwort nie. Tiefere Bäume legen Sie in Ihrem Speicher flach.

### `updatedAt`

Vorhanden bedeutet bearbeitet — das Panel zeigt eine *(bearbeitet)*-Markierung. Setzen Sie es bei einer Bearbeitung, **nicht beim Anlegen**: Ein Speicher, der es zusammen mit `createdAt` setzt, markiert jeden Kommentar als bearbeitet.

### `setResolved`

Nimmt den Zielzustand, keinen Umschalter. Der Aufruf ist idempotent, sodass zwei gleichzeitige Klicks einen Thread nicht invertiert zurücklassen und Ihr Endpunkt vor dem Schreiben nie den aktuellen Zustand lesen muss.

Der Editor meldet das Ergebnis, das Ihr Speicher zurückgegeben hat, nicht den angefragten Zustand. Ein Speicher, der sich weigert, einen Thread wieder zu öffnen, antwortet „weiterhin gelöst", und genau das melden UI und [`onResolved`](#events).

## Review nur zum Lesen

Halten Sie alle vier Mutationen zurück, bleibt das Panel lesbar und navigierbar. Threads und Antworten werden gerendert, der Sprung zum Block funktioniert, und Eingabefeld, Lösen, Bearbeiten und Löschen sind **nicht vorhanden** statt deaktiviert:

```ts
comments: {
  list: (templateId) => api.comments(templateId),
  create: false,
  update: false,
  delete: false,
  setResolved: false,
}
```

Jede wirkt eigenständig: `setResolved: false` allein lässt Kommentieren und Bearbeiten unberührt, es gibt nur nichts zu lösen; `update: false` allein entfernt nur den Stift.

Ein programmatischer Aufruf einer zurückgehaltenen Mutation **wird abgelehnt**, statt sich aufzulösen — ein aufgelöstes Promise liest sich für den Aufrufer als „gespeichert".

Die Zugehörigkeit je Kommentar kommt obendrauf: Bearbeiten und Löschen werden nur an den eigenen Kommentaren der aktuellen Person angeboten, und nur, wenn der Speicher diese Mutationen bereitgestellt hat.

## Echtzeit-Aktualisierungen

`subscribe` schiebt entfernte Änderungen in das offene Panel, sodass der Kommentar einer Kollegin ohne Neuladen erscheint. **Optional** — ohne diese Methode funktionieren Kommentare genauso, der Kommentar der anderen Person erscheint nur beim nächsten Lesen.

```ts
subscribe: (templateId, onChange) => {
  const source = new EventSource(`/api/templates/${templateId}/comments/stream`);
  source.onmessage = (event) => onChange(JSON.parse(event.data));
  return () => source.close();
},
```

Geben Sie eine Abmeldefunktion zurück; der Editor ruft sie auf, wenn die Vorlage wechselt und beim Abbau.

```ts
type CommentChange =
  | { type: 'created'; comment: Comment }
  | { type: 'updated'; comment: Comment }
  | { type: 'deleted'; commentId: string; parentId?: string | null };
```

Ein Löschvorgang trägt nur die ID und ihren Elternkommentar — es ist kein Kommentar mehr übrig, den man senden könnte, und der Elternkommentar erspart dem Editor eine Suche.

Ihre eigenen Schreibvorgänge dürfen hier zurückkommen und brauchen **auf Ihrer Seite keine Entdopplung**: Ein `created` für einen Kommentar, der bereits in der Liste steht, wird ignoriert, und ein `updated` ersetzt ihn an seiner Stelle.

## Filtern

Das Panel filtert **im Speicher** über das, was `list()` zurückgegeben hat — ungelöst (die Voreinstellung), alle oder dieser Block. Ihr Provider entscheidet, was sichtbar ist; der Editor entscheidet, wie darin eingegrenzt wird.

`CommentsListParams` ist für künftige *Filter* reserviert und heute leer; der Editor ruft `list` immer ohne Parameter auf.

::: tip Kommentare werden bewusst nicht seitenweise geladen
`list` gibt alle Threads auf einmal zurück. Das Badge für ungelöste Threads und die Zähler an den Blöcken werden über die gesamte Liste berechnet — eine Teilseite ließe beide stillschweigend zu niedrig ausfallen, also falsch statt langsam. Eine langlebige Vorlage begrenzt ihr Wachstum selbst, indem `list()` gelöste Threads ab einem gewissen Alter nicht mehr zurückgibt; das Panel blendet diese ohnehin standardmäßig aus. Der [Versionsverlauf](/de/backend/version-history#seitenweises-laden) lädt sehr wohl seitenweise, denn seine Liste ist ein flaches Menü, über das nichts aggregiert wird.
:::

## Im Editor

- **Eine Kommentar-Schaltfläche** im Header, mit einer Markierung, die ungelöste Threads zählt. Sie erscheint, sobald eine Vorlage geladen und die Funktion verfügbar ist.
- **Eine Kommentar-Markierung an jedem kommentierten Block** mit der Anzahl für diesen Block. Ein Klick öffnet das Panel, gefiltert auf diesen Block.
- **Das Panel** rechts: Thread-Karten mit Autor, relativer Zeit, einer *(bearbeitet)*-Markierung, dem Lösen-Umschalter und Antworten / Bearbeiten / Löschen, soweit der Speicher es erlaubt.
- **Eine „Fehlender Block"-Markierung** an einem Kommentar, dessen Ankerblock nicht mehr existiert, damit ein verwaister Thread sich als verwaist liest und nicht als Rätsel.

## Events

```ts
comments: {
  // ...list, create, update, delete, setResolved
  onCreated:    (comment, { origin }) => {},
  onUpdated:    (comment, { origin }) => {},
  onDeleted:    (comment, { origin }) => {},
  onResolved:   (comment, { origin }) => {},
  onUnresolved: (comment, { origin }) => {},
}
```

`origin` ist `'local'` für einen Schreibvorgang, den dieser Editor selbst ausgeführt hat — `create`, `update`, `delete` oder `setResolved`, aufgerufen über die eigene UI des Editors oder `useComments`. Es ist `'remote'` für eine Änderung, die über [`subscribe`](#echtzeit-aktualisierungen) eingetroffen ist: jemand anderes, in einem anderen Browser.

Eine „Neue Kommentare"-Markierung außerhalb des Editors sollte nur `remote` zählen. Zählt sie `local` mit, erhöht der eigene Kommentar einer Person ihren eigenen Ungelesen-Zähler.

Welcher der beiden Handler `onResolved` / `onUnresolved` auslöst, entscheidet das `resolvedAt` des **gespeicherten** Ergebnisses, nicht der angefragte Zustand — ein Speicher, der sich weigert, einen Thread wieder zu öffnen, meldet weiterhin `onResolved`.

::: tip Handler lösen meist einmal pro Änderung aus
Ein Transport, der einen Schreibvorgang an den eigenen Absender zurückspiegelt — der Vertrag von `subscribe` erlaubt das —, wird mit dem gespeicherten Kommentar verglichen: Ein Echo, das nichts verändert, wird still übernommen, ohne Event.

Diese Zusicherung gilt für ein Echo, das **nach** der Antwort des eigenen Schreibvorgangs eintrifft. Trifft es vorher ein, wendet der Editor es zuerst als `origin: 'remote'` an, und der lokale Aufruf löst — sobald seine Antwort eintrifft — trotzdem noch sein eigenes `origin: 'local'`-Event aus: zwei Events für einen Schreibvorgang, das erste davon falsch zugeordnet. Kann Ihr Transport so früh zurückspiegeln, deduplizieren Sie auf Ihrer Seite weiterhin selbst.

**Templatical Cloud ist davon nicht betroffen.** `createCloudCommentsProvider` versieht jeden Schreibvorgang mit einem `X-Socket-ID`-Header, den das Backend von Cloud beim Zurückspiegeln der Änderung ausschließt — ein verfrühtes Echo erreicht diesen Editor also nie.
:::

Eine Handler-Funktion, die einen Fehler wirft, wird abgefangen und an `onError` gemeldet — sie lässt den auslösenden Schreibvorgang nie fehlschlagen.

## Headless-Nutzung

`useComments` aus `@templatical/core` ist der reaktive Zustand für sich allein, ohne den Editor:

```ts
import { useComments } from '@templatical/core';

const comments = useComments({
  provider: myCommentsProvider,
  getTemplateId: () => currentTemplateId,
  getUser: () => currentUser,
  onError: (error) => console.error(error),
});

await comments.load();
comments.comments.value;                    // Comment[] — Thread-Wurzeln mit Antworten
comments.unresolvedCount.value;             // number
comments.commentCountByBlock.value;         // Map<string, number>
await comments.create({ body: 'Sieht gut aus' });
await comments.setResolved('c_1', true);
```

Die Handler aus [Events](#events) sind Teil von `myCommentsProvider` selbst — demselben Objekt, auf dem auch `list` / `create` / `update` / `delete` / `setResolved` liegen —, sodass ein Objekt `init()` und `useComments` gleichermaßen bedient.

`useCommentListener` verbindet das `subscribe` eines Providers mit demselben Zustand und tut bei einem Provider ohne diese Methode nichts:

```ts
import { useCommentListener } from '@templatical/core';

useCommentListener({
  comments,
  provider: myCommentsProvider,
  getTemplateId: () => currentTemplateId,
});
```

**Sie nutzen Templatical Cloud?** Cloud implementiert diesen Vertrag ohne jede Konfiguration — siehe [Kommentare auf Cloud](/de/cloud/comments).
