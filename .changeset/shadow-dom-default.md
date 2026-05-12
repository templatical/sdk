---
"@templatical/editor": minor
---

Mount the editor inside a Shadow DOM by default. `init({ container })` now resolve `shadowDom: true` when the option is omitted — host page stylesheets no longer cascade into editor elements (`p`, `h1`, `a`, `input`, etc.) via tag selectors, closing [issue #70](https://github.com/templatical/sdk/issues/70).

**Behavior changes consumers may notice:**

- External `document.querySelector("#editor .tpl-…")` queries no longer reach editor internals because the editor's DOM lives inside `container.shadowRoot`. Walk the shadow root explicitly (`container.shadowRoot.querySelector(...)`) or opt out with `shadowDom: false`.
- Host stylesheets that intentionally styled editor elements via element selectors stop applying. The supported theming protocol is now the `--tpl-user-*` CSS custom property namespace — set `--tpl-user-primary`, `--tpl-user-radius-md`, etc. on the editor container (or any ancestor) and the override inherits across the shadow boundary. The existing `theme` config option still takes precedence and works unchanged.
- Browser minimums in default mode bump to Firefox 101+ and Safari 16.4+ (required by the `adoptedStyleSheets` API). Chrome / Edge 80+ is unchanged. Pass `shadowDom: false` to keep the previous light-DOM mount with broader browser support.

The `shadowDom: false` escape hatch remains supported.
