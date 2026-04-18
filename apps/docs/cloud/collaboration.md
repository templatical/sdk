---
title: Collaboration
description: Real-time co-editing with live cursors and block locking.
---

# Collaboration

Multiple team members can edit the same template simultaneously. The collaboration system provides live presence tracking and block-level locking to prevent conflicts.

## Enable Collaboration

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  collaboration: {
    enabled: true,
  },
});
```

## How It Works

When collaboration is enabled:

1. **Presence** — Each user's avatar and name appears in the editor toolbar, showing who is currently viewing the template
2. **Block Locking** — When a user selects a block, it becomes locked for other collaborators. Other users see a visual indicator showing who is editing that block
3. **Live Updates** — Changes are broadcast in real-time via WebSocket. When one user adds, moves, or modifies a block, other collaborators see the change immediately
4. **Conflict Prevention** — The locking mechanism prevents two users from editing the same block simultaneously, eliminating merge conflicts

## Callbacks

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  collaboration: {
    enabled: true,
  },
  // React to collaboration events
  onError: (error) => {
    console.error('Collaboration error:', error);
  },
});
```

## Composable

For custom UI implementations:

```js
import { useCollaboration } from '@templatical/core/cloud';

const {
  collaborators,    // Ref<Collaborator[]> — currently connected users
  lockedBlocks,     // Ref<Map<string, Collaborator>> — blockId → who locked it
} = useCollaboration({
  authManager,
  editor,
  channel,          // Ref<PresenceChannel | null>
  onCollaboratorJoined: (user) => { /* user joined */ },
  onCollaboratorLeft: (user) => { /* user left */ },
  onBlockLocked: ({ blockId, collaborator }) => { /* block locked */ },
  onBlockUnlocked: ({ blockId, collaborator }) => { /* block unlocked */ },
});
```

### Collaborator Object

```ts
interface Collaborator {
  id: string;
  name: string;
  color: string;
  selectedBlockId: string | null;
}
```

## Requirements

- Collaboration requires WebSocket connectivity. The SDK connects automatically using the WebSocket configuration provided in the auth token response.
- Each user must have a `user` object in their token response (see [Authentication](/cloud/authentication)) for their name to display correctly. Each collaborator is assigned an automatic `color` for visual identification.
