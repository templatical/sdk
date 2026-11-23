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

// 18:00 Berlin time, about thirty days ahead.
const target = new Date(Date.now() + 30 * 86_400_000);

const content = createDefaultTemplateContent();
content.blocks.push(createCountdownBlock({
  targetDate: `${target.toISOString().slice(0, 10)}T18:00`,
  timezone: "Europe/Berlin",
}));

const editor = await init({
  container: document.getElementById("editor"),
  content,
  countdown: {
    imageUrl: () => "https://play.templatical.com/countdown-sample.gif",
  },
});
```
