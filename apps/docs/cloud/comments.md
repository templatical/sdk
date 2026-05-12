---
title: Comments
description: Inline review threads on specific blocks.
---

# Comments

Add inline comments on specific blocks for review workflows. Team members can discuss changes, resolve threads, and track feedback without leaving the editor.

## Enable Comments

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  commenting: true,
  onComment: (event) => {
    // Notified when comments are created, updated, or deleted
    console.log(event);
  },
});
```

## How It Works

1. **Add Comments** — Users click on a block and open the comment panel to leave feedback
2. **Reply Threads** — Comments support threaded replies for focused discussions
3. **Resolve** — Mark threads as resolved when feedback has been addressed
4. **Real-Time** — When collaboration is enabled, comments appear instantly for all connected users

## Composable

```js
import { useComments } from '@templatical/core/cloud';

const {
  // State
  comments,             // Ref<CommentThread[]>
  isLoading,            // Ref<boolean>
  isSubmitting,         // Ref<boolean>
  isEnabled,            // ComputedRef<boolean>
  commentCountByBlock,  // ComputedRef<Map<string, number>>
  totalCount,           // ComputedRef<number>
  unresolvedCount,      // ComputedRef<number>

  // Operations
  loadComments,         // () => Promise<void>
  addComment,           // (body, blockId?, parentId?) => Promise<Comment | null>
  editComment,          // (commentId, body) => Promise<Comment | null>
  removeComment,        // (commentId) => Promise<boolean>
  toggleResolve,        // (commentId) => Promise<Comment | null>
} = useComments({
  authManager,
  getTemplateId: () => templateId,
  getSocketId: () => socketId,             // WebSocket socket ID for echo prevention
  isAuthReady: () => true,                 // Gate loading until auth is ready
  hasCommentingFeature: () => true,        // Gate based on plan features
  onComment: (event) => { /* comment event */ },
  onError: (error) => { /* handle error */ },
});
```

## Real-Time Sync

When WebSocket is connected, comments sync automatically across all collaborators. The composable provides methods for applying remote updates:

```js
const { applyRemoteCreate, applyRemoteUpdate, applyRemoteDelete } = useComments({
  // ...options
});
```

These are called automatically by the `useCommentListener` composable when WebSocket events arrive.
