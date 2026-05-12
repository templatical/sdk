---
title: MCP Integration
description: Connect AI agents to build and modify templates programmatically via Model Context Protocol.
---

# MCP Integration

The Model Context Protocol (MCP) integration allows AI agents and automation tools to interact with the editor programmatically. Agents can create, read, modify, and manage templates through a standardized protocol.

## Use Cases

- **AI Workflows** — Let AI agents generate templates based on external data or triggers
- **Automation** — Build templates programmatically as part of a larger pipeline
- **Custom Agents** — Create specialized agents that understand your brand guidelines and produce on-brand emails

## How It Works

When MCP is enabled, the editor listens for operations from connected AI agents via WebSocket. Agents can perform operations like:

- Creating and modifying templates
- Adding, updating, and removing blocks
- Reading template content and structure
- Applying design changes

## Configuration

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  mcp: {
    enabled: true,
  },
});
```

## Architecture

The MCP system consists of:

1. **`useMcpListener`** — Listens for incoming operations on the WebSocket channel
2. **`handleOperation`** — Processes individual MCP operations and applies them to the editor state

Both are available from `@templatical/core/cloud` for custom integrations.
