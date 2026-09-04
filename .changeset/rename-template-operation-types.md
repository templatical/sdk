---
"@templatical/types": minor
---

Rename `McpOperation` → `TemplateOperation` and `McpOperationPayload` →
`TemplateOperationPayload`. The seven-operation vocabulary is shared by the
`@templatical/template-tools` CLI's `edit` command, Cloud's MCP bridge and the
collaboration broadcast, so naming it after one transport was misleading.

`McpConfig` and the editor's `mcp` config key are unchanged — those really are
about MCP — and the Pusher event names (`mcp-operation`, `client-operation`) are
untouched, so the wire protocol is unaffected.
