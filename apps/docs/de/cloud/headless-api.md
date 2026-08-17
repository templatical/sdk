---
title: Headless-API
description: Vollständiger programmatischer Zugriff auf Templates, Medien und Rendering.
---

# Headless-API

Die Headless-API bietet Ihnen vollständigen programmatischen Zugriff auf Templates, Medien, Rendering und alle Cloud-Funktionen – ohne den visuellen Editor. Bauen Sie benutzerdefinierte Workflows, Stapelverarbeitungen, CI/CD-Pipelines und Integrationen.

## Authentifizierung

Verwenden Sie für serverseitigen Zugriff die direkte Authentifizierung:

```js
import { createSdkAuthManager, ApiClient } from '@templatical/core/cloud';

const auth = createSdkAuthManager({
  mode: 'direct',
  clientId: process.env.TEMPLATICAL_CLIENT_ID,
  clientSecret: process.env.TEMPLATICAL_CLIENT_SECRET,
  tenant: 'tenant-slug',
});

await auth.initialize();
const api = new ApiClient(auth);
```

::: warning Wichtig
Direkte Authentifizierung darf ausschließlich in serverseitigem Code verwendet werden. Geben Sie Zugangsdaten niemals im Browser preis.
:::

## Templates

### Erstellen

```js
const template = await api.createTemplate({
  blocks: [],
  settings: { width: 600, backgroundColor: '#ffffff', fontFamily: 'Arial' },
});
```

### Lesen

```js
const template = await api.getTemplate('template-id');
```

### Aktualisieren

```js
const updated = await api.updateTemplate('template-id', {
  blocks: modifiedBlocks,
  settings: template.content.settings,
});
```

### Löschen

```js
await api.deleteTemplate('template-id');
```

## Export

```js
const { html, mjml } = await api.exportTemplate('template-id');
```

Mit benutzerdefinierten Schriftarten:

```js
const { html } = await api.exportTemplate('template-id', {
  customFonts: [{ name: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter' }],
  defaultFallback: 'Arial, sans-serif',
});
```

## Versionen

```js
// Versionen auflisten (jede enthält ihren Inhalt)
const versions = await api.getVersions('template-id');

// Inhalt einer einzelnen Version holen
const version = await api.getVersion('template-id', 'version-id');

// Version aufzeichnen
await api.createVersion('template-id', content);

// Version wiederherstellen — nur anfügend, fügt also einen Eintrag hinzu
const restored = await api.restoreVersion('template-id', 'version-id');
```

## Kommentare

```js
// Kommentare auflisten
const comments = await api.getComments('template-id');

// Kommentar hinzufügen
const comment = await api.createComment('template-id', {
  body: 'This section needs a stronger CTA',
  block_id: 'block-uuid',
  user_id: 'user-123',
  user_name: 'Jane Smith',
  user_signature: 'hmac-signature',
});

// Kommentar auflösen
await api.resolveComment('template-id', 'comment-id', {
  user_id: 'user-123',
  user_name: 'Jane Smith',
  user_signature: 'hmac-signature',
});
```

## Gespeicherte Blöcke

```js
// Gespeicherte Blöcke auflisten
const savedBlocks = await api.listModules();

// Gespeicherten Block erstellen
const savedBlock = await api.createModule({
  name: 'Product Card',
  content: sectionContent,
});

// Gespeicherten Block löschen
await api.deleteModule('saved-block-id');
```

::: tip
Die REST-Routen und die Methodennamen von `ApiClient` behalten aus
Kompatibilitätsgründen ihre ursprüngliche `module`-Benennung — geändert hat
sich nur der Name der Funktion. Zur editorseitigen Funktion und zur
Speicher-Provider-Schnittstelle siehe
[Gespeicherte Blöcke](/de/backend/saved-blocks).
:::

## Test-E-Mails

```js
await api.sendTestEmail('template-id', {
  recipient: 'test@example.com',
  html: '<html>...</html>',
  allowed_emails: ['test@example.com'],
  signature: 'hmac-signature',
});
```

## Plan-Konfiguration

```js
const config = await api.fetchConfig();
console.log(config.features); // Verfügbare Funktionen für diesen Plan
```

## Referenz der API-Routen

Alle Routen sind auf ein Projekt und einen Mandanten bezogen:

| Route | Methode | Beschreibung |
|-------|--------|-------------|
| `config` | GET | Plan-Konfiguration abrufen |
| `broadcasting/auth` | POST | WebSocket-Verbindung authentifizieren |
| `templates` | POST | Template erstellen |
| `templates/import/from-beefree` | POST | BeeFree-Template importieren |
| `templates/import/from-unlayer` | POST | Unlayer-Template importieren |
| `templates/{id}` | GET | Template abrufen |
| `templates/{id}` | PUT | Template aktualisieren |
| `templates/{id}` | DELETE | Template löschen |
| `templates/{id}/export` | POST | Nach HTML/MJML exportieren |
| `templates/{id}/send-test-email` | POST | Test-E-Mail senden |
| `templates/{id}/versions` | GET | Versionen auflisten |
| `templates/{id}/versions` | POST | Version aufzeichnen |
| `templates/{id}/versions/{id}` | GET | Eine Version holen |
| `templates/{id}/versions/{id}/restore` | POST | Version wiederherstellen |
| `templates/{id}/comments` | GET | Kommentare auflisten |
| `templates/{id}/comments` | POST | Kommentar erstellen |
| `templates/{id}/comments/{id}` | PUT | Kommentar aktualisieren |
| `templates/{id}/comments/{id}` | DELETE | Kommentar löschen |
| `templates/{id}/comments/{id}/resolve` | POST | Kommentar auflösen |
| `templates/{id}/ai/generate` | POST | KI-Inhaltsgenerierung |
| `templates/{id}/ai/conversation-messages` | GET | KI-Gesprächsverlauf |
| `templates/{id}/ai/suggestions` | POST | KI-Prompt-Vorschläge |
| `templates/{id}/ai/rewrite-text` | POST | KI-Text-Umschreibung |
| `templates/{id}/ai/score` | POST | Template-Qualitätsbewertung |
| `templates/{id}/ai/fix-finding` | POST | KI-Behebung eines Bewertungs-Findings |
| `templates/{id}/ai/generate-from-design` | POST | Umwandlung von Design zu Template |
| `saved-modules` | GET | Gespeicherte Blöcke auflisten |
| `saved-modules` | POST | Gespeicherten Block erstellen |
| `saved-modules/{id}` | PUT | Gespeicherten Block aktualisieren |
| `saved-modules/{id}` | DELETE | Gespeicherten Block löschen |
| `media/browse` | GET | Medien durchsuchen |
| `media/upload` | POST | Medien hochladen |
| `media/delete` | POST | Medien löschen |
| `media/move` | POST | Medien in einen Ordner verschieben |
| `media/check-usage` | POST | Medien-Nutzung in Templates prüfen |
| `media/frequently-used` | GET | Häufig verwendete Medien abrufen |
| `media/import-from-url` | POST | Medien von URL importieren |
| `media/{id}` | PUT | Medien-Metadaten aktualisieren |
| `media/{id}/replace` | POST | Mediendatei ersetzen |
| `media-folders` | GET | Medienordner auflisten |
| `media-folders` | POST | Medienordner erstellen |
| `media-folders/{id}` | PUT | Medienordner umbenennen |
| `media-folders/{id}` | DELETE | Medienordner löschen |
