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
  settings: { width: 600 },
  sections: [],
});
```

### Read

```js
const template = await api.getTemplate('template-id');
```

### Update

```js
const updated = await api.updateTemplate('template-id', {
  settings: template.content.settings,
  sections: modifiedSections,
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
  fonts: { 'Inter': 'https://fonts.googleapis.com/css2?family=Inter' },
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
});

// Resolve a comment
await api.resolveComment('template-id', 'comment-id');
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
| `templates` | POST | Create template |
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
| `saved-modules` | GET | List modules |
| `saved-modules` | POST | Create module |
| `saved-modules/{id}` | PUT | Update module |
| `saved-modules/{id}` | DELETE | Delete module |
| `media/browse` | GET | Browse media |
| `media/upload` | POST | Upload media |
| `media/delete` | POST | Delete media |
| `media/{id}` | PUT | Update media metadata |
