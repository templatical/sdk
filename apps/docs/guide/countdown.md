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

The playground URL returns a **fixed sample GIF**: the same 30-second loop for every request. It demonstrates the URL shape and canvas rendering; it ignores the query parameters and does not count down to the target. Replace its base URL with your own endpoint or a URL-based countdown image service that reads `targetDate` and `timezone` and returns an image that remains current when the recipient opens the email. The editor makes the Countdown block insertable only when `countdown` is configured.

## Canvas image

The canvas shows the image `imageUrl` returns for the block as it stands in the editor. Without an image URL it shows a placeholder; if the image fails to load, the placeholder shows the failed URL.

The editor loads the image as follows:

- The first image loads as soon as the block appears.
- After that, the editor requests a new image only when the URL changes, 400 ms after it last changed. A host that returns the same URL after an edit gets no new request, so put whatever should refresh the image into the URL.
- While the new image loads, the previous one stays visible, dimmed with “Updating…”.

The canvas and the email can show different images:

- With [`resolveImageUrl`](/guide/images#display-only-url-resolution) configured, the canvas shows and debounces the resolved URL, while the email keeps the `imageUrl` result.
- The editor's local render path (`toMjml()`, `toHtml()`) writes the `imageUrl` result into the email; a backend render can send a different URL, such as a [signed URL](#signed-urls-at-render-time).
- A host that renders from the stored block ([Block lookup from storage](#block-lookup-from-storage)) can draw unsaved edits on the canvas before they reach recipients.

## Provider and renderer contract

`CountdownProvider` from `@templatical/types` has exactly this method:

```ts
interface CountdownProvider {
  imageUrl(block: CountdownBlock): string;
}
```

`imageUrl` runs synchronously and returns the image URL. `CountdownBlock.targetDate` is wall-clock time, `YYYY-MM-DDTHH:mm`, read in `CountdownBlock.timezone`, an IANA timezone such as `Europe/Berlin`: the value the editor's date field writes. Your image service reads the pair the same way. A `targetDate` with `Z` or an offset is read as that instant, and the editor shows it as wall time in the block's timezone. The image supplies its own size. The following exports are available for headless rendering and recipient-facing alt text:

```ts
declare function renderCountdownImage(
  block: CountdownBlock,
  src: string,
  options?: { locale?: string },
): string;

declare function countdownAltText(block: CountdownBlock, locale: string | undefined): string;

declare function countdownTargetTime(
  block: Pick<CountdownBlock, "targetDate" | "timezone">,
): number | null;

declare function countdownWallTime(
  block: Pick<CountdownBlock, "targetDate" | "timezone">,
): string;
```

Toolbar fields other than `targetDate` and `timezone` affect the sent email only when the host's image service reads them, either from the image URL or from the stored block.

`renderCountdownImage` is exported by `@templatical/renderer`. It returns an `<mj-image>` with the supplied `src`, escaped attributes and localized alt text. `countdownAltText` is exported by `@templatical/types`; it describes the target date in the template language. `countdownTargetTime` returns the target as epoch milliseconds, or `null` for an empty, unreadable or impossible date, or for an offset-free date with an unknown timezone (a date with `Z` or an offset ignores `timezone`); `countdownWallTime` returns it as `YYYY-MM-DDTHH:mm` in the block's timezone, or `""`. The local editor render path uses the template's locale automatically. A host `render.toMjml` override owns its own render path.

## Headless MJML

Pass the same URL function to `renderToMjml` through `blockRenderers.countdown`:

```ts
import { renderCountdownImage, renderToMjml } from "@templatical/renderer";
import { createCountdownBlock, createDefaultTemplateContent, isCountdown } from "@templatical/types";
import type { CountdownBlock } from "@templatical/types";

const imageUrl = (block: CountdownBlock): string => {
  const url = new URL("https://play.templatical.com/countdown-sample.gif");
  url.searchParams.set("targetDate", block.targetDate);
  url.searchParams.set("timezone", block.timezone);
  return url.toString();
};

const content = createDefaultTemplateContent();
content.blocks.push(createCountdownBlock({
  targetDate: "2026-12-24T18:00",
  timezone: "Europe/Berlin",
}));

const mjml = await renderToMjml(content, {
  blockRenderers: {
    countdown: (block) => {
      if (!isCountdown(block)) return "";
      return renderCountdownImage(block, imageUrl(block), {
        locale: content.settings.locale,
      });
    },
  },
});
```

## Image endpoint security

The image URL is in the HTML of every sent email, and mail clients fetch it without your cookies or headers; Gmail's image proxy and Apple Mail Privacy Protection fetch it too. Session authentication and per-IP rate limits therefore don't protect the endpoint: the URL itself has to identify a countdown your application created. `imageUrl` runs synchronously in the browser, so it can't hold a signing secret, and any token it adds to the URL can be read from every email.

### Block lookup from storage

Return a URL that names the stored template and block instead of trusting the settings in the URL. This needs a stored copy of the template the endpoint can look up, from a `templates` provider or from your own save of `getContent()`; how you store it and check the lookup is your application's choice.

```ts
import type { CountdownBlock } from "@templatical/types";

// The id of the template the editor has open. Update it when your app loads or creates a template.
let currentTemplateId = "tpl_123";

const PREVIEW_FIELDS = [
  "targetDate", "timezone", "showDays", "showHours", "showMinutes", "showSeconds",
  "separator", "digitFontSize", "digitColor", "labelColor", "labelFontSize",
  "backgroundColor", "fontFamily", "labelDays", "labelHours", "labelMinutes",
  "labelSeconds", "expiredMessage", "expiredImageUrl", "hideOnExpiry",
] as const satisfies readonly (keyof CountdownBlock)[];

export function setCurrentTemplateId(id: string): void {
  currentTemplateId = id;
}

export const imageUrl = (block: CountdownBlock): string => {
  const path = `/countdown/${encodeURIComponent(currentTemplateId)}/${encodeURIComponent(block.id)}.gif`;
  const url = new URL(path, "https://app.example.com");
  // Only an authenticated editor session reads these; they preview unsaved changes.
  for (const field of PREVIEW_FIELDS) {
    const value = block[field];
    if (value !== undefined) url.searchParams.set(field, String(value));
  }
  return url.toString();
};
```

The endpoint then decides what to render:

- **No editor session (a recipient or an image proxy):** ignore the query string, load the stored template, find the block by id and render from its stored fields. Answer 404 when the template or block doesn't exist. Deleting the template stops later requests from resolving; a copy a recipient's client or a cache already fetched stays as it is.
- **An authenticated editor session:** render from the query string, so unsaved changes show on the canvas. The canvas sends your cookies only when the endpoint is on your app's site.
- **Sent emails stay as sent** only if the URL names a template version rather than the live template; otherwise editing the countdown later changes emails already delivered.

Save the template before sending: a block that was never saved has nothing to resolve.

### Signed URLs at render time

A backend that renders the sent email (a `render.toMjml` provider, or `renderToMjml` with `blockRenderers.countdown`) can return a signed URL instead: an HMAC, with a secret only the server holds, over every parameter the endpoint reads. Stored templates contain no image URL, so the signature is added when rendering. HTML produced in the browser by `editor.toMjml()` or `editor.toHtml()` carries whatever `imageUrl` returned and can't be signed this way.

### Endpoint limits

These apply with either approach:

- Read only the block fields the image needs, and clamp them: a target-date range, font-size bounds, a maximum label length.
- Never fetch `expiredImageUrl` from the server. Redirect to it, or accept only your own asset host; fetching an address from the request turns the endpoint into an open proxy.
- Cache images rendered from stored blocks per parameter set, for no longer than the accuracy you need: a countdown that shows seconds and is cached for a minute can open up to 59 seconds behind, and each shorter lifetime costs more renders. Image proxies send many recipients through few IP addresses, so per-IP rate limits can't tell abuse from a large send.
- Keep image encoding fast and cache responses by URL for a short time. The image depends on request time.
- Keep editor previews out of shared caches (`Cache-Control: private, no-store`), and key the public cache so it never answers a preview request: a preview and a public request can share a URL but need different images.

## Limits

The SDK ships no GIF server. Your image service generates and serves the countdown image. Email HTML is static after sending, so the image service also handles expiry, `expiredMessage`, `expiredImageUrl` and `hideOnExpiry`; the editor cannot hide a sent block later. The canvas shows a placeholder when the image URL is empty or the image fails to load. An empty URL renders the `templatical:unrenderable-block` marker, as does a countdown block rendered headlessly without `blockRenderers.countdown`.

## Check it

Install the optional `@templatical/renderer` peer for the editor's local `toMjml()` path. After adding a countdown block, `await editor.toMjml()` contains `<mj-image src="…">` for that block. For a direct check using the editor above:

```ts
import { createCountdownBlock } from "@templatical/types";

const content = editor.getContent();
content.blocks.push(createCountdownBlock({
  targetDate: "2026-12-24T18:00",
  timezone: "Europe/Berlin",
}));
editor.setContent(content);
const mjml = await editor.toMjml();
if (!mjml.includes('<mj-image\n  src="https://play.templatical.com/countdown-sample.gif')) {
  throw new Error("Countdown image missing from MJML");
}
```

## In the playground

The [Countdown setup](https://play.templatical.com/scenes/countdown) uses the fixed sample GIF so you can inspect the provider and the canvas without an image service.
