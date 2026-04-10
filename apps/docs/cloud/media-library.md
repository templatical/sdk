---
title: Media Library
description: Upload, organize, and manage images with folders and search.
---

# Media Library

The Cloud media library provides a full image management system built into the editor. Users can upload, organize, browse, and insert images without leaving the editor.

## Features

- **Upload** — Drag-and-drop or click to upload images directly in the editor
- **Folders** — Organize images in a folder hierarchy
- **Search** — Find images by name or metadata
- **Image Editing** — Crop, resize, and replace images
- **Usage Tracking** — See which templates use an image before deleting
- **Import from URL** — Pull images from external URLs into the library
- **Storage Info** — Monitor storage usage per plan

The media library is automatically available when using `initCloud()`. No additional configuration is needed.

## Custom Media Picker

If you want to use your own media picker instead of the built-in library, provide the `onRequestMedia` callback:

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  onRequestMedia: async (context) => {
    // Open your custom media picker
    const selected = await myMediaPicker.open();

    if (!selected) return null;

    return {
      id: selected.id,
      url: selected.url,
      filename: selected.filename,
      width: selected.width,
      height: selected.height,
    };
  },
});
```

## Standalone Media Library SDK

The media library is also available as a standalone component for use outside the editor via the `@templatical/media-library` package:

```js
import { init } from '@templatical/media-library';

const mediaLibrary = init({
  container: '#media-library',
  auth: {
    mode: 'proxy',
    url: '/api/templatical/token',
  },
  onSelect: (item) => {
    console.log('Selected:', item.url);
  },
});
```

## API Client

For server-side or programmatic media operations:

```js
import { MediaApiClient } from '@templatical/media-library';

const client = new MediaApiClient(authManager);

// Browse images
const response = await client.browseMedia({ folder_id: 'folder-id', search: 'hero', category: 'images' });
// response: { data: MediaItem[], meta: { path, per_page, next_cursor, prev_cursor } }

// Upload
const item = await client.uploadMedia(file, folderId);

// Delete (accepts an array of IDs)
await client.deleteMedia(['item-id-1', 'item-id-2']);

// Check usage before deleting (accepts an array of IDs)
const usage = await client.checkMediaUsage(['item-id-1']);
```
