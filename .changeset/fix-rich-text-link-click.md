---
"@templatical/editor": patch
---

Fix: clicking a link inside a rich-text block no longer opens it

Clicking a link inside a Paragraph or Title block used to navigate to its `href` (typically opening a new tab) instead of letting you work with the block. Two paths were affected:

- On the canvas (not editing), the link rendered as a plain `<a>` with no click guard — unlike Button/Menu/Image/Video/SocialIcons blocks, whose anchors carry a `@click.prevent`.
- While editing, StarterKit bundles its own Link extension (registered with `openOnClick: true`), which was registered alongside — and overriding — the editor's `LinkExt` (`openOnClick: false`). Disabling StarterKit's bundled Link (`link: false`) — plus its bundled Underline in the paragraph editor, which already adds its own — removes those duplicate extensions and the "duplicate extension names" console warnings TipTap logged for them.

A click on a rich-text link now selects the block on the canvas (double-click still opens the inline editor) and does nothing while editing; preview mode leaves links clickable. (#351)
