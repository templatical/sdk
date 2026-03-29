---
title: Templatical Cloud
description: Premium hosted features for teams building email tooling at scale.
---

# Templatical Cloud

The open-source editor gives you everything you need to build and render email templates. **Templatical Cloud** adds the features teams need when shipping email tooling at scale — AI content generation, real-time collaboration, media management, template scoring, and more.

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
| [Saved Modules](/cloud/saved-modules) | Reusable template sections shared across your team |
| [Test Emails](/cloud/test-emails) | Send test emails directly from the editor |
| [Snapshots](/cloud/snapshots) | Version history with side-by-side comparison and restore |
| [MCP Integration](/cloud/mcp) | Connect AI agents to build and modify templates programmatically |
| [Multi-Tenant](/cloud/multi-tenant) | Project and tenant isolation with API keys |
| [Headless API](/cloud/headless-api) | Full programmatic access to templates, media, and rendering |

## Pricing

Plans start at $99/month. All plans include the full editor, AI features, and collaboration.

[Start Free Trial](https://templatical.com) &nbsp;·&nbsp; [View Pricing](https://templatical.com/pricing) &nbsp;·&nbsp; [Contact Sales](mailto:sales@templatical.com)
