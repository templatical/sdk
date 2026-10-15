# Media on request

Pick images in your own UI

init({ onRequestMedia }) — a host-owned picker replaces the media library.

Contract: https://docs.templatical.com/guide/images#browse-and-pick
Live: https://play.templatical.com/scenes/media-on-request

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  onRequestMedia: async (context) => {
    // A file was dropped on an image field: upload it, return its URL
    if (context?.files?.length) {
      return { url: await uploadToYourBackend(context.files[0]) };
    }
    // Browse Media: open your own picker; return { url, alt } or null
    return await yourMediaPicker();
  },
});
```
