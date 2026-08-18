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

They mix safely because Cloud never independently uses either. The other four are refused, and one passed from JavaScript is ignored with a console warning:

<!-- prettier-ignore -->
| Key | Why `initCloud()` refuses it |
| --- | --- |
| `templates`, `versionHistory`, `comments`, `user` | **Keyed to a template id Cloud issued.** Cloud anchors versions and comments to its own ids and signs authorship against the auth token. |
| `render` | **Cloud renders independently for delivery** — test email, scheduled sends and exports. A provider would change what you preview and export, never what Cloud sends. |

To own the whole set, use [`init()`](/backend/).

## Pricing

Plans start at $99/month. All plans include the full editor, AI features, and collaboration.

[Start Free Trial](https://templatical.com) &nbsp;·&nbsp; [View Pricing](https://templatical.com/pricing) &nbsp;·&nbsp; [Contact Sales](mailto:sales@templatical.com)
