---
title: Snapshots
description: Version history with comparison and restore.
---

# Snapshots

Snapshots provide automatic version history for your templates. Every save creates a snapshot, allowing you to compare versions side-by-side and restore any previous state.

## How It Works

1. **Automatic Saves** — Snapshots are created automatically when a template is saved
2. **Browse History** — Open the snapshots panel to see all previous versions with timestamps
3. **Compare** — View what changed between versions
4. **Restore** — Roll back to any previous version with one click

## Composable

```js
import { useSnapshotHistory } from '@templatical/core/cloud';

const {
  snapshots,      // Ref<TemplateSnapshot[]>
  isLoading,      // Ref<boolean>
  isRestoring,    // Ref<boolean>

  loadSnapshots,     // () => Promise<void>
  restoreSnapshot,   // (snapshotId) => Promise<Template>
} = useSnapshotHistory({
  authManager,
  templateId: 'template-id',
  onRestore: (template) => {
    // Template restored — update the editor
  },
  onError: (error) => { /* handle error */ },
});
```
