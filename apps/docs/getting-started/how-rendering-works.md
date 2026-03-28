---
title: How Rendering Works
description: Understand the JSON → MJML rendering pipeline in Templatical.
---

# How Rendering Works

Templatical separates template editing from template rendering. The editor produces JSON; the renderer turns that JSON into MJML. You then compile the MJML to HTML using any MJML library and send it via your email service.

## The pipeline

<svg viewBox="0 0 400 520" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:400px;margin:1.5em auto;display:block;">
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="6" refX="4" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6" fill="#94a3b8"/>
    </marker>
  </defs>
  <!-- Editor -->
  <rect x="60" y="10" width="280" height="52" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="200" y="34" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" font-weight="600" fill="#1e293b" text-anchor="middle">Editor</text>
  <text x="200" y="52" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">drag &amp; drop</text>
  <!-- Arrow -->
  <line x1="200" y1="62" x2="200" y2="92" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah)"/>
  <text x="260" y="82" font-family="ui-monospace, monospace" font-size="11" fill="#94a3b8" text-anchor="start">getContent()</text>
  <!-- JSON -->
  <rect x="60" y="96" width="280" height="52" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="200" y="120" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" font-weight="600" fill="#1e293b" text-anchor="middle">JSON</text>
  <text x="200" y="138" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">TemplateContent — store in your database</text>
  <!-- Arrow -->
  <line x1="200" y1="148" x2="200" y2="178" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah)"/>
  <text x="260" y="168" font-family="ui-monospace, monospace" font-size="11" fill="#94a3b8" text-anchor="start">renderToMjml()</text>
  <!-- MJML (highlighted) -->
  <rect x="60" y="182" width="280" height="52" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5" rx="10"/>
  <text x="200" y="206" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" font-weight="600" fill="#1e293b" text-anchor="middle">MJML</text>
  <text x="200" y="224" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#92400e" text-anchor="middle">rendered by Templatical</text>
  <!-- Divider -->
  <line x1="30" y1="260" x2="370" y2="260" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="6 4"/>
  <text x="200" y="280" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">Your code below — any MJML library, any language</text>
  <!-- Arrow -->
  <line x1="200" y1="290" x2="200" y2="310" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah)"/>
  <!-- HTML -->
  <rect x="60" y="314" width="280" height="52" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="200" y="338" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" font-weight="600" fill="#1e293b" text-anchor="middle">HTML</text>
  <text x="200" y="356" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">email-ready output</text>
  <!-- Arrow -->
  <line x1="200" y1="366" x2="200" y2="396" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah)"/>
  <!-- Send -->
  <rect x="60" y="400" width="280" height="52" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="200" y="424" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" font-weight="600" fill="#1e293b" text-anchor="middle">Send</text>
  <text x="200" y="442" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">your email service</text>
</svg>

1. **JSON** -- The editor's native format. A `TemplateContent` object with a `blocks` array and `settings` object. Save this to let users resume editing later.

2. **MJML** -- An intermediate markup language designed for email. Each Templatical block maps to an MJML component (`<mj-text>`, `<mj-image>`, `<mj-button>`, etc.). MJML handles the hard parts of email HTML: responsive tables, Outlook conditionals, and cross-client compatibility. **This is what Templatical's renderer produces.**

3. **HTML** -- The final output. MJML compiles to a complete HTML document with inline styles, nested tables, and client-specific workarounds. **You compile this step yourself** using any MJML library:

    | Language | Library |
    |----------|---------|
    | Node.js | [mjml](https://www.npmjs.com/package/mjml) (official) |
    | PHP | [spatie/mjml-php](https://github.com/spatie/mjml-php) |
    | Python | [mrml-python](https://github.com/alsuren/mjml-python) |
    | Ruby | [mrml-ruby](https://github.com/hardpixel/mrml-ruby) |
    | Rust | [mrml](https://github.com/jdrouet/mrml) |
    | .NET | [Mjml.Net](https://github.com/SebastianStehworte/mjml-net) |
    | Elixir | [mjml_nif](https://github.com/adoptoposs/mjml_nif) |

    See the full list on [mjml.io/community](https://mjml.io/community).

## Why MJML?

[MJML](https://mjml.io) is an open-source markup language designed specifically for email. Email HTML is notoriously difficult. Every email client renders HTML differently -- Outlook uses Microsoft Word's rendering engine, Gmail strips `<style>` tags, Apple Mail supports modern CSS but Yahoo doesn't. Writing HTML that works everywhere requires:

- Nested tables for layout (flexbox and grid don't work)
- Inline styles on every element (external/embedded stylesheets are stripped)
- Outlook-specific conditional comments (`<!--[if mso]>`)
- Responsive breakpoints via `<style>` tags for clients that support them

MJML abstracts all of this. You write semantic components (`<mj-section>`, `<mj-column>`, `<mj-text>`), and MJML compiles them to compatible HTML.

By producing MJML instead of HTML directly, Templatical stays lightweight and gives you full control over the final output. You can use any MJML compiler in any language, and you can modify the MJML before compiling — injecting custom components, adding tracking pixels, or transforming the markup to fit your sending platform's requirements.

## What to store

Save both JSON and MJML to your database when the user saves. JSON lets users re-open and edit the template. MJML is what you compile to HTML at send time. The [Quick Start](/getting-started/quick-start) example shows this pattern.

## What the renderer does

`@templatical/renderer` takes a `TemplateContent` JSON object and produces a complete MJML document. Specifically, it:

- Converts each block in the JSON tree to its corresponding MJML component (text → `<mj-text>`, image → `<mj-image>`, button → `<mj-button>`, etc.)
- Applies block styles (padding, margin, background color) as MJML attributes
- Handles responsive overrides for tablet and mobile viewports
- Injects custom font declarations as `<mj-font>` tags
- Preserves merge tags unchanged (they pass through as literal text)
- Respects `visibility` settings -- blocks hidden on all viewports are omitted
- Wraps blocks with `displayCondition` before/after strings
- Optionally strips raw HTML blocks when `allowHtmlBlocks` is `false`

## What the renderer does NOT do

- **Compile MJML to HTML** -- Use any [MJML library](#the-pipeline) for this step.
- **Evaluate merge tags** -- Tags like <code v-pre>{{ first_name }}</code> pass through as-is and are replaced at send time by your email platform.
- **Evaluate display conditions** -- Conditional wrapping (e.g., `{% if %}`) passes through for your sending platform to process.
- **Send emails** -- The renderer produces MJML. Sending is handled by your email service.
- **Optimize images** -- Images are referenced by URL. The renderer doesn't download, resize, or optimize them.

## Next steps

- [Renderer API](/api/renderer-typescript) -- full `renderToMjml()` reference
