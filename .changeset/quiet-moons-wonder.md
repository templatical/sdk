---
"@templatical/editor": patch
---

Fix two ways the host page could break the editor

**Dialogs were clipped to the container in Safari.** When the container did not
fill the viewport, every dialog was painted cut off at its edge and the backdrop
dimmed only the editor's own area. Safari paints a `position: fixed` descendant
clipped to an ancestor's `overflow: hidden` box while still resolving its layout
against the viewport, and the editor's root carried that `overflow: hidden`. The
clip now sits on an inner chrome wrapper that does not enclose the popover root,
so dialogs cover the viewport again — both tag pickers, the link dialog,
test-email, save-block, saved-blocks browser, restore-version, and
`@templatical/media-library`'s modals when opened from the editor.

**Host typography inherited into the editor.** Twelve inheritable properties —
`letter-spacing`, `text-transform`, `font-style`, `font-weight` and others —
crossed into the chrome and the canvas, so a host with
`text-transform: uppercase` showed a preview of an email the recipient would
never receive. Shadow DOM does not prevent this: it blocks host rules, but
inheritance follows the flattened tree. The editor's root now neutralizes all
twelve. `direction` still inherits, so RTL pages keep working.

No API change, and no CSS reset is needed on your container — an aggressive one
(`all: initial` / `all: revert`) would wipe the `--tpl-user-*` theming
properties. See the new [Embedding the editor](https://docs.templatical.com/getting-started/embedding) guide.
