# Countdown

Show a hosted countdown image

init({ countdown: { imageUrl } }) — supply an image URL for countdown blocks.

Contract: https://docs.templatical.com/guide/countdown
Live: https://play.templatical.com/scenes/countdown

## Snippet

```ts
import { init } from "@templatical/editor";
import { createCountdownBlock, createDefaultTemplateContent } from "@templatical/types";
import "@templatical/editor/style.css";

const content = createDefaultTemplateContent();
content.blocks.push(createCountdownBlock({
  targetDate: "2026-12-24T18:00:00+01:00",
  timezone: "Europe/Berlin",
}));

const editor = await init({
  container: document.getElementById("editor"),
  content,
  countdown: {
    imageUrl: () => "/countdown-sample.gif",
  },
});
```
