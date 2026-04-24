## Is Templatical Cloud available today?

Not yet. The backend is in development. The page you’re on is a placeholder to preview what’s coming. Check back soon, or follow progress on [GitHub](https://github.com/templatical/sdk).

## What’s the difference between the OSS editor and Cloud?

The open-source editor (`@templatical/editor`) is a complete, self-contained drag-and-drop email editor. You can use it today, on your own infrastructure, at no cost — it ships under a source-available license (FSL-1.1-MIT for the editor, core, and media library; MIT for shared types and the renderer).

**Cloud** is a hosted layer on top that adds AI, real-time collaboration, a media library, template scoring, version history, and more — features that require a backend to be useful.

See the full [OSS vs Cloud comparison](/compare).

## Can I self-host Cloud features?

No. Cloud is hosted-only — that’s what makes it different from the OSS core. If you need to self-host, the OSS editor covers template authoring, rendering, and export.

## What happens to my templates if I cancel?

They’re yours. Every template is exportable as JSON (portable to any Templatical editor) or as compiled HTML/MJML. No lock-in.

## What about data residency?

We plan to offer EU-based hosting at launch, with US regions to follow. Specific guarantees (GDPR DPA, SOC 2) will be documented before GA.

## What’s the pricing?

Not finalized. Expect a startup-friendly tier plus higher tiers for teams and enterprises.

## Can I use Cloud features inside my own product?

Yes — that’s the multi-tenant story. Embed the editor inside your SaaS, mint scoped JWT tokens for your users, and keep customer data fully isolated. [More on multi-tenant](/features/multi-tenant).

## Does Cloud require Vue?

The visual editor is Vue 3 based, but it mounts as a drop-in widget with one function call — works inside React, Svelte, Angular, or plain HTML host apps. Cloud APIs themselves are framework-agnostic REST + WebSocket.

## How do I get in touch?

Email [hello@templatical.com](mailto:hello@templatical.com) — or follow the repo on [GitHub](https://github.com/templatical/sdk).
