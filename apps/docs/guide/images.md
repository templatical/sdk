---
title: Images
description: Handle image input, integrate custom media pickers, and configure image block properties.
---

# Images

By default, the editor provides a URL text input for image sources. You can replace this with a custom media picker using the `onRequestMedia` callback.

::: tip Email image best practices
- **Use absolute URLs** -- Relative paths won't resolve in email clients. Always use `https://` URLs.
- **Prefer PNG or JPG** -- SVG and WebP have limited email client support. Use PNG for graphics with transparency, JPG for photos.
- **Keep file sizes under 1MB** -- Large images slow down email loading and may be clipped by Gmail (which truncates emails over 102KB of HTML).
- **Always set alt text** -- Many email clients (especially Outlook) block images by default. Recipients see the alt text until they choose to load images.
- **Set explicit width** -- Email clients may render images at their native size if no width is specified, breaking your layout on small screens.
:::

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

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Upload failed');
        const { url } = await res.json();

        callback(url);
      } catch (error) {
        console.error('Image upload failed:', error);
        // Don't call callback — the editor stays in its current state
      }
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
