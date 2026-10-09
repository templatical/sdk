---
"@templatical/template-tools": minor
---

Add `templatical custom-block validate|render|fetch` and `live --custom-block [--host]` for authoring custom block definitions. `validate` checks the definition against a generated `custom-block-schema.json`, cross-checks the Liquid template against its fields, lints the rendered HTML for email-client safety, and proves it renders through MJML. The live preview shows the block in its edge-case states and can fill it from a real endpoint through a preview-only `dataSourcePreview` recipe; the bridge makes that request from Node, reading credentials from environment variables, so they never reach the page.

The live bridge now answers only requests whose `Host` header is `localhost`, `127.0.0.1` or `[::1]` on its own port, in both modes, so a tunnel or proxy that rewrites the hostname gets a 403.
