---
title: Images
description: Handle image input, integrate custom media pickers, and configure image block properties.
---

# Images

By default, the editor provides a URL text input for image sources. You can replace this with a custom media picker using the `onRequestMedia` callback.

## Default Behavior

When a user adds an image block, the editor shows a text field where they can paste an image URL. The image block toolbar exposes fields for `src`, `alt`, `width`, `align`, and an optional `linkUrl`.

## Custom Media Picker

Use the `onRequestMedia` callback to open your own file browser, asset manager, or upload dialog:

```ts
import { init } from '@templatical/vue';

const editor = init({
  container: '#editor',
  onRequestMedia(callback) {
    // Open your media picker UI
    openMediaLibrary({
      onSelect(asset) {
        // Call the callback with the selected image URL
        callback(asset.url);
      },
    });
  },
});
```

The callback signature:

```ts
onRequestMedia?: (callback: (url: string) => void) => void;
```

When the editor needs an image (from the image block, video thumbnail, or any other media field), it calls `onRequestMedia` and passes a `callback` function. Call that function with the final URL string to set the image. If the user cancels the picker, simply don't call the callback.

### Example: Upload to S3

```ts
const editor = init({
  container: '#editor',
  onRequestMedia(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const { url } = await res.json();

      callback(url);
    };

    input.click();
  },
});
```

## Image Block Properties

The `ImageBlock` type defines all configurable properties:

| Property | Type | Description |
|---|---|---|
| `src` | `string` | Image source URL |
| `alt` | `string` | Alt text for accessibility |
| `width` | `number \| 'full'` | Image width in pixels, or `'full'` for 100% |
| `align` | `'left' \| 'center' \| 'right'` | Horizontal alignment |
| `linkUrl` | `string` (optional) | Wraps the image in a link |
| `linkOpenInNewTab` | `boolean` (optional) | Opens the link in a new tab |
| `previewUrl` | `string` (optional) | Design-time preview image when `src` uses a merge tag |

### Preview URL

When the `src` field contains a merge tag placeholder (e.g., <code v-pre>{{product.image}}</code>), the actual image won't render in the editor. Use `previewUrl` to provide a real image for design-time preview. This value is not included in the exported output.

## Setting Images Programmatically

You can set image content through the `setContent` method by including image blocks in your template content:

```ts
editor.setContent({
  settings: { width: 600, backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' },
  blocks: [
    {
      id: crypto.randomUUID(),
      type: 'image',
      src: 'https://example.com/hero.png',
      alt: 'Hero banner',
      width: 'full',
      align: 'center',
      styles: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    },
  ],
});
```
