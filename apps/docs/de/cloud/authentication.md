---
title: Authentifizierung
description: Konfigurieren Sie die Authentifizierung für Templatical Cloud.
---

# Authentifizierung

Templatical Cloud verwendet JWT-basierte Authentifizierung. Das SDK verwaltet Tokens automatisch – Sie stellen einen serverseitigen Endpunkt bereit, der Tokens ausgibt, und der `AuthManager` übernimmt Refresh, Retries und authentifizierte Requests.

## Auth-Flow

1. Ihr Frontend ruft `initCloud()` mit einer `auth.url` auf
2. Das SDK fordert ein Token von Ihrem Server-Endpunkt an
3. Ihr Server authentifiziert den Nutzer und ruft die Templatical-Cloud-API auf, um ein JWT zu erhalten
4. Das SDK verwendet das JWT für alle nachfolgenden API- und WebSocket-Requests
5. Wenn das Token abläuft, erneuert das SDK es automatisch

## Konfiguration

### Basis-Setup

```js
const editor = await initCloud({
  container: '#editor',
  auth: {
    url: '/api/templatical/token',
  },
});
```

### Vollständige Optionen

```js
const editor = await initCloud({
  container: '#editor',
  auth: {
    url: '/api/templatical/token',
    baseUrl: 'https://templatical.com',        // Standard
    requestOptions: {
      method: 'POST',                         // Standard: POST
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

### Referenz der Auth-Optionen

| Option | Typ | Standard | Beschreibung |
|--------|------|---------|-------------|
| `url` | `string` | — | **Erforderlich.** URL Ihres Token-Endpunkts |
| `baseUrl` | `string` | `https://templatical.com` | Basis-URL der Templatical-Cloud-API |
| `requestOptions.method` | `'GET' \| 'POST'` | `'POST'` | HTTP-Methode für Token-Anfragen |
| `requestOptions.headers` | `Record<string, string>` | `{}` | Zusätzliche Header, die mit Token-Anfragen gesendet werden |
| `requestOptions.body` | `Record<string, unknown>` | `{}` | Body-Nutzlast für POST-Token-Anfragen |
| `requestOptions.credentials` | `RequestCredentials` | `'include'` | Fetch-Credentials-Modus (`same-origin`, `include`) |

## Format der Token-Antwort

Ihr Token-Endpunkt muss eine JSON-Antwort mit dieser Struktur zurückgeben:

```json
{
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "expires_at": 1720000000,
  "project_id": "proj_abc123",
  "tenant": "acme-corp",
  "test_email": {
    "allowed_emails": ["team@example.com"],
    "signature": "hmac-signature-here"
  },
  "user": {
    "id": "user_123",
    "name": "Jane Smith",
    "signature": "hmac-signature-here"
  }
}
```

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `token` | `string` | **Erforderlich.** Das JWT-Zugriffstoken |
| `expires_at` | `number` | **Erforderlich.** Unix-Zeitstempel, zu dem das Token abläuft |
| `project_id` | `string` | **Erforderlich.** Die Projekt-ID |
| `tenant` | `string` | **Erforderlich.** Der Tenant-Slug |
| `user` | `object` | Optional. Wird für Präsenz bei Zusammenarbeit und die Zuordnung von Kommentaren verwendet |
| `user.id` | `string` | Benutzer-Identifier |
| `user.name` | `string` | Anzeigename in der Kollaborations-UI |
| `user.signature` | `string` | HMAC-Signatur zur Benutzerverifikation |
| `test_email` | `object` | Optional. Konfiguration für die Test-E-Mail-Funktion |
| `test_email.allowed_emails` | `string[]` | E-Mail-Adressen, die Test-E-Mails empfangen dürfen |
| `test_email.signature` | `string` | HMAC-Signatur zur Verifikation von Test-E-Mails |

## Direkte Authentifizierung

Für serverseitige oder Test-Szenarien können Sie sich direkt mit API-Zugangsdaten authentifizieren, statt einen Token-Endpunkt zu verwenden:

```js
import { createSdkAuthManager } from '@templatical/core/cloud';

const auth = createSdkAuthManager(
  {
    mode: 'direct',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    tenant: 'tenant-slug',
  },
  (error) => console.error('Auth error:', error), // optionaler onError-Callback
);
```

::: warning Wichtig
Geben Sie `clientSecret` niemals in clientseitigem Code preis. Direkte Authentifizierung ist ausschließlich für serverseitige Nutzung, Skripte und Tests vorgesehen.
:::

## Fehlerbehandlung

Authentifizierungsfehler werden über den `onError`-Callback gemeldet:

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  onError: (error) => {
    if (error.message.includes('401') || error.message.includes('auth')) {
      // Zur Anmeldung weiterleiten oder Re-Auth-Aufforderung anzeigen
      window.location.href = '/login';
    }
  },
});
```

## Best Practices für Sicherheit

- **Geben Sie API-Zugangsdaten niemals in clientseitigem Code preis.** Leiten Sie sie stets über Ihren Server weiter.
- **Validieren Sie die Nutzersitzung** in Ihrem Token-Endpunkt, bevor Sie ein Templatical-Token ausstellen.
- **Grenzen Sie Tokens auf Mandanten ein.** Jedes Token sollte einem konkreten Mandanten zugeordnet sein, um die Datenisolation durchzusetzen.
- **Verwenden Sie `credentials: 'same-origin'`**, damit Cookies mit Token-Anfragen gesendet werden, wenn Ihre Authentifizierung auf Session-Cookies basiert.
