---
"@templatical/editor": minor
"@templatical/types": minor
---

Merge tags are re-picked rather than hand-edited

**Behaviour change.** Activating a merge tag in the content now reopens the tag chooser — `mergeTags.onRequest` when you have one, the built-in picker otherwise — instead of a text input holding the raw token. Editing a known tag's token as free text is gone. A token that no chooser can resolve, and an editor with neither `tags` nor `onRequest`, still get the text input, so a legacy or mistyped token can be repaired.

This closes a data-integrity bug: that input committed whatever was typed with no syntax check, so a chip could end up holding a value that is not a merge tag at all — which `renderToMjml` then emitted verbatim into the sent email. Input is now validated against the configured `syntax` and an invalid value is never committed.

It applies on every surface that renders a tag — the canvas and each sidebar field (button text and URL, image src and alt, video, menu, social, custom fields, template settings, and the rich-text link dialog). In a field, a tag is individually clickable; the surrounding text still opens the whole value for editing.

- **`mergeTags.onRequest` takes an optional `MergeTagRequestContext`** — `{ reason: "insert" | "edit", current?: MergeTag }`. `current` is the tag being replaced, absent for a token that matches no configured tag. Existing zero-argument callbacks are unaffected.
- **New `mergeTags.showRawValue`** (default `true`). Set `false` when `value` is an internal identifier an author should never see: tag tooltips then reveal nothing, on the canvas, in sidebar fields and in the built-in picker. It also governs what an *undeclared* tag renders as — the editor makes a tag out of anything matching your `syntax`, and such a tag normally shows the token as its own label; with the flag off it falls back to the label stored at insert time and then to a neutral placeholder, keeping the identifier out of the canvas and out of the accessible name. Display-only — stored content and rendered output are unchanged.
- The built-in picker preselects the tag being replaced and titles itself accordingly.
