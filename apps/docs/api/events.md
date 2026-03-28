---
title: Events
description: Editor event callbacks — onChange, onSave, onError, and media/merge tag request handlers.
---

# Events

The editor communicates with your application through callback functions passed in the configuration.

## Content Events

### `onChange`

Called whenever the template content changes. The callback receives the full `TemplateContent` object. Changes are debounced internally.

```ts
const editor = init({
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

### `onSave`

Called when the user explicitly triggers a save (e.g. via keyboard shortcut). Use this for immediate saves vs. the debounced `onChange`.

```ts
const editor = init({
  container: '#editor',
  onSave(content) {
    saveTemplate(content);
    showNotification('Template saved');
  },
});
```

### `onError`

Called when an error occurs within the editor.

```ts
const editor = init({
  container: '#editor',
  onError(error) {
    console.error('Editor error:', error.message);
    reportToSentry(error);
  },
});
```

## Request Events

### `onRequestMedia`

Called when the user clicks to select an image (e.g. in the image block settings). Return a `MediaResult` object, or `null` if the user cancels. When `alt` is provided, the editor automatically fills in the image's alt text.

```ts
import type { MediaResult } from '@templatical/types';

const editor = init({
  container: '#editor',
  async onRequestMedia(): Promise<MediaResult | null> {
    const image = await openMediaPicker();
    if (!image) return null;
    return { url: image.url, alt: image.alt };
  },
});
```

If you don't provide `onRequestMedia`, the editor shows a text input where users type or paste image URLs directly.

### `mergeTags.onRequest`

Called when the user clicks to insert a merge tag in a text block. Return a `Promise` that resolves to a `MergeTag` object or `null` if the user cancels.

```ts
import type { MergeTag } from '@templatical/types';

const editor = init({
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

const editor = init({
  container: '#editor',
  onChange(content) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveToBackend(content);
    }, 2000);
  },
  onSave(content) {
    clearTimeout(saveTimeout);
    saveToBackend(content);
  },
});
```

### Dirty State Tracking

```ts
let isDirty = false;

const editor = init({
  container: '#editor',
  onChange() {
    isDirty = true;
    updateSaveButton();
  },
  onSave(content) {
    saveToBackend(content).then(() => {
      isDirty = false;
      updateSaveButton();
    });
  },
});

window.addEventListener('beforeunload', (e) => {
  if (isDirty) {
    e.preventDefault();
  }
});
```
