---
title: Images
description: Handle image input, integrate custom media pickers, and configure image block properties.
---

# Images

When a user adds an image block, the editor shows a text field where they can paste an image URL. The image block toolbar exposes fields for `src`, `alt`, `width`, `align`, and an optional `linkUrl`.

<img src="/images/image-fields.png" alt="Image block fields" style="max-width: 360px;" />

## Custom Media Picker

When the `onRequestMedia` callback is provided, a browse button appears alongside the URL input.

<img src="/images/image-picker.png" alt="Media picker button" style="max-width: 360px;" />

The editor calls this function whenever the user clicks the button. Return a `MediaResult` object, or `null` if the user cancels. When `alt` is provided, the editor automatically fills in the image's alt text.

```ts
import { init } from '@templatical/editor';

const editor = init({
  container: '#editor',
  async onRequestMedia() {
    // Open your own modal, file browser, or asset manager
    const image = await openMyMediaModal();
    if (!image) return null;

    return { url: image.url, alt: image.alt };
  },
});
```

The type signature:

```ts
interface MediaResult {
  url: string;
  alt?: string;
}

onRequestMedia?: () => Promise<MediaResult | null>;
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
| `placeholderUrl` | `string` (optional) | Design-time preview image when `src` uses a merge tag |

### Placeholder URL

When the `src` field contains a merge tag placeholder (e.g., <code v-pre>{{product.image}}</code>), the actual image won't render in the editor. Use `placeholderUrl` to provide a placeholder image in the editor. This value is not included in the exported output.

## Best practices

- **Use absolute URLs** -- Relative paths won't resolve in email clients. Always use `https://` URLs.
- **Prefer PNG or JPG** -- SVG and WebP have limited email client support. Use PNG for graphics with transparency, JPG for photos.
- **Keep file sizes reasonable** -- Large images slow down loading for recipients.
- **Always set alt text** -- Many email clients (especially Outlook) block images by default. Recipients see the alt text until they choose to load images.
- **Set explicit width** -- Email clients may render images at their native size if no width is specified, breaking your layout on small screens.
