---
title: Erste Schritte mit Cloud
description: Richten Sie Templatical Cloud in Ihrer Anwendung ein.
---

# Erste Schritte

Dieser Leitfaden führt Sie durch die Einrichtung von Templatical Cloud in Ihrer Anwendung.

## Voraussetzungen

- Ein Templatical-Cloud-Konto mit einem aktiven Plan
- Ein Projekt und ein Mandant, die im [Cloud-Dashboard](https://templatical.com) konfiguriert sind
- Das Paket `@templatical/editor` in Ihrem Projekt installiert

## Installation

Wenn Sie den Editor noch nicht installiert haben, fügen Sie ihn zusammen mit den Cloud-Abhängigkeiten hinzu:

```bash
npm install @templatical/editor @templatical/media-library pusher-js
```

`@templatical/media-library` stellt den integrierten Medien-Browser bereit und `pusher-js` ermöglicht die Echtzeit-Zusammenarbeit. Beide sind optionale Peer-Abhängigkeiten – nur bei Verwendung von `initCloud()` erforderlich.

## Authentifizierungs-Endpunkt

Cloud-Funktionen benötigen einen Authentifizierungs-Endpunkt auf Ihrem Server, der Zugriffstoken ausgibt. Das SDK ruft diesen Endpunkt automatisch auf, um Tokens zu erhalten und zu erneuern.

### Laravel-Beispiel

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

### Node.js-Beispiel

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

## Cloud-Editor initialisieren

Ersetzen Sie `init()` durch `initCloud()` und geben Sie Ihren Auth-Endpunkt an:

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

`auth.url` sollte auf den oben erstellten Token-Endpunkt verweisen. Das SDK übernimmt die Token-Erneuerung automatisch.

## Konfigurationsoptionen

`initCloud()` akzeptiert alle Optionen von `init()` (Theme, Locale, Merge-Tags, benutzerdefinierte Blöcke etc.) und zusätzlich Cloud-spezifische Optionen:

```js
const editor = await initCloud({
  container: '#editor',
  auth: {
    url: '/api/templatical/token',
  },

  // Cloud-Funktionen (alle optional)
  ai: {},                       // Alle KI-Funktionen aktivieren
  collaboration: {             // Echtzeit-Zusammenarbeit aktivieren
    enabled: true,
  },
  commenting: true,            // Inline-Kommentare aktivieren
  modules: true,               // Gespeicherte Module aktivieren

  // Callbacks
  onChange: (content) => { /* Template geändert */ },
  onSave: (result) => { /* SaveResult: { templateId, html, mjml, content } */ },
  onError: (error) => { /* Fehler behandeln */ },
  onComment: (event) => { /* Kommentar erstellt/aktualisiert/gelöscht */ },
});
```

## Mit Templates arbeiten

### Neues Template anlegen

```js
const template = await editor.create();
// template.id ist nun zum Speichern, Teilen etc. verfügbar
```

### Bestehendes Template laden

```js
const template = await editor.load('template-id-here');
```

### Änderungen speichern

```js
const result = await editor.save();
```

### Export

Der Cloud-Editor stellt **keine** clientseitige `toMjml()`-Methode bereit. Das Templatical-Cloud-Backend wandelt gespeicherte Template-JSON serverseitig in MJML um, mit zusätzlicher Verarbeitung, die der Browser allein nicht leisten kann (z. B. signierte Bild-URLs, Asset-Umschreibung). Lösen Sie einen Export nach dem Speichern über die Backend-HTTP-API aus – siehe die Headless-API-Dokumentation für Endpunkte.

Wenn Sie stattdessen clientseitiges MJML-Rendering wünschen (ohne Backend-Roundtrip), verwenden Sie den OSS-Editor (`init`, nicht `initCloud`) zusammen mit `@templatical/renderer`.

## Aufräumen

Wenn der Nutzer wegnavigiert, hängen Sie den Editor aus, um WebSocket-Verbindungen und Event-Listener zu bereinigen:

```js
editor.unmount();
```

## Health Check

Prüfen Sie, ob Ihre Cloud-Verbindung funktioniert:

```js
import { performHealthCheck } from '@templatical/core/cloud';

const result = await performHealthCheck({
  baseUrl: 'https://templatical.com',
});

console.log(result.overall);    // true, wenn alle Dienste erreichbar sind
console.log(result.api);        // { ok: true, latency: 42 }
console.log(result.websocket);  // { ok: true }
console.log(result.auth);       // { ok: true }
```

## Nächste Schritte

- [Authentifizierung](/de/cloud/authentication) – Erweiterte Auth-Konfiguration
- [KI-Assistent](/de/cloud/ai) – Inhalte mit KI erzeugen und umschreiben
- [Zusammenarbeit](/de/cloud/collaboration) – Echtzeit-Co-Editing einrichten
