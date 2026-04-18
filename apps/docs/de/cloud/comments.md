---
title: Kommentare
description: Inline-Review-Threads an einzelnen Blöcken.
---

# Kommentare

Fügen Sie Inline-Kommentare an einzelnen Blöcken für Review-Workflows hinzu. Teammitglieder können Änderungen diskutieren, Threads auflösen und Feedback verfolgen, ohne den Editor zu verlassen.

## Kommentare aktivieren

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  commenting: true,
  onComment: (event) => {
    // Wird benachrichtigt, wenn Kommentare erstellt, aktualisiert oder gelöscht werden
    console.log(event);
  },
});
```

## So funktioniert es

1. **Kommentare hinzufügen** – Nutzer klicken auf einen Block und öffnen das Kommentar-Panel, um Feedback zu hinterlassen
2. **Antwort-Threads** – Kommentare unterstützen Thread-Antworten für fokussierte Diskussionen
3. **Auflösen** – Markieren Sie Threads als aufgelöst, wenn das Feedback umgesetzt wurde
4. **Echtzeit** – Ist die Zusammenarbeit aktiviert, erscheinen Kommentare sofort bei allen verbundenen Nutzern

## Composable

```js
import { useComments } from '@templatical/core/cloud';

const {
  // Zustand
  comments,             // Ref<CommentThread[]>
  isLoading,            // Ref<boolean>
  isSubmitting,         // Ref<boolean>
  isEnabled,            // ComputedRef<boolean>
  commentCountByBlock,  // ComputedRef<Map<string, number>>
  totalCount,           // ComputedRef<number>
  unresolvedCount,      // ComputedRef<number>

  // Operationen
  loadComments,         // () => Promise<void>
  addComment,           // (body, blockId?, parentId?) => Promise<Comment | null>
  editComment,          // (commentId, body) => Promise<Comment | null>
  removeComment,        // (commentId) => Promise<boolean>
  toggleResolve,        // (commentId) => Promise<Comment | null>
} = useComments({
  authManager,
  getTemplateId: () => templateId,
  getSocketId: () => socketId,             // WebSocket-Socket-ID zur Echo-Vermeidung
  isAuthReady: () => true,                 // Laden erst freigeben, wenn Auth bereit ist
  hasCommentingFeature: () => true,        // Auf Basis der Plan-Funktionen freischalten
  onComment: (event) => { /* Kommentar-Ereignis */ },
  onError: (error) => { /* Fehler behandeln */ },
});
```

## Echtzeit-Synchronisation

Wenn der WebSocket verbunden ist, synchronisieren sich Kommentare automatisch zwischen allen Mitarbeitenden. Das Composable bietet Methoden zum Anwenden entfernter Aktualisierungen:

```js
const { applyRemoteCreate, applyRemoteUpdate, applyRemoteDelete } = useComments({
  // ...Optionen
});
```

Diese werden automatisch vom `useCommentListener`-Composable aufgerufen, wenn WebSocket-Ereignisse eintreffen.
