---
title: Authentication
description: Configure authentication for Templatical Cloud.
---

# Authentication

Templatical Cloud uses JWT-based authentication. The SDK manages tokens automatically — you provide a server-side endpoint that issues tokens, and the `AuthManager` handles refresh, retries, and authenticated requests.

## Auth Flow

1. Your frontend calls `initCloud()` with an `auth.url`
2. The SDK requests a token from your server endpoint
3. Your server authenticates the user and calls the Templatical Cloud API to get a JWT
4. The SDK uses the JWT for all subsequent API and WebSocket requests
5. When the token expires, the SDK refreshes it automatically

## Configuration

### Basic Setup

```js
const editor = await initCloud({
  container: '#editor',
  auth: {
    url: '/api/templatical/token',
  },
});
```

### Full Options

```js
const editor = await initCloud({
  container: '#editor',
  auth: {
    url: '/api/templatical/token',
    baseUrl: 'https://cloud.templatical.com', // Default
    requestOptions: {
      method: 'POST',                         // Default: GET
      headers: {
        'X-Custom-Header': 'value',
      },
      body: {
        tenant_id: 'tenant-123',
      },
      credentials: 'same-origin',
    },
  },
});
```

### Auth Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | — | **Required.** Your token endpoint URL |
| `baseUrl` | `string` | `https://cloud.templatical.com` | Templatical Cloud API base URL |
| `requestOptions.method` | `'GET' \| 'POST'` | `'GET'` | HTTP method for token requests |
| `requestOptions.headers` | `Record<string, string>` | `{}` | Additional headers sent with token requests |
| `requestOptions.body` | `Record<string, unknown>` | `{}` | Body payload for POST token requests |
| `requestOptions.credentials` | `RequestCredentials` | — | Fetch credentials mode (`same-origin`, `include`) |

## Token Response Format

Your token endpoint must return a JSON response with this structure:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "project_id": "proj_abc123",
  "tenant_id": "ten_xyz789",
  "tenant_slug": "acme-corp",
  "expires_in": 3600,
  "test_email": {
    "allowed_emails": ["team@example.com"]
  },
  "user": {
    "id": "user_123",
    "name": "Jane Smith",
    "avatar": "https://example.com/avatar.jpg"
  },
  "websocket": {
    "host": "ws.templatical.com",
    "port": 443,
    "app_key": "app-key-here"
  }
}
```

The `user` object is used for collaboration (showing who is editing) and comments (attributing authorship). The `websocket` config enables real-time features.

## Direct Authentication

For server-side or testing scenarios, you can authenticate directly with API credentials instead of going through a token endpoint:

```js
import { createSdkAuthManager } from '@templatical/core/cloud';

const auth = createSdkAuthManager({
  mode: 'direct',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  tenant: 'tenant-slug',
});
```

::: warning
Never expose `clientSecret` in client-side code. Direct authentication is intended for server-side usage, scripts, and testing only.
:::

## Error Handling

Authentication errors are surfaced through the `onError` callback:

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  onError: (error) => {
    if (error.message.includes('401') || error.message.includes('auth')) {
      // Redirect to login or show re-auth prompt
      window.location.href = '/login';
    }
  },
});
```

## Security Best Practices

- **Never expose API credentials in client-side code.** Always proxy through your server.
- **Validate the user session** in your token endpoint before issuing a Templatical token.
- **Scope tokens to tenants.** Each token should be associated with a specific tenant to enforce data isolation.
- **Use `credentials: 'same-origin'`** to ensure cookies are sent with token requests when your auth relies on session cookies.
