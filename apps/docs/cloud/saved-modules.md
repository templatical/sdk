---
title: Saved Modules
description: Reusable template sections shared across your team.
---

# Saved Modules

Save reusable template sections — headers, footers, product grids, CTAs — and insert them across templates. Modules stay in sync across your team.

## How It Works

1. **Save** — Select one or more sections in the editor and save them as a module with a name
2. **Browse** — The modules panel shows all saved modules with search
3. **Insert** — Click a module to insert it into the current template at the cursor position
4. **Manage** — Rename or delete modules from the panel

## Enabling Modules

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  modules: true,
});
```

## Composable

```js
import { useSavedModules } from '@templatical/core/cloud';

const {
  modules,        // Ref<SavedModule[]>
  isLoading,      // Ref<boolean>

  loadModules,    // (search?) => Promise<void>
  createModule,   // (name, content) => Promise<SavedModule>
  updateModule,   // (id, data) => Promise<SavedModule>
  deleteModule,   // (id) => Promise<void>
} = useSavedModules({
  authManager,
  onError: (error) => { /* handle error */ },
});
```
