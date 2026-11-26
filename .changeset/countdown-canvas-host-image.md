---
"@templatical/editor": patch
---

The canvas now shows only the host countdown image. The JavaScript ticker that appeared when the image was missing or failed to load is gone, replaced by placeholders that say why; the ticker never matched the sent email. When `imageUrl` returns a different URL, the editor requests it 400 ms after the URL last changed (the same URL makes no new request) and keeps the previous image, dimmed with "Updating…", until the new one loads. Responses for outdated URLs are ignored. Hosts whose image URL is empty or fails to load now see a placeholder on the canvas instead of a ticker. There is no option or export that brings the ticker back: return a loadable image from `countdown.imageUrl` to show the countdown on the canvas.
