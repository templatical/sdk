---
title: Headless API
description: Full programmatic access to templates, media, and rendering.
---

# Headless API

The Headless API gives you full programmatic access to templates, media, rendering, and all Cloud features — without the visual editor. Build custom workflows, batch operations, CI/CD pipelines, and integrations.

## Authentication

Use direct authentication for server-side access:

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

::: warning
Direct authentication should only be used in server-side code. Never expose credentials in the browser.
:::

## Templates

### Create

```js
const template = await api.createTemplate({
  blocks: [],
  settings: { width: 600, backgroundColor: '#ffffff', fontFamily: 'Arial' },
});
```

### Read

```js
const template = await api.getTemplate('template-id');
```

### Update

```js
const updated = await api.updateTemplate('template-id', {
  blocks: modifiedBlocks,
  settings: template.content.settings,
});
```

### Delete

```js
await api.deleteTemplate('template-id');
```

## Export

```js
const { html, mjml } = await api.exportTemplate('template-id');
```

With custom fonts:

```js
const { html } = await api.exportTemplate('template-id', {
  customFonts: [{ name: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter' }],
  defaultFallback: 'Arial, sans-serif',
});
```

## Snapshots

```js
// List snapshots
const snapshots = await api.getSnapshots('template-id');

// Create a snapshot
await api.createSnapshot('template-id', content);

// Restore a snapshot
const restored = await api.restoreSnapshot('template-id', 'snapshot-id');
```

## Comments

```js
// List comments
const comments = await api.getComments('template-id');

// Add a comment
const comment = await api.createComment('template-id', {
  body: 'This section needs a stronger CTA',
  block_id: 'block-uuid',
  user_id: 'user-123',
  user_name: 'Jane Smith',
  user_signature: 'hmac-signature',
});

// Resolve a comment
await api.resolveComment('template-id', 'comment-id', {
  user_id: 'user-123',
  user_name: 'Jane Smith',
  user_signature: 'hmac-signature',
});
```

## Saved Modules

```js
// List modules
const modules = await api.listModules();

// Create a module
const module = await api.createModule({
  name: 'Product Card',
  content: sectionContent,
});

// Delete a module
await api.deleteModule('module-id');
```

## Test Emails

```js
await api.sendTestEmail('template-id', {
  recipient: 'test@example.com',
  html: '<html>...</html>',
  allowed_emails: ['test@example.com'],
  signature: 'hmac-signature',
});
```

## Plan Configuration

```js
const config = await api.fetchConfig();
console.log(config.features); // Available features for this plan
```

## API Routes Reference

All routes are scoped to a project and tenant:

| Route | Method | Description |
|-------|--------|-------------|
| `config` | GET | Get plan configuration |
| `broadcasting/auth` | POST | Authenticate WebSocket connection |
| `templates` | POST | Create template |
| `templates/import/from-beefree` | POST | Import BeeFree template |
| `templates/{id}` | GET | Get template |
| `templates/{id}` | PUT | Update template |
| `templates/{id}` | DELETE | Delete template |
| `templates/{id}/export` | POST | Export to HTML/MJML |
| `templates/{id}/send-test-email` | POST | Send test email |
| `templates/{id}/snapshots` | GET | List snapshots |
| `templates/{id}/snapshots` | POST | Create snapshot |
| `templates/{id}/snapshots/{id}/restore` | POST | Restore snapshot |
| `templates/{id}/comments` | GET | List comments |
| `templates/{id}/comments` | POST | Create comment |
| `templates/{id}/comments/{id}` | PUT | Update comment |
| `templates/{id}/comments/{id}` | DELETE | Delete comment |
| `templates/{id}/comments/{id}/resolve` | POST | Resolve comment |
| `templates/{id}/ai/generate` | POST | AI content generation |
| `templates/{id}/ai/conversation-messages` | GET | AI conversation history |
| `templates/{id}/ai/suggestions` | POST | AI prompt suggestions |
| `templates/{id}/ai/rewrite-text` | POST | AI text rewrite |
| `templates/{id}/ai/score` | POST | Template quality scoring |
| `templates/{id}/ai/fix-finding` | POST | AI fix scoring finding |
| `templates/{id}/ai/generate-from-design` | POST | Design-to-template conversion |
| `saved-modules` | GET | List modules |
| `saved-modules` | POST | Create module |
| `saved-modules/{id}` | PUT | Update module |
| `saved-modules/{id}` | DELETE | Delete module |
| `media/browse` | GET | Browse media |
| `media/upload` | POST | Upload media |
| `media/delete` | POST | Delete media |
| `media/move` | POST | Move media to folder |
| `media/check-usage` | POST | Check media usage in templates |
| `media/frequently-used` | GET | Get frequently used media |
| `media/import-from-url` | POST | Import media from URL |
| `media/{id}` | PUT | Update media metadata |
| `media/{id}/replace` | POST | Replace media file |
| `media-folders` | GET | List media folders |
| `media-folders` | POST | Create media folder |
| `media-folders/{id}` | PUT | Rename media folder |
| `media-folders/{id}` | DELETE | Delete media folder |
