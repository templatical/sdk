---
"@templatical/editor": patch
---

The canvas now shows only the host countdown image. The JavaScript ticker that appeared when the image was missing or failed to load is gone, replaced by placeholders that say why; the ticker never matched the sent email. The editor waits 400 ms after the last edit before requesting a new image and keeps the previous image, dimmed with "Updating…", until the new one loads. Responses for outdated URLs are ignored. Hosts whose image URL fails now see a placeholder on the canvas instead of a ticker.
