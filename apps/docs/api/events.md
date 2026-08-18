---
title: Events
description: Editor event callbacks — onChange, onDirtyChange, onError, and media/merge tag request handlers.
---

# Events

The editor communicates with your application through callback functions passed in the configuration.

## Content Events

### `onChange`

Called whenever the template content changes. The callback receives the full `TemplateContent` object. Changes are debounced internally.

```ts
const editor = await init({
  container: '#editor',
  onChange(content) {
    // Save to your backend
    fetch('/api/templates/123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    });
  },
});
```

### `onDirtyChange`

Called whenever the editor gains or loses unsaved changes. Use it to drive your own save button, or to guard a client-side route change — the built-in guard covers tab close, but `beforeunload` never fires on SPA navigation.

```ts
const editor = await init({
  container: '#editor',
  onDirtyChange(isDirty) {
    setRouteGuard(isDirty);
  },
});
```

### `onComment`

Called for every comment change the editor applied — a thread created, edited, resolved or deleted. Changes that arrive through a provider's `subscribe` fire it too, so it is the hook for an unread badge outside the editor.

```ts
const editor = await init({
  container: '#editor',
  comments: myProvider,
  user: { id: 'u_7', name: 'Ada Lovelace' },
  onComment(event) {
    if (event.type === 'created') incrementUnread();
  },
});
```

### `onError`

Called when an error occurs within the editor.

```ts
const editor = await init({
  container: '#editor',
  onError(error) {
    console.error('Editor error:', error.message);
    reportToSentry(error);
  },
});
```

## Request Events

### `onRequestMedia`

Called when the user clicks to select an image (e.g. in the image block settings) **or drags an image file onto an image block/field**. Return a `MediaResult` object, or `null` if the user cancels. When `alt` is provided, the editor automatically fills in the image's alt text.

On a drag-and-drop, the dropped file arrives in `context.files` — upload it and return the hosted URL. See [Drag and drop to upload](/guide/images#drag-and-drop-to-upload) for the full pattern.

```ts
import type { MediaResult } from '@templatical/types';

const editor = await init({
  container: '#editor',
  async onRequestMedia(context?): Promise<MediaResult | null> {
    const image = await openMediaPicker();
    if (!image) return null;
    return { url: image.url, alt: image.alt };
  },
});
```

If you don't provide `onRequestMedia`, the editor shows a text input where users type or paste image URLs directly.

### `mergeTags.onRequest`

Called when the user clicks to insert a merge tag in a title or paragraph block. Return a `Promise` that resolves to a `MergeTag` object or `null` if the user cancels.

```ts
import type { MergeTag } from '@templatical/types';

const editor = await init({
  container: '#editor',
  mergeTags: {
    tags: [
      { label: 'First Name', value: '{{first_name}}' },
      { label: 'Email', value: '{{email}}' },
    ],
    async onRequest(): Promise<MergeTag | null> {
      // Show your own picker UI and return the selected tag
      const tag = await showMergeTagPicker();
      return tag; // or null if cancelled
    },
  },
});
```

If you provide `mergeTags.tags` without `onRequest`, the editor uses a built-in dropdown populated with your tags. The `onRequest` callback lets you replace that dropdown with your own UI.

## Patterns

### Debounced Auto-Save

```ts
let saveTimeout: ReturnType<typeof setTimeout>;

const editor = await init({
  container: '#editor',
  onChange(content) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveToBackend(content);
    }, 2000);
  },
});
```

### Dirty State Tracking

```ts
const editor = await init({
  container: '#editor',
  onDirtyChange(isDirty) {
    updateSaveButton(isDirty);
  },
});
```

The editor already warns on tab close when a `templates` provider is configured — opt out with `unsavedChangesGuard: false`. `onDirtyChange` is what you need for a client-side router, which `beforeunload` cannot see.
