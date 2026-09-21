---
title: Author features
description: What people see in the editor — saved blocks, comments, version history, test email, Issues, media — and which init() key or package turns each one on.
---

# Author features

What authors see. Each row is off until you pass its key (or, for Issues, install the optional quality package). The editor with only `container` still edits; it does not persist, comment, or send.

Provider methods run in the browser. Hide a control with `false`; enforce the same rule on your server. See [Connect your backend](/backend/).

## Storage and send

| Feature | What authors do | `init()` key | Docs | Playground |
|---|---|---|---|---|
| Save and load | Name the template, save, autosave, unsaved-changes guard | `templates` | [Saving and loading](/backend/templates) | [templates](https://play.templatical.com/scenes/templates) |
| Version history | Step through past versions, preview, restore | `versionHistory` | [Version history](/backend/version-history) | [version-history](https://play.templatical.com/scenes/version-history) |
| Comments | Thread on a block, reply, resolve | `comments` | [Comments](/backend/comments) | [comments](https://play.templatical.com/scenes/comments) |
| Saved blocks | Bookmark a group, browse, insert | `savedBlocks` | [Saved blocks](/backend/saved-blocks) | [saved-blocks](https://play.templatical.com/scenes/saved-blocks) |
| Media library | Browse, upload, crop, folders | `media` | [Media](/backend/media) | [media](https://play.templatical.com/scenes/media) |
| Test email | Send this template to an inbox | `testEmail` | [Test emails](/backend/test-email) | [test-email](https://play.templatical.com/scenes/test-email) |
| MJML / HTML export | `toMjml()` / `toHtml()` on the instance | `render` (optional; local renderer also works) | [Rendering](/backend/render) | [render](https://play.templatical.com/scenes/render) |

A bundled browser-local adapter exists for saved blocks and media if you want the UI with no server of your own yet.

## Built-in chrome

No provider. Configure on `init()` or in template settings.

| Feature | What authors do | Docs | Playground |
|---|---|---|---|
| Merge tags | Insert CRM fields with a readable label | [Merge tags](/guide/merge-tags) | [merge-tags](https://play.templatical.com/scenes/merge-tags) |
| Display conditions | Show or hide a block per recipient | [Display conditions](/guide/display-conditions) | [display-conditions](https://play.templatical.com/scenes/display-conditions) |
| Issues | Jump to a lint finding, apply a fix | [Quality](/quality/) — install `@templatical/quality` | [issues](https://play.templatical.com/scenes/issues) |
| Custom blocks | Drop a type you registered | [Custom blocks](/guide/custom-blocks) | [custom-blocks](https://play.templatical.com/scenes/custom-blocks) |

Issues is an optional peer: skip the package and the tab never downloads.
