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

Ein Kommentar gehört zu einer Vorlagen-ID, daher erscheint das Panel erst, sobald `create()` oder `load()` eine angehängt hat. Siehe [Speichern & Laden](/de/backend/templates).

`initCloud()` nimmt **keinen** `comments`-Schlüssel an — siehe [Templatical Cloud](#templatical-cloud) unten.

## `user` ist erforderlich und ein Schlüssel auf oberster Ebene

Jeder Kommentar hat eine Autorin oder einen Autor. Ohne diese Angabe gibt es niemanden, dem ein Kommentar zugeordnet werden könnte, daher **meldet sich die Funktion als nicht verfügbar, anstatt einen anonymen Kommentar zu schreiben** — kein Auslöser, kein Panel, keine Markierungen.

```ts
init({ container, user: { id: 'u_7', name: 'Ada Lovelace' } });
```

Bewusst ist dies *kein* Teil des Kommentar-Providers. Kommentare sind die erste Funktion, die „wer sind Sie?" braucht, aber sie werden nicht die letzte sein — die Präsenzanzeige der Zusammenarbeit braucht genau dieselbe Antwort — und eine provider-eigene Kopie wäre das Erste, was auseinanderdriftet, sobald die zweite Funktion dazukommt.

`user.id` vergleicht das Panel mit der `author.id` jedes Kommentars, um zu entscheiden, was bearbeitet oder gelöscht werden darf; `user.name` erscheint an den Kommentaren, die diese Sitzung schreibt.

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

`list` ist die Operation und kann nicht abgeschaltet werden. Die vier Mutationen nehmen jeweils `false` anstelle einer Funktion — dieselbe Form, die [gespeicherte Blöcke](/de/backend/saved-blocks), [Vorlagen](/de/backend/templates) und der [Versionsverlauf](/de/backend/version-history) verwenden, und aus demselben Grund: Eine Mutation abzuschalten sollte eine Entscheidung sein, die Sie *aussprechen*, und nie etwas, das Sie erhalten, weil Sie eine Methode vergessen haben.

Der Editor rendert die Reihenfolge von `list()` unverändert und sortiert nie um. Die Reihenfolge entscheidet Ihr Speicher.

### Threads sind eine Ebene tief

Ein Thread-Wurzelkommentar trägt `replies`; eine Antwort nie. Genau das rendert das Panel, daher ist das Flachlegen eines tieferen Baums Aufgabe Ihres Speichers und nicht des Editors.

### `updatedAt` bedeutet „bearbeitet"

Das Panel zeigt eine *(bearbeitet)*-Markierung, sobald `updatedAt` vorhanden ist. Setzen Sie es bei einer Bearbeitung, **nicht beim Anlegen** — ein Speicher, der es zusammen mit `createdAt` setzt, markiert jeden Kommentar als bearbeitet.

### `setResolved` nimmt den Zielzustand

Kein Umschalter. Der Aufruf ist idempotent, sodass zwei gleichzeitige Klicks einen Thread nicht invertiert zurücklassen können und Ihr Endpunkt vor dem Schreiben nie den aktuellen Zustand lesen muss.

Der Editor meldet das Ergebnis, das Ihr Speicher zurückgegeben hat, und nicht den Zustand, den er angefragt hat. Ein Speicher, der sich weigert, einen Thread wieder zu öffnen, antwortet „weiterhin gelöst", und das ist es, was die UI und `onComment` sagen werden.

## Review nur zum Lesen

Halten Sie alle vier Mutationen zurück, und das Panel wird lesbar und navigierbar, ohne dass sich etwas ändern lässt — Threads und Antworten werden gerendert, der Sprung zum Block funktioniert, und Eingabefeld, Lösen, Bearbeiten und Löschen sind **nicht vorhanden** statt deaktiviert:

```ts
comments: {
  list: (templateId) => api.comments(templateId),
  create: false,
  update: false,
  delete: false,
  setResolved: false,
}
```

Jede wirkt eigenständig. `setResolved: false` allein lässt Kommentieren und Bearbeiten unberührt, es gibt nur nichts zu lösen; `update: false` allein entfernt nur den Stift.

Der Editor verweigert auch auf der Composable-Ebene, nicht nur in der UI: Ein programmatischer Aufruf einer zurückgehaltenen Mutation **wird abgelehnt**, statt sich aufzulösen — denn ein aufgelöstes Promise liest sich für den Aufrufer als „gespeichert".

Die Zugehörigkeit je Kommentar kommt obendrauf: Bearbeiten und Löschen werden nur an den eigenen Kommentaren der aktuellen Person angeboten, und nur, wenn der Speicher diese Mutationen überhaupt bereitgestellt hat.

## Echtzeit ist optional

`subscribe` schiebt entfernte Änderungen in das offene Panel, sodass der Kommentar einer Kollegin ohne Neuladen erscheint. **Es ist wirklich optional**: Ohne diese Methode funktionieren Kommentare genauso, Sie sehen den Kommentar der anderen Person nur beim nächsten Lesen.

```ts
subscribe: (templateId, onChange) => {
  const source = new EventSource(`/api/templates/${templateId}/comments/stream`);
  source.onmessage = (event) => onChange(JSON.parse(event.data));
  return () => source.close();
},
```

Geben Sie eine Abmeldefunktion zurück; der Editor ruft sie auf, wenn die Vorlage wechselt und beim Abbau.

`CommentChange` ist eine kleine Union:

```ts
type CommentChange =
  | { type: 'created'; comment: Comment }
  | { type: 'updated'; comment: Comment }
  | { type: 'deleted'; commentId: string; parentId?: string | null };
```

Ein Löschvorgang trägt nur die ID und ihren Elternkommentar — es ist kein Kommentar mehr übrig, den man senden könnte, und der Elternkommentar erspart dem Editor eine Suche.

**Ihre eigenen Schreibvorgänge dürfen hier zurückkommen, und das erfordert auf Ihrer Seite keine Entdopplung.** Ein `created` für einen Kommentar, der bereits in der Liste steht, wird ignoriert, und ein `updated` ersetzt ihn an seiner Stelle.

## Filtern

Das Panel filtert **im Speicher** über das, was `list()` zurückgegeben hat: ungelöst (die Voreinstellung), alle oder dieser Block. Der Provider entscheidet also, *was sichtbar ist* — Geltungsbereich, Mandanten, Regeln je Person, alles innerhalb von `list()` — und der Editor entscheidet, wie darin eingegrenzt wird.

`CommentsListParams` ist reserviert und derzeit leer. Der Editor ruft `list` immer ohne Parameter auf; es existiert, damit Seitenweise Abfrage dort landen kann, ohne jede Implementierung zu brechen — dasselbe Vorbild, das [gespeicherte Blöcke](/de/backend/saved-blocks) mit `SavedBlocksListParams` gesetzt haben.

## Was die Nutzerin sieht

- **Eine Kommentar-Schaltfläche** im Header, mit einer Markierung, die ungelöste Threads zählt. Sie erscheint, sobald eine Vorlage geladen ist und die Funktion verfügbar ist.
- **Eine Kommentar-Markierung an jedem kommentierten Block** im Canvas mit der Anzahl für diesen Block. Ein Klick öffnet das Panel, gefiltert auf diesen Block.
- **Das Panel** rechts: Thread-Karten mit Autor, relativer Zeit, einer *(bearbeitet)*-Markierung, dem Lösen-Umschalter und Antworten / Bearbeiten / Löschen, soweit der Speicher es erlaubt.
- **Eine „Fehlender Block"-Markierung** an einem Kommentar, dessen Ankerblock nicht mehr in der Vorlage existiert, damit ein verwaister Thread sich als verwaist liest und nicht als Rätsel.

## Über Änderungen informiert werden

`onComment` wird für jede Änderung ausgelöst, die der Editor angewendet hat — lokale Schreibvorgänge *und* alles, was ein `subscribe` hereingeschoben hat. Damit ist es der Haken für eine „3 neue Kommentare"-Markierung außerhalb des Editors:

```ts
init({
  container,
  user,
  comments: myCommentsProvider,
  onComment: (event) => {
    // 'created' | 'updated' | 'deleted' | 'resolved' | 'unresolved'
    console.log(event.type, event.comment.id);
  },
});
```

`resolved` und `unresolved` werden getrennt von einem einfachen `updated` gemeldet, weil für eine Anwendung, die ein Team benachrichtigt, der Unterschied zählt.

## Kopflose Verwendung

`useComments` aus `@templatical/core` ist der reaktive Zustand für sich allein, ohne den Editor:

```ts
import { useComments } from '@templatical/core';

const comments = useComments({
  provider: myCommentsProvider,
  getTemplateId: () => currentTemplateId,
  getUser: () => currentUser,
  onComment: (event) => console.log(event.type),
  onError: (error) => console.error(error),
});

await comments.load();
comments.comments.value;                    // Comment[] — Thread-Wurzeln mit Antworten
comments.unresolvedCount.value;             // number
comments.commentCountByBlock.value;         // Map<string, number>
await comments.create({ body: 'Sieht gut aus' });
await comments.setResolved('c_1', true);
```

`useCommentListener` verbindet das `subscribe` eines Providers mit demselben Zustand und tut bei einem Provider ohne diese Methode nichts:

```ts
import { useCommentListener } from '@templatical/core';

useCommentListener({
  comments,
  provider: myCommentsProvider,
  getTemplateId: () => currentTemplateId,
});
```

## Templatical Cloud

Cloud implementiert diesen Vertrag und hostet das Gespräch, einschließlich des Teils, der wirklich mühsam zu bauen ist: Der Adapter implementiert `subscribe` über den Echtzeit-Kanal, den Cloud für die Zusammenarbeit ohnehin betreibt, sodass eine Cloud-Sitzung den Kommentar einer Kollegin sieht, während diese ihn schreibt. Die Kommentare von Cloud sind an die Plan-Funktion `commenting` und daran gebunden, dass die Vorlage **gespeichert** ist, denn Cloud verankert einen Kommentar serverseitig; `commenting: false` schaltet sie ab.

`initCloud()` nimmt **keinen** `comments`-Schlüssel an. Ein Kommentar ist an eine Vorlagen-ID gebunden, die Cloud ausgestellt hat, und seine Autorenschaft wird vom Auth-Token signiert — Cloud besitzt also das Gespräch. Dieselbe Behandlung erhalten [Vorlagen](/de/backend/templates) und der [Versionsverlauf](/de/backend/version-history), und aus demselben Grund. Ein aus JavaScript übergebener Provider wird mit einer Konsolenwarnung ignoriert.

Ebenso wird `user` nicht angenommen: Cloud füllt es aus dem `user`-Claim des Auth-Tokens, also demselben Claim, den sein Backend bei jedem Schreibvorgang prüft. Eine vom Consumer gelieferte Identität könnte ihm nur widersprechen.

Um Ihr eigenes Review-Backend mitzubringen, verwenden Sie `init()` — dort gehört Ihnen der gesamte Provider-Satz.

Siehe [Kommentare auf Cloud](/de/cloud/comments).
