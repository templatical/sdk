---
layout: home
hero:
  name: Templatical
  text: Email Editor for Your App
  tagline: Drop a production-ready drag-and-drop email editor into any web application — host CSS and design systems can't break it. Saving, version history, comments, test sends and rendering all plug into your own backend, through plain config objects you implement. Source-available and framework-agnostic.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/installation
    - theme: alt
      text: Try Playground
      link: https://play.templatical.com
features:
  - title: Design emails from a prompt
    details: An open Agent Skill teaches Claude Code, Cursor, or any AI agent your template format — describe an email, preview it in the real editor, export MJML/HTML.
    link: /guide/agent-skill
    linkText: Use the Agent Skill
  - title: Custom blocks with API-backed data
    details: Register your own block types — static templates or live API data at preview time.
    link: /guide/custom-blocks
    linkText: Build a custom block
  - title: Connect your own backend
    details: Saving, version history, comments, saved blocks, test sends and rendering are each one config key holding methods you implement — against your stack, on your terms. All optional; the editor runs with none of them.
    link: /backend/
    linkText: See the provider contracts
  - title: Reusable saved blocks
    details: Let users save block groups and re-insert them across templates — backed by your own storage, or a bundled browser-local provider for zero setup.
    link: /backend/saved-blocks
    linkText: Set up saved blocks
  - title: Merge tags with pluggable syntax
    details: Handlebars, Liquid, JS literals, or your own — with human-readable labels in the canvas.
    link: /guide/merge-tags
    linkText: Configure merge tags
  - title: Display conditions
    details: Show or hide blocks per recipient attribute, with live preview while editing.
    link: /guide/display-conditions
    linkText: See display conditions
  - title: Full theming via design tokens
    details: 27 OKLch tokens, custom fonts, dark mode, and complete theme overrides.
    link: /guide/theming
    linkText: Customize theming
  - title: Template & block defaults
    details: Define your brand once; new templates and blocks inherit colors, fonts, and layout.
    link: /guide/defaults
    linkText: Set defaults
  - title: Test emails from the editor
    details: Let users mail themselves the template they are editing, sent through your own infrastructure — one callback, no backend of ours involved.
    link: /backend/test-email
    linkText: Wire up test emails
  - title: JSON in, MJML out
    details: Portable JSON templates, MJML output. Render anywhere, send through any provider.
    link: /getting-started/how-rendering-works
    linkText: How rendering works
  - title: Style-isolated by default
    details: Shadow DOM mount keeps host CSS out of the editor and editor CSS out of your app. Drop into any page, framework, or CMS — no resets, no conflicts.
    link: /guide/shadow-dom
    linkText: How isolation works
  - title: Bring your existing templates
    details: Importers for BeeFree, Unlayer, and raw HTML. Migrate at your pace, no rebuild required.
    link: /guide/migration-from-beefree
    linkText: Migrate from BeeFree
---
