---
title: Getting Started with Cloud
description: Set up Templatical Cloud in your application.
---

# Getting Started

This guide walks you through setting up Templatical Cloud in your application.

## Prerequisites

- A Templatical Cloud account with an active plan
- A project and tenant configured in the [Cloud dashboard](https://templatical.com)
- The `@templatical/editor` package installed in your project

## Installation

If you haven't already installed the editor, add it along with the cloud dependencies:

```bash
npm install @templatical/editor @templatical/media-library pusher-js
```

`@templatical/media-library` provides the built-in media browser and `pusher-js` enables real-time collaboration. Both are optional peer dependencies — only needed when using `initCloud()`.

::: info Shadow DOM
`initCloud()` inherits all shadow-DOM behavior from the editor — mounted inside a Shadow DOM by default for host-CSS isolation. The media browser, AI panels, comments, and version-history UI all teleport into the editor's shadow-aware popover root, so no special handling is needed. Pass `shadowDom: false` to opt out. See the [Shadow DOM guide](/guide/shadow-dom).
:::

## Authentication Endpoint

Cloud features require an authentication endpoint on your server that issues access tokens. The SDK calls this endpoint automatically to obtain and refresh tokens.

### Laravel Example

```php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

Route::post('/api/templatical/token', function (Request $request) {
    $response = Http::post('https://templatical.com/api/v1/auth/token', [
        'client_id' => config('templatical.client_id'),
        'client_secret' => config('templatical.client_secret'),
        'tenant' => $request->user()->tenant_id,
    ]);

    return $response->json();
});
```

### Node.js Example

```js
app.post('/api/templatical/token', async (req, res) => {
  const response = await fetch('https://templatical.com/api/v1/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.TEMPLATICAL_CLIENT_ID,
      client_secret: process.env.TEMPLATICAL_CLIENT_SECRET,
      tenant: req.user.tenantId,
    }),
  });

  res.json(await response.json());
});
```

## Initialize the Cloud Editor

Replace `init()` with `initCloud()` and provide your auth endpoint:

```js
import { initCloud } from '@templatical/editor';

const editor = await initCloud({
  container: '#editor',
  auth: {
    url: '/api/templatical/token',
    requestOptions: {
      method: 'POST',
      credentials: 'same-origin',
    },
  },
});
```

The `auth.url` should point to the token endpoint you created above. The SDK handles token refresh automatically.

::: info `initCloud()` is `init()` with Cloud's adapters
It authenticates, fetches your plan, builds Cloud's `templates` / `render` / `versionHistory` / `savedBlocks` / `testEmail` providers, and then calls `init()` with them. There is one editor component, one editor core and one header behind both entry points, and the two return the **same** type — which is what makes "Cloud implements the same interfaces you would" checkable rather than just claimed.

One consequence: the bootstrap runs *before* the editor mounts, so a failed handshake **rejects** `initCloud()` instead of mounting an editor showing an error overlay. Handle it like any other rejected promise. A session that dies later — a token refresh that cannot renew — still surfaces as an overlay, because by then there is an editor to cover.
:::

## Configuration Options

`initCloud()` accepts all the same options as `init()` (theme, locale, merge tags, custom blocks, etc.) plus Cloud-specific options:

```js
const editor = await initCloud({
  container: '#editor',
  auth: {
    url: '/api/templatical/token',
  },

  // Cloud features (all optional)
  ai: {},                       // Enable all AI features
  collaboration: {             // Enable real-time collaboration
    enabled: true,
  },
  commenting: true,            // Enable inline comments
  savedBlocks: true,           // Cloud-backed (default); false to disable,
                               // or pass a SavedBlocksProvider to use your own store

  // Callbacks
  onChange: (content) => { /* template changed */ },
  onError: (error) => { /* handle errors */ },
  onComment: (event) => { /* comment created/updated/deleted */ },
  onCreate: (template) => { /* create() resolved — template.id is new */ },
  onLoad: (template) => { /* load() resolved */ },
  onUnmount: () => { /* the editor has been torn down */ },
});
```

Each Cloud-backed capability has its own page: [Templates](/cloud/templates), [Rendering](/cloud/rendering), [Saved Blocks](/cloud/saved-blocks), [Comments](/cloud/comments), [Version History](/cloud/version-history) and [Test Emails](/cloud/test-emails).

## Working with Templates

### Create a New Template

```js
const template = await editor.create();
// template.id is now available for saving, sharing, etc.

// Optionally seed it:
await editor.create({ name: 'Spring campaign', content });
```

`create()` takes the same `{ name?, content? }` input `init()` does.

### Load an Existing Template

```js
const template = await editor.load('template-id-here');
```

### Save Changes

```js
const template = await editor.save();
```

`save()` resolves to the stored `Template`. Rendering is its own provider, so it is separately callable and a save does not pay for a server render on every autosave tick.

Autosave, the unsaved-changes guard and the automatic version every save records are covered in [Templates](/cloud/templates).

### Export

```js
const mjml = await editor.toMjml();
const html = await editor.toHtml();
```

Both render server-side, from the **saved** template — so each call saves first, and a session that has never created a template gets a clear rejection rather than an export of nothing. `initCloud()` does not take a `render` provider: see [Rendering](/cloud/rendering) for what Cloud's output adds over the browser's, and why the key is refused.

## Cleanup

When the user navigates away, unmount the editor to clean up WebSocket connections and event listeners:

```js
editor.unmount();
```

## Health Check

Verify your Cloud connection is working:

```js
import { performHealthCheck } from '@templatical/core/cloud';

const result = await performHealthCheck({
  baseUrl: 'https://templatical.com',
});

console.log(result.overall);    // true if all services are reachable
console.log(result.api);        // { ok: true, latency: 42 }
console.log(result.websocket);  // { ok: true }
console.log(result.auth);       // { ok: true }
```

## Next Steps

- [Authentication](/cloud/authentication) — Advanced auth configuration
- [AI Assistant](/cloud/ai) — Generate and rewrite content with AI
- [Collaboration](/cloud/collaboration) — Set up real-time co-editing
