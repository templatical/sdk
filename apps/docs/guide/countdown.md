---
title: Countdown
description: "Configure `init({ countdown: { imageUrl } })` to show a countdown image in the editor and export it as MJML."
---

# Countdown

Configure `init({ countdown: { imageUrl } })` to show a countdown image in the editor and export it as MJML.

```ts
import { init } from "@templatical/editor";
import type { CountdownBlock } from "@templatical/types";
import "@templatical/editor/style.css";

const imageUrl = (block: CountdownBlock): string => {
  const url = new URL("https://play.templatical.com/countdown-sample.gif");
  url.searchParams.set("targetDate", block.targetDate);
  url.searchParams.set("timezone", block.timezone);
  return url.toString();
};

const container = document.createElement("div");
container.style.height = "100vh";
document.body.append(container);

const editor = await init({
  container,
  countdown: { imageUrl },
});
```

The playground URL returns a **static sample GIF**. It demonstrates the URL shape and canvas rendering; its query parameters do not make it count down. Replace its base URL with your own endpoint or a URL-based countdown image service that reads `targetDate` and `timezone` and returns an image that remains current when the recipient opens the email. The editor makes the Countdown block insertable only when `countdown` is configured.

## Provider and renderer contract

`CountdownProvider` from `@templatical/types` has exactly this method:

```ts
interface CountdownProvider {
  imageUrl(block: CountdownBlock): string;
}
```

`imageUrl` runs synchronously and returns the image URL. `CountdownBlock.targetDate` and `CountdownBlock.timezone` are strings; the latter is an IANA timezone. The image supplies its own size. The following exports are available for headless rendering and recipient-facing alt text:

```ts
renderCountdownImage(
  block: CountdownBlock,
  src: string,
  options?: { locale?: string },
): string;

countdownAltText(block: CountdownBlock, locale: string | undefined): string;
```

`renderCountdownImage` is exported by `@templatical/renderer`. It returns an `<mj-image>` with the supplied `src`, escaped attributes and localized alt text. `countdownAltText` is exported by `@templatical/types`; it describes the target date in the template language. The local editor render path uses the template's locale automatically. A host `render.toMjml` override owns its own render path.

## Headless MJML

Pass the same URL function to `renderToMjml` through `blockRenderers.countdown`:

```ts
import { renderCountdownImage, renderToMjml } from "@templatical/renderer";
import { createCountdownBlock, createDefaultTemplateContent } from "@templatical/types";
import type { CountdownBlock } from "@templatical/types";

const imageUrl = (block: CountdownBlock): string => {
  const url = new URL("https://play.templatical.com/countdown-sample.gif");
  url.searchParams.set("targetDate", block.targetDate);
  url.searchParams.set("timezone", block.timezone);
  return url.toString();
};

const content = createDefaultTemplateContent();
content.blocks.push(createCountdownBlock({
  targetDate: "2026-12-24T18:00:00+01:00",
  timezone: "Europe/Berlin",
}));

const mjml = await renderToMjml(content, {
  blockRenderers: {
    countdown: (block) => renderCountdownImage(block, imageUrl(block), {
      locale: content.settings.locale,
    }),
  },
});
```

## Limits

The SDK ships no GIF server. Your image service generates and serves the countdown image. Email HTML is static after sending, so the image service also handles expiry, `expiredMessage`, `expiredImageUrl` and `hideOnExpiry`; the editor cannot hide a sent block later. When an image URL fails to load on the canvas, the editor falls back to its CSS preview. An empty URL renders the `templatical:unrenderable-block` marker, as does a countdown block rendered headlessly without `blockRenderers.countdown`.

## Check it

Install the optional `@templatical/renderer` peer for the editor's local `toMjml()` path. After adding a countdown block, `await editor.toMjml()` contains `<mj-image src="…">` for that block. For a direct check using the editor above:

```ts
import { createCountdownBlock } from "@templatical/types";

const content = editor.getContent();
content.blocks.push(createCountdownBlock({
  targetDate: "2026-12-24T18:00:00+01:00",
  timezone: "Europe/Berlin",
}));
editor.setContent(content);
const mjml = await editor.toMjml();
if (!mjml.includes('<mj-image\n  src="https://play.templatical.com/countdown-sample.gif')) {
  throw new Error("Countdown image missing from MJML");
}
```

## In the playground

The [Countdown setup](https://play.templatical.com/scenes/countdown) uses the static sample GIF so you can inspect the provider and the canvas without an image service.
