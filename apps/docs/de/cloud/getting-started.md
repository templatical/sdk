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

::: info Shadow DOM
`initCloud()` erbt das gesamte Shadow-DOM-Verhalten vom Editor — standardmäßig innerhalb eines Shadow DOM gemountet für Host-CSS-Isolation. Der Medien-Browser, KI-Panels, Kommentare und die Versionsverlauf-UI teleportieren alle in den Shadow-bewussten Popover-Root des Editors, sodass keine besondere Behandlung erforderlich ist. Übergeben Sie `shadowDom: false`, um zu deaktivieren. Siehe den [Shadow-DOM-Leitfaden](/de/guide/shadow-dom).
:::

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

::: info `initCloud()` ist `init()` mit Clouds Adaptern
Es authentifiziert, lädt Ihren Plan, baut Clouds Provider für `templates` / `render` / `versionHistory` / `savedBlocks` / `testEmail` und ruft damit `init()` auf. Hinter beiden Einstiegspunkten stehen dieselbe Editor-Komponente, derselbe Editor-Kern und derselbe Header, und beide liefern denselben Typ zurück — das macht „Cloud implementiert dieselben Schnittstellen, die auch Sie implementieren würden“ überprüfbar statt nur behauptet.

Eine Folge davon: Der Bootstrap läuft *vor* dem Mounten des Editors. Ein fehlgeschlagener Handshake führt daher zu einem **Reject** von `initCloud()`, statt einen Editor mit Fehler-Overlay zu mounten. Behandeln Sie das wie jedes andere abgelehnte Promise. Bricht die Sitzung später ab — etwa wenn ein Token nicht mehr erneuert werden kann —, erscheint weiterhin ein Overlay, denn dann gibt es einen Editor, der überdeckt werden kann.
:::

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
  savedBlocks: true,           // Cloud-gestützt (Standard); false deaktiviert,
                               // oder ein SavedBlocksProvider für Ihren eigenen Speicher

  // Callbacks
  onChange: (content) => { /* Template geändert */ },
  onError: (error) => { /* Fehler behandeln */ },
  onComment: (event) => { /* Kommentar erstellt/aktualisiert/gelöscht */ },
  onCreate: (template) => { /* create() aufgelöst — template.id ist neu */ },
  onLoad: (template) => { /* load() aufgelöst */ },
});
```

## Mit Templates arbeiten

### Neues Template anlegen

```js
const template = await editor.create();
// template.id ist nun zum Speichern, Teilen etc. verfügbar

// Optional vorbelegen:
await editor.create({ name: 'Frühjahrskampagne', content });
```

`create()` nimmt dieselbe Eingabe `{ name?, content? }` entgegen wie in `init()`.

### Bestehendes Template laden

```js
const template = await editor.load('template-id-here');
```

### Änderungen speichern

```js
const template = await editor.save();
```

`save()` liefert das gespeicherte `Template`. Rendering ist ein eigener Provider, also separat aufrufbar, und ein Speichervorgang bezahlt nicht bei jedem Autosave-Tick einen serverseitigen Render mit.

### Export

```js
const mjml = await editor.toMjml();
const html = await editor.toHtml();
```

Beide rendern über Templatical Cloud, dessen Ausgabe eine bewusste Obermenge der des Browsers ist: Ein Countdown-Block wird zu einem serverseitig erzeugten animierten GIF, ein Video-Block erhält einen zusammengesetzten Play-Button — beides kann ein Browser zur Renderzeit nicht leisten. Cloud führt den *veröffentlichten* `@templatical/renderer` mit genau diesen zwei eingespeisten Funktionen aus, sodass nichts anderes abweichen kann.

Cloud rendert das **gespeicherte** Template, jeder Aufruf speichert also zuerst — und eine Sitzung, die nie ein Template erzeugt hat, erhält eine klare Ablehnung statt eines Exports von nichts.

Übergeben Sie Ihren eigenen [`render`-Provider](/de/backend/render), um woanders zu rendern; Schlüssel und Typ sind identisch mit denen von `init()`, es ist also in jede Richtung eine einzeilige Änderung.

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
