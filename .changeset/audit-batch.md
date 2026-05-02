---
"@templatical/editor": patch
"@templatical/renderer": patch
---

Fix a batch of bugs uncovered by a targeted audit:

- **`@templatical/editor` `useFocusTrap`**: the focus-restore `requestAnimationFrame` is now cancelled when the trap deactivates before the frame fires, so it no longer touches stale DOM. A second activation (e.g. container ref swapped while still active) now tears down the previous keydown listener before binding a new one, preventing duplicate listeners.
- **`@templatical/editor` `useMergeTagField.insertMergeTag`**: a rejection from `requestMergeTag()` no longer leaves `insertingMergeTag` stuck at `true` and locking out `stopEditing()`. The flag is now reset in a `finally`.
- **`@templatical/editor` bundle-stats Vite plugin**: a failure inside the stats-generation `closeBundle` hook (missing dist file, unexpected layout) no longer crashes the editor build. The plugin warns and skips instead.
- **`@templatical/editor` `useRichTextLinkDialog`**: `mailto:`, `tel:`, `ftp:`, and `#anchor` URLs are no longer mangled by an unconditional `https://` prefix. Only bare hostnames/paths get the scheme prepended.
- **`@templatical/editor` `useKeyboardReorder`**: pressing Escape after a lifted block was moved across containers (e.g. concurrent drag) now correctly restores it. The cancel logic compares the full original location, not just the index.
- **`@templatical/editor` `formatRelativeTime`**: an invalid date string now returns `null` instead of `"NaN days ago"`.
- **`@templatical/editor` `SlidingPillSelect`**: the sliding pill is now hidden when `modelValue` matches no option, instead of silently parking on the first one and producing an `aria-checked` mismatch.
- **`@templatical/editor` `useCloudMediaLibrary.handleRequestMedia`**: a second call while the built-in media library is open no longer leaves the first call's promise hanging forever. The pending promise is now resolved with `null` before opening a new picker.
- **`@templatical/renderer` table & menu colors**: `borderColor`, `headerBackgroundColor`, `separatorColor`, and menu `item.color` are now run through a CSS-value escaper that strips `;`, `{`, `}`, and newlines. Tampered or AI-generated color values can no longer break out of the inline `style="color: …"` attribute to inject extra properties (e.g. `background: url(…)` for open-tracking).
- **`@templatical/renderer` title block**: title content stored as TipTap's `<p>...</p>` no longer produces invalid `<h2><p>...</p></h2>` markup. A single outer `<p>` wrapper is stripped before the `<h${level}>` tag is emitted.
- **`@templatical/renderer` columns**: the three-column layout widths now sum to exactly 100% (the last column rounds to 33.34% instead of 33.33%, eliminating a 0.01% gap that some clients distributed unpredictably).
- **`@templatical/renderer` image/video/button/menu links**: `target="_blank"` links now also emit `rel="noopener"`, closing a `window.opener` leak when emails are opened in webmail clients.
- **`@templatical/renderer` custom block background**: `CustomBlock.styles.backgroundColor` now reaches the compiled HTML — the renderer was emitting `<mj-text>` without `container-background-color`, so MJML silently dropped the bg (same class as #26).
- **`@templatical/renderer` image with empty `src`**: the renderer no longer emits `<mj-image src="">` (which compiles to a broken-image `<img src="">`). Empty-src images are now skipped, mirroring the `video` block's existing behavior.
- **`@templatical/renderer` title heading levels**: out-of-range `level` values no longer interpolate `font-size="undefinedpx"` and break MJML compilation. Both `font-size` and the heading tag are clamped to a defined entry.
- **`@templatical/renderer` nested sections**: a `SectionBlock` placed inside a column (via tampered JSON or programmatic API) is now filtered out instead of emitting `<mj-section>` inside `<mj-column>`, which mjml@5 rejects with a hard error.
- **`@templatical/renderer` button**: `backgroundColor` and `textColor` are now `escapeAttr`'d like every other user-supplied attribute. A `"` in either value can no longer break the surrounding MJML attribute.
- **`@templatical/renderer` button with empty `url`**: an empty button URL no longer compiles to a clickable `<a href="">` (which navigates to the current page on click). The `href` attribute is omitted entirely when the URL is empty.
- **`@templatical/renderer` spacer**: spacers now occupy exactly `height` pixels in the exported HTML, matching the editor canvas. `block.styles.padding` no longer inflates a 30px spacer to 50px.
- **`@templatical/renderer` empty paragraph**: a paragraph with no content (or only `<p></p>` / whitespace) now renders to an empty string instead of a styled `<td>` cell that silently consumes vertical and horizontal whitespace.
- **`@templatical/renderer` paragraph default font-size**: paragraphs without an explicit font-size now render at 14px to match the editor canvas (Tailwind `text-sm`), not mjml@5's intrinsic 13px default. Per-section TipTap inline `style="font-size: …"` overrides still apply.
