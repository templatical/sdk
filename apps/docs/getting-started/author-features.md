---
title: Author features
description: What people see in the editor — saved blocks, comments, version history, test email, Issues, media — and which init() key or package turns each one on.
---

# Author features

What authors see. Each row is off until you pass its key (or, for Issues, install the optional quality package). The editor with only `container` still edits; it does not persist, comment, or send.

Provider methods run in the browser. Hide a control with `false`; enforce the same rule on your server. See [Connect your backend](/backend/).

## Storage and send

| Feature | What authors do | `init()` key | Docs |
|---|---|---|---|
| Save and load | Name the template, save, autosave, unsaved-changes guard | `templates` | [Saving and loading](/backend/templates) |
| Version history | Step through past versions, preview, restore | `versionHistory` | [Version history](/backend/version-history) |
| Comments | Thread on a block, reply, resolve | `comments` | [Comments](/backend/comments) |
| Saved blocks | Bookmark a group, browse, insert | `savedBlocks` | [Saved blocks](/backend/saved-blocks) |
| Media library | Browse, upload, crop, folders | `media` | [Media](/backend/media) |
| Test email | Send this template to an inbox | `testEmail` | [Test emails](/backend/test-email) |
| MJML / HTML export | `toMjml()` / `toHtml()` on the instance | `render` (optional; local renderer also works) | [Rendering](/backend/render) |

A bundled browser-local adapter exists for saved blocks and media if you want the UI with no server of your own yet.

## Built-in chrome

No provider. Configure on `init()` or in template settings.

| Feature | What authors do | Docs |
|---|---|---|
| Merge tags | Insert CRM fields with a readable label | [Merge tags](/guide/merge-tags) |
| Display conditions | Show or hide a block per recipient | [Display conditions](/guide/display-conditions) |
| Issues | Jump to a lint finding, apply a fix | [Quality](/quality/) — install `@templatical/quality` |
| Custom blocks | Drop a type you registered | [Custom blocks](/guide/custom-blocks) |

Issues is an optional peer: skip the package and the tab never downloads.
