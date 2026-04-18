---
title: Zusammenarbeit
description: Echtzeit-Co-Editing mit Live-Cursorn und Block-Sperren.
---

# Zusammenarbeit

Mehrere Teammitglieder können dasselbe Template gleichzeitig bearbeiten. Das Kollaborationssystem bietet Live-Präsenz-Tracking und Block-Sperren, um Konflikte zu vermeiden.

## Zusammenarbeit aktivieren

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  collaboration: {
    enabled: true,
  },
});
```

## So funktioniert es

Wenn die Zusammenarbeit aktiviert ist:

1. **Präsenz** – Avatar und Name jedes Nutzers erscheinen in der Editor-Toolbar und zeigen an, wer das Template aktuell ansieht
2. **Block-Sperren** – Wenn ein Nutzer einen Block auswählt, wird dieser für andere Mitarbeitende gesperrt. Andere Nutzer sehen einen visuellen Hinweis, wer diesen Block bearbeitet
3. **Live-Updates** – Änderungen werden in Echtzeit per WebSocket übertragen. Wenn ein Nutzer einen Block hinzufügt, verschiebt oder ändert, sehen andere Mitarbeitende die Änderung sofort
4. **Konfliktvermeidung** – Der Sperrmechanismus verhindert, dass zwei Nutzer gleichzeitig denselben Block bearbeiten, und beseitigt so Merge-Konflikte

## Callbacks

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  collaboration: {
    enabled: true,
  },
  // Auf Kollaborations-Ereignisse reagieren
  onError: (error) => {
    console.error('Collaboration error:', error);
  },
});
```

## Composable

Für benutzerdefinierte UI-Implementierungen:

```js
import { useCollaboration } from '@templatical/core/cloud';

const {
  collaborators,    // Ref<Collaborator[]> — aktuell verbundene Nutzer
  lockedBlocks,     // Ref<Map<string, Collaborator>> — blockId → wer hat gesperrt
} = useCollaboration({
  authManager,
  editor,
  channel,          // Ref<PresenceChannel | null>
  onCollaboratorJoined: (user) => { /* Nutzer beigetreten */ },
  onCollaboratorLeft: (user) => { /* Nutzer verlassen */ },
  onBlockLocked: ({ blockId, collaborator }) => { /* Block gesperrt */ },
  onBlockUnlocked: ({ blockId, collaborator }) => { /* Block entsperrt */ },
});
```

### Collaborator-Objekt

```ts
interface Collaborator {
  id: string;
  name: string;
  color: string;
  selectedBlockId: string | null;
}
```

## Voraussetzungen

- Zusammenarbeit setzt eine WebSocket-Verbindung voraus. Das SDK verbindet sich automatisch mithilfe der WebSocket-Konfiguration, die in der Antwort des Auth-Tokens enthalten ist.
- Jeder Nutzer muss ein `user`-Objekt in seiner Token-Antwort haben (siehe [Authentifizierung](/de/cloud/authentication)), damit sein Name korrekt angezeigt wird. Jedem Mitarbeitenden wird automatisch eine `color` zur visuellen Identifikation zugewiesen.
