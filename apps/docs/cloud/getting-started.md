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

If you haven't already installed the editor, add it to your project:

```bash
npm install @templatical/editor
```

## Authentication Endpoint

Cloud features require an authentication endpoint on your server that issues access tokens. The SDK calls this endpoint automatically to obtain and refresh tokens.

### Laravel Example

```php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

Route::post('/api/templatical/token', function (Request $request) {
    $response = Http::post('https://cloud.templatical.com/api/v1/auth/token', [
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
  const response = await fetch('https://cloud.templatical.com/api/v1/auth/token', {
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

## Configuration Options

`initCloud()` accepts all the same options as `init()` (theme, locale, merge tags, custom blocks, etc.) plus Cloud-specific options:

```js
const editor = await initCloud({
  container: '#editor',
  auth: {
    url: '/api/templatical/token',
  },

  // Cloud features (all optional)
  ai: true,                    // Enable AI assistant
  collaboration: {             // Enable real-time collaboration
    enabled: true,
  },
  commenting: true,            // Enable inline comments
  modules: true,               // Enable saved modules

  // Callbacks
  onChange: (content) => { /* template changed */ },
  onSave: (result) => { /* template saved */ },
  onError: (error) => { /* handle errors */ },
  onComment: (event) => { /* comment created/updated/deleted */ },
});
```

## Working with Templates

### Create a New Template

```js
const template = await editor.create();
// template.id is now available for saving, sharing, etc.
```

### Load an Existing Template

```js
const template = await editor.load('template-id-here');
```

### Save Changes

```js
const result = await editor.save();
```

### Export

```js
const mjml = editor.toMjml();
```

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
  baseUrl: 'https://cloud.templatical.com',
});

console.log(result.overall); // true if all services are reachable
console.log(result.api);     // { ok: true, latency: 42 }
console.log(result.websocket); // { ok: true }
```

## Next Steps

- [Authentication](/cloud/authentication) — Advanced auth configuration
- [AI Assistant](/cloud/ai) — Generate and rewrite content with AI
- [Collaboration](/cloud/collaboration) — Set up real-time co-editing
