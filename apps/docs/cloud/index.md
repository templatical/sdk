---
title: Templatical Cloud
description: Premium hosted features for teams building email tooling at scale.
---

# Templatical Cloud

The self-hosted editor gives you everything you need to build and render email templates. **Templatical Cloud** adds the features teams need when shipping email tooling at scale — AI content generation, real-time collaboration, media management, template scoring, and more.

## How It Works

Cloud features are activated by switching from `init()` to `initCloud()` when initializing the editor. The same visual editor you already know gets additional capabilities powered by the Templatical Cloud backend.

```js
import { initCloud } from '@templatical/editor';

const editor = await initCloud({
  container: '#editor',
  auth: {
    url: '/api/templatical/token',
  },
});
```

All Cloud features communicate through authenticated API endpoints and WebSocket connections managed automatically by the SDK.

## Features

| Feature | Description |
|---------|-------------|
| [AI Assistant](/cloud/ai) | Generate email content from prompts, rewrite text, design-to-template conversion |
| [Collaboration](/cloud/collaboration) | Real-time co-editing with live cursors and block locking |
| [Comments](/cloud/comments) | Inline review threads on specific blocks |
| [Media Library](/cloud/media-library) | Upload, organize, and manage images with folders and search |
| [Template Scoring](/cloud/template-scoring) | Automated quality checks for deliverability and accessibility |
| [Rendering](/cloud/rendering) | `toMjml()` and `toHtml()` server-side, with a countdown GIF and video play button a browser cannot produce |
| [Saved Blocks](/cloud/saved-blocks) | Reusable block groups — one library per project, shared across your team with no backend to implement |
| [Templates](/cloud/templates) | Saving, loading, autosave and the unsaved-changes guard, with no storage to run |
| [Test Emails](/cloud/test-emails) | Send test emails directly from the editor |
| [Version History](/cloud/version-history) | Browse, preview and restore past versions — an open contract Cloud implements |
| [MCP Integration](/cloud/mcp) | Connect AI agents to build and modify templates programmatically |
| [Multi-Tenant](/cloud/multi-tenant) | Project and tenant isolation with API keys |
| [Headless API](/cloud/headless-api) | Full programmatic access to templates, media, and rendering |

## Bringing your own

Cloud is a first-party implementation of the same [provider contracts](/backend/) the open-source editor exposes — one editor component, one core, one header behind both entry points. Saved blocks and test emails can still be yours while Cloud handles the rest:

```ts
await initCloud({ container, auth, savedBlocks: mine, testEmail: mine });
```

They mix safely because Cloud never independently uses either. The rest are refused outright, except `templates`, `comments` and `versionHistory`, which Cloud accepts for their configuration and events; a refused value passed from JavaScript is ignored with a console warning:

<!-- prettier-ignore -->
| Key | What `initCloud()` does with it |
| --- | --- |
| `templates` | **Storage stays Cloud's; configuration and events are yours.** The id anchors collaboration, comments, AI rewrite, scoring and the server-side export, so `initCloud()` keeps `load`/`create`/`save`. The key still reaches the editor for [its configuration and events](/cloud/templates#bringing-your-own) — `autoSave`, `unsavedChangesGuard`, `nameField`, `onSaved`, `onCreated`, `onLoaded` — with any storage methods named and ignored. |
| `comments` | **Storage stays Cloud's; configuration and events are yours.** A comment is keyed to a template id Cloud issued and its author is signed by the auth token, so `initCloud()` keeps its own `list`/`create`/`update`/`delete`/`setResolved`/`subscribe`. The key still reaches the editor for [its events](/cloud/comments#bringing-your-own) — `onCreated`, `onUpdated`, `onDeleted`, `onResolved`, `onUnresolved` — with any storage methods named and ignored. |
| `versionHistory` | **Storage stays Cloud's; events are yours.** A version is keyed to a template id Cloud issued, and Cloud's own `templates` adapter records automatic versions as part of every save, so `initCloud()` keeps its own `list`/`get`/`create`/`restore`. The key still reaches the editor for [its events](/cloud/version-history#events) — `onCreated`, `onRestored` — with any storage methods named and ignored. There's no boolean or full-provider form here, unlike `savedBlocks`: the type is `VersionHistoryOptions` alone. |
| `render` | **Cloud renders independently for delivery** — test email, scheduled sends and exports. A provider would change what you preview and export, never what Cloud sends. |

There's no `user` key either — `initCloud()` fills it from the auth token's own claim, so a consumer-supplied identity could only disagree with the one the backend verifies.

To own the whole set, use [`init()`](/backend/).

## Pricing

Plans start at $99/month. All plans include the full editor, AI features, and collaboration.

[Start Free Trial](https://templatical.com) &nbsp;·&nbsp; [View Pricing](https://templatical.com/pricing) &nbsp;·&nbsp; [Contact Sales](mailto:sales@templatical.com)
