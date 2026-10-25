# @templatical/quality

## 0.50.0

### Minor Changes

- 051113f: Add default-on compatibility lint for authored pass-through HTML and CSS, using a pinned caniemail snapshot, plus an explicit compiled-HTML Gmail size check. Agents and headless callers receive a concrete `suggestion` and `reference` on every issue, with affected clients and an excerpt when available. The editor shows suggestions and source links, and offers an on-demand Check size action when its render provider can compile without saving. `templatical validate --html` reports `htmlBytes` and a clipping warning.

  Breaking changes: `LintIssue.suggestion` and `.reference` are required; existing `message` text is shortened to the problem, with the action in `suggestion`. Message maps and formatter results now contain `{ message, suggestion }` objects. Compatibility is on by default, so four category keys set to `false` no longer disable all linting; set the fifth `compatibility: false` too. Custom-block client-fact IDs move from `safety.*` to `compat.*`, and `CustomBlockIssueSeverity` now includes `info`.

- 2db2846: `lintTemplate` now runs the `deliverability` category by default. Agents can use `lintDeliverability`, `DELIVERABILITY_RULES`, localized messages, `DEFAULT_SHORTENER_HOSTS`, and `DEFAULT_DELIVERABILITY_THRESHOLDS` directly. The category flags `deliverability.link-text-domain-mismatch` (`warning`), `deliverability.url-shortener` (`warning`), `deliverability.ip-address-url` (`warning`), and `deliverability.low-text` (`info`). Each rule reports a JSON-detectable content cue; none auto-fixes or scores a template.

  These rules flag content patterns that spam filters and mailbox-provider guidelines name. They don't predict inbox placement: sender reputation, authentication and recipient engagement decide that.

  Configuration using `{ accessibility: false, structure: false, links: false }` no longer disables linting because deliverability still runs. Add `deliverability: false` or use `disabled: true`. Likewise, `{ structure: false, links: false }` now runs accessibility and deliverability; add `deliverability: false` to keep accessibility only.

### Patch Changes

- Updated dependencies [61518b7]
- Updated dependencies [3af9072]
  - @templatical/types@0.50.0

## 0.49.0

### Patch Changes

- Updated dependencies [588b367]
  - @templatical/types@0.49.0

## 0.48.0

### Minor Changes

- d329c13: Sections can render as heroes

  A one-column section with a background image can render as an MJML `mj-hero`: the image fills the box and the content sits on top. Set `section.hero`:

  - `height: "image"` makes the box as tall as the image drawn across its desktop width; a phone keeps that height and crops the image's sides. It needs the image file's size, which `backgroundImage` carries as optional `naturalWidth` / `naturalHeight`, as an image block does. A media pick that knows the size stores it with the URL; otherwise the editor measures the image when the author sets it.
  - A number is a fixed height in px, padding included.
  - Either way the email carries a fixed height, which classic Outlook on Windows keeps; it ignores MJML's fluid height and would show only the top of the image.
  - `verticalAlign` places the content: `"top"`, `"middle"` or `"bottom"`.

  In the editor, a section's Background panel gains **Height** (Fit content, Match image, Fixed) and **Content position**, and the palette gains a **Hero** shortcut that inserts a hero-mode section with a title, a paragraph and a button. A hero has no border and always paints its image `cover`, unrepeated, so those controls hide while it applies and keep their values. `paletteBlocks` accepts `"hero"`.

  With more than one column, no image, or `"image"` without the size, the section renders as a regular one, and the new `structure.hero-not-applied` warning says which. `@templatical/types` exports `resolveHero`, which the renderer, the linter and the editor share. The template JSON schema in `@templatical/template-tools` gains `section.hero` and the background image's size.

  The MJML importer reads `mj-hero` as a hero section instead of an HTML block, and reads Templatical's own exported **Match image** heroes back as `height: "image"`. Easy Email Pro's `standard-hero` keeps its image behind the content instead of stacking it as a leading image block.

### Patch Changes

- Updated dependencies [10ca348]
- Updated dependencies [d329c13]
- Updated dependencies [d6641bc]
  - @templatical/types@0.48.0

## 0.47.0

### Minor Changes

- 2797f5e: Sections and wrapper bands take a background image

  There was no way to put an image behind content — a hero banner or a textured band needed an HTML block, and HTML blocks render inside `mj-text`, where a background can't reach the section.

  `SectionBlock`, `SectionWrapper` and the layout `WrapperBlock` gain an optional `backgroundImage: BackgroundImage` — `{ url, size, position: { x, y }, repeat }`, with `size` one of `"cover"`, `"contain"` or `"auto"` and `position` a 9-point grid. It renders as MJML's `background-url`, `background-size`, `background-position` and `background-repeat` on the `mj-section` / `mj-wrapper`, which includes MJML's VML fallback for Outlook on Windows. The element's `backgroundColor` stays its fallback colour. Templates without an image render exactly as before.

  The editor's Background panel gets an image control for sections, and the section wrapper settings get one for the band: a URL (merge tags, the media browser and drag-and-drop upload all work, as for image blocks), then Fill / Fit / Original, a position grid and a repeat toggle. The canvas paints the image through `resolveImageUrl` like image blocks do, and the dark-mode preview leaves it un-inverted, as it does images.

  `createBackgroundImage()`, `resolveBackgroundImage()` and `encodeCssUrl()` are exported from `@templatical/types`, so the canvas and the renderer resolve images identically. `encodeCssUrl` percent-encodes the characters that could end a quoted CSS `url()`, because MJML pastes the URL verbatim into inline CSS.

  `lintStructure` gains two warnings for Outlook on Windows: `structure.wrapper-color-over-background-image` (a wrapper colour paints over the section's image there) and `structure.nested-background-image` (an image on both the wrapper and its section breaks the layout there).

  Outlook on Windows tiles an image at its original size (`auto`) from the top center, whatever the position and repeat settings.

### Patch Changes

- Updated dependencies [fb6c024]
- Updated dependencies [f8018d8]
- Updated dependencies [2797f5e]
- Updated dependencies [7afcadf]
- Updated dependencies [4d0870d]
  - @templatical/types@0.47.0

## 0.46.0

### Minor Changes

- 1045b2c: New `link.relative-url` rule (warning). It flags a link whose URL starts with `/`, `./`, `../` or `?`, or is protocol-relative (`//host`). A sent email has no page address to resolve such a URL against, so the link breaks in the inbox. Only these path-shaped prefixes count, so a URL that opens with a merge tag (`{{ unsubscribe_url }}`) is never flagged. Lower it, raise it or turn it off through `links.rules`.

### Patch Changes

- Updated dependencies [9d97f4d]
- Updated dependencies [c395ecf]
- Updated dependencies [f24888a]
  - @templatical/types@0.46.0

## 0.45.0

### Patch Changes

- Updated dependencies [347c2b0]
  - @templatical/types@0.45.0

## 0.44.3

### Patch Changes

- @templatical/types@0.44.3

## 0.44.2

### Patch Changes

- @templatical/types@0.44.2

## 0.44.1

### Patch Changes

- @templatical/types@0.44.1

## 0.44.0

### Patch Changes

- Updated dependencies [841cb38]
  - @templatical/types@0.44.0

## 0.43.3

### Patch Changes

- @templatical/types@0.43.3

## 0.43.2

### Patch Changes

- @templatical/types@0.43.2

## 0.43.1

### Patch Changes

- @templatical/types@0.43.1

## 0.43.0

### Patch Changes

- Updated dependencies [be4ac17]
  - @templatical/types@0.43.0

## 0.42.1

### Patch Changes

- @templatical/types@0.42.1

## 0.42.0

### Patch Changes

- Updated dependencies [5758c24]
- Updated dependencies [cb82f7e]
  - @templatical/types@0.42.0

## 0.41.0

### Patch Changes

- @templatical/types@0.41.0

## 0.40.0

### Minor Changes

- b7ff7d9: Add an embedder `layout` overlay: a Templatical JSON shell with one `slot` (top-level or inside a layout `wrapper` card), applied at preview and `toMjml` / `toHtml`, never written into `getContent()`.

### Patch Changes

- Updated dependencies [b7ff7d9]
  - @templatical/types@0.40.0

## 0.39.4

### Patch Changes

- @templatical/types@0.39.4

## 0.39.3

### Patch Changes

- @templatical/types@0.39.3

## 0.39.2

### Patch Changes

- @templatical/types@0.39.2

## 0.39.1

### Patch Changes

- @templatical/types@0.39.1

## 0.39.0

### Patch Changes

- Updated dependencies [a2b4cde]
  - @templatical/types@0.39.0

## 0.38.0

### Patch Changes

- Updated dependencies [67cd83d]
  - @templatical/types@0.38.0

## 0.37.0

### Patch Changes

- @templatical/types@0.37.0

## 0.36.0

### Patch Changes

- Updated dependencies [d8e38e4]
  - @templatical/types@0.36.0

## 0.35.0

### Minor Changes

- 703193a: Add first-class email content direction (`settings.direction`: `"ltr"` | `"rtl"`). The canvas, previews, and `<mjml dir>` follow it independently of the editor chrome; when unset, RTL content languages (`ar`, `he`, `fa`, `ur`, …) resolve as RTL. New title and table blocks start at the start edge. The all-caps accessibility rule skips caseless scripts so Arabic and Hebrew copy is not flagged as shouting.

### Patch Changes

- Updated dependencies [703193a]
  - @templatical/types@0.35.0

## 0.34.3

### Patch Changes

- @templatical/types@0.34.3

## 0.34.2

### Patch Changes

- @templatical/types@0.34.2

## 0.34.1

### Patch Changes

- @templatical/types@0.34.1

## 0.34.0

### Patch Changes

- @templatical/types@0.34.0

## 0.33.0

### Patch Changes

- Updated dependencies [d76c343]
  - @templatical/types@0.33.0

## 0.32.0

### Patch Changes

- @templatical/types@0.32.0

## 0.31.0

### Patch Changes

- @templatical/types@0.31.0

## 0.30.0

### Patch Changes

- Updated dependencies [39c7c1e]
- Updated dependencies [e2790cc]
  - @templatical/types@0.30.0

## 0.29.1

### Patch Changes

- @templatical/types@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [09f6136]
  - @templatical/types@0.29.0

## 0.28.1

### Patch Changes

- @templatical/types@0.28.1

## 0.28.0

### Patch Changes

- Updated dependencies [2cacdbc]
  - @templatical/types@0.28.0

## 0.27.6

### Patch Changes

- @templatical/types@0.27.6

## 0.27.5

### Patch Changes

- @templatical/types@0.27.5

## 0.27.4

### Patch Changes

- @templatical/types@0.27.4

## 0.27.3

### Patch Changes

- @templatical/types@0.27.3

## 0.27.2

### Patch Changes

- @templatical/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [18f6b38]
  - @templatical/types@0.27.1

## 0.27.0

### Patch Changes

- Updated dependencies [d256b41]
- Updated dependencies [d256b41]
- Updated dependencies [d256b41]
- Updated dependencies [d256b41]
- Updated dependencies [d256b41]
  - @templatical/types@0.27.0

## 0.26.3

### Patch Changes

- @templatical/types@0.26.3

## 0.26.2

### Patch Changes

- Updated dependencies [4b976a8]
  - @templatical/types@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [a95274c]
  - @templatical/types@0.26.1

## 0.26.0

### Patch Changes

- Updated dependencies [753262e]
  - @templatical/types@0.26.0

## 0.25.2

### Patch Changes

- @templatical/types@0.25.2

## 0.25.1

### Patch Changes

- dda6373: Add `a11y.text-justified` — flags justified body copy in paragraph blocks

  Justified text stretches word spacing to reach both margins, opening uneven "rivers" of white space that are hardest to track for dyslexic and low-vision readers; email clients justify without hyphenation, so the gaps get wider still. WCAG 2.1 SC 1.4.8 requires that text not be justified.

  Companion to the paragraph toolbar's new **Justify** button in `@templatical/editor` — the editor offers the alignment, the linter advises against it, and consumers who want it can silence the rule with `accessibility: { rules: { "a11y.text-justified": "off" } }`.

  Default severity is `warning`, and the rule ships an auto-fix. The fix **removes** the `text-align` declaration rather than forcing `left`, so the paragraph inherits the document default — which is also the correct result for right-to-left content. Sibling declarations in the same `style` attribute (a `line-height` from the editor's line-height control, for example) are preserved.

  Only paragraph blocks are checked. Every other block stores alignment as a typed field whose union excludes `justify`, so no other block can express it.
  - @templatical/types@0.25.1

## 0.25.0

### Patch Changes

- Updated dependencies [7c24a7c]
  - @templatical/types@0.25.0

## 0.24.1

### Patch Changes

- @templatical/types@0.24.1

## 0.24.0

### Patch Changes

- Updated dependencies [c9b9eea]
  - @templatical/types@0.24.0

## 0.23.0

### Patch Changes

- Updated dependencies [7d51750]
  - @templatical/types@0.23.0

## 0.22.0

### Patch Changes

- @templatical/types@0.22.0

## 0.21.2

### Patch Changes

- Updated dependencies [635eb7e]
  - @templatical/types@0.21.2

## 0.21.1

### Patch Changes

- @templatical/types@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [fc545c2]
  - @templatical/types@0.21.0

## 0.20.0

### Patch Changes

- Updated dependencies [90f088e]
  - @templatical/types@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [ef6deec]
- Updated dependencies [b8fbca0]
  - @templatical/types@0.19.0

## 0.18.0

### Patch Changes

- @templatical/types@0.18.0

## 0.17.1

### Patch Changes

- @templatical/types@0.17.1

## 0.17.0

### Patch Changes

- @templatical/types@0.17.0

## 0.16.5

### Patch Changes

- @templatical/types@0.16.5

## 0.16.4

### Patch Changes

- Updated dependencies [1801876]
  - @templatical/types@0.16.4

## 0.16.3

### Patch Changes

- @templatical/types@0.16.3

## 0.16.2

### Patch Changes

- @templatical/types@0.16.2

## 0.16.1

### Patch Changes

- @templatical/types@0.16.1

## 0.16.0

### Patch Changes

- Updated dependencies [e5156a5]
- Updated dependencies [d35d36e]
  - @templatical/types@0.16.0

## 0.15.1

### Patch Changes

- @templatical/types@0.15.1

## 0.15.0

### Patch Changes

- Updated dependencies [7afeacb]
  - @templatical/types@0.15.0

## 0.14.0

### Patch Changes

- Updated dependencies [710c9be]
- Updated dependencies [718d781]
  - @templatical/types@0.14.0

## 0.13.0

### Patch Changes

- @templatical/types@0.13.0

## 0.12.1

### Patch Changes

- @templatical/types@0.12.1

## 0.12.0

### Patch Changes

- Updated dependencies [7b76e46]
- Updated dependencies [67f44fb]
- Updated dependencies [a209073]
  - @templatical/types@0.12.0

## 0.11.1

### Patch Changes

- @templatical/types@0.11.1

## 0.11.0

### Patch Changes

- @templatical/types@0.11.0

## 0.10.4

### Patch Changes

- @templatical/types@0.10.4

## 0.10.3

### Patch Changes

- @templatical/types@0.10.3

## 0.10.2

### Patch Changes

- Updated dependencies [5676cb3]
  - @templatical/types@0.10.2

## 0.10.1

### Patch Changes

- Updated dependencies [2ed1b80]
  - @templatical/types@0.10.1

## 0.10.0

### Minor Changes

- f51fc5b: Add a single `lintTemplate(content, options?)` entry point that runs every linter — accessibility, structure, and links — and returns the merged issue list. Prefer it over calling `lintAccessibility` / `lintStructure` / `lintLinks` individually: new linter categories are picked up automatically by every consumer that funnels through it.

  The editor's live linter (`useTemplateLint`) now calls `lintTemplate` internally; behavior is unchanged. The individual linter exports remain available.

### Patch Changes

- Updated dependencies [2d9779b]
- Updated dependencies [ac9eab8]
- Updated dependencies [5d961a3]
- Updated dependencies [4309923]
- Updated dependencies [af913bb]
- Updated dependencies [72e1e58]
  - @templatical/types@0.10.0

## 0.9.1

### Patch Changes

- @templatical/types@0.9.1

## 0.9.0

### Patch Changes

- Updated dependencies [4dfe37e]
  - @templatical/types@0.9.0

## 0.8.5

### Patch Changes

- 674571b: Harden HTML/regex hot paths against polynomial-ReDoS and incomplete-sanitization classes flagged by GitHub code scanning. All changes preserve existing public APIs.
  - `@templatical/types`: rewrite `resolveHtmlMergeTagLabels` / `resolveHtmlLogicMergeTagLabels` from a `<span[^>]*…[^>]*>` regex to a single-pass linear scanner. Adversarial inputs that used to take O(n²) now complete in O(n).
  - `@templatical/renderer`: same linear-scanner rewrite for `convertMergeTagsToValues`. Paragraph stripper changed `[^>]*` → `[^<>]*` so it fails fast on `<p<p<p…`-style inputs.
  - `@templatical/quality`: linear-time HTML-comment stripper in `hasNestedAnchors`. An unterminated `<!--` now drops the rest of the input rather than leaving the literal `<!--` behind (closes the incomplete-sanitization gap). The `link.javascript-protocol` rule now also flags `data:` and `vbscript:` URLs — both can encode executable script and were previously only flagged as the lower-severity `link.unsupported-protocol`. Rule ID unchanged; message gained a `{protocol}` placeholder. Severity overrides set against `link.javascript-protocol` continue to apply.
  - `@templatical/import-unlayer` / `@templatical/import-beefree`: replace `<p[^>]*>([\s\S]*?)</p>` paragraph-wrap regex with a linear scanner. Button-label sanitizer now drops unterminated `<script` fragments instead of leaving them in the imported JSON. `parsePxValue` collapses two whitespace quantifiers around an optional `px` so trailing whitespace can't trigger backtracking.
  - CI: every job in `.github/workflows/ci.yml` now runs under a least-privilege `permissions: contents: read` token. Closes the missing-workflow-permissions alerts.
  - Playground Cloudflare Worker: `generateId` switched from `bytes[i] % 62` (biased — indices 0..7 were ~25% more likely than 8..61) to rejection sampling for a uniform distribution over the alphabet.

  Regression coverage added: 13 new tests assert linear-time behavior on 10k–50k-char adversarial inputs (bounded at 500ms), plus correctness tests for the new dangerous-protocol coverage, nested-span rewriting, and button-label sanitization edge cases.

- Updated dependencies [674571b]
  - @templatical/types@0.8.5

## 0.8.4

### Patch Changes

- @templatical/types@0.8.4

## 0.8.3

### Patch Changes

- @templatical/types@0.8.3

## 0.8.2

### Patch Changes

- d835948: Add `a11y.link-nested-anchor` rule and embrace HTML5-spec anchor parsing.

  **New rule**
  - `a11y.link-nested-anchor` (default severity `error`) flags templates that contain an `<a>` opened inside another open `<a>`. Nested anchors are invalid HTML and email clients render them inconsistently — some flatten, some strip the inner anchor, some break the click target.
  - Detection inspects the raw HTML on `Paragraph` and `Title` blocks via a new exported helper `hasNestedAnchors(html)`, which tokenizes anchor open/close tags and ignores anchor-like text inside HTML comments.
  - Opt out per-template via `lintAccessibility(content, { accessibility: { rules: { "a11y.link-nested-anchor": "off" } } })`, or downgrade with `"warning"` / `"info"`.

  **Behavior change in `extractAnchors`**

  `htmlparser2` 12 (bumped from 9) emits an implicit `</a>` when a second `<a>` opens, matching the HTML5 spec. `extractAnchors` now returns nested anchors as flat siblings rather than merging the outer anchor's surrounding text. For input `'<a href="/outer">prefix <a href="/inner">inner</a> suffix</a>'`:

  ```diff
  - outer.text === "prefix inner suffix"
  + outer.text === "prefix"
  + inner.text === "inner"   // unchanged
  ```

  Text that appears after the inner anchor's close and before the outer's stray `</a>` is outside any open anchor in the spec parse and is not attributed to either. Consumers calling `extractAnchors` directly should check whether their callers relied on the old merged-text behavior; the structural concern (nested-anchor markup) is now captured by `a11y.link-nested-anchor`.

  **New exports**
  - `hasNestedAnchors(html: string): boolean`
  - @templatical/types@0.8.2

## 0.8.1

### Patch Changes

- 75bfd29: Reshape `LintOptions` around per-tool config namespaces. Each linter's severity overrides and tool-specific knobs now live under its own key, and each linter can be disabled individually.

  **`@templatical/quality`**
  - `LintOptions.rules` and `LintOptions.thresholds` moved into their owning linter namespace: `accessibility.rules`, `accessibility.thresholds`, `structure.rules`, `links.rules`. `LintOptions.links` keeps `nonProductionHosts` but now also accepts `links.rules`.
  - Each tool key (`accessibility`, `structure`, `links`) accepts `false` to disable that linter entirely without enumerating its rules — e.g. `lintLinks(content, { links: false })` returns `[]`.
  - New `isLintFullyDisabled(options)` helper returns `true` when no linter would run — either `disabled: true` or all three tool keys set to `false`. The editor uses this gate to skip lazy-loading the package, hide the Issues sidebar tab, and suppress canvas badges. Headless consumers can use it to short-circuit before any linter call.
  - New exported option types: `AccessibilityLintOptions`, `StructureLintOptions`, `LinksLintOptions`, `RuleOverrides`. The old `LintLinksOptions` type is removed (replaced by `LinksLintOptions`).
  - Severity override keys still use the full prefixed rule ID (`a11y.*`, `structure.*`, `link.*`) — the same ID emitted on `LintIssue.ruleId`, so values copied from an issue paste straight into config.

  ```diff
  - lintAccessibility(content, {
  -   rules: { "a11y.img-missing-alt": "warning" },
  -   thresholds: { minFontSize: 16 },
  - });
  + lintAccessibility(content, {
  +   accessibility: {
  +     rules: { "a11y.img-missing-alt": "warning" },
  +     thresholds: { minFontSize: 16 },
  +   },
  + });

  - lintLinks(content, {
  -   rules: { "link.localhost-or-staging": "error" },
  -   links: { nonProductionHosts: ["*.preview.*"] },
  - });
  + lintLinks(content, {
  +   links: {
  +     rules: { "link.localhost-or-staging": "error" },
  +     nonProductionHosts: ["*.preview.*"],
  +   },
  + });
  ```

  **`@templatical/editor`**
  - `init({ lint })` and `initCloud({ lint })` consume the new shape verbatim. When every per-tool key is set to `false` the editor behaves as if `lint.disabled === true`: no chunk download for `@templatical/quality`, no Issues sidebar tab, no inline canvas badges.
  - `useTemplateLint` re-exports the new `isLintFullyDisabled` helper.
  - @templatical/types@0.8.1

## 0.8.0

### Minor Changes

- 6705a64: Add `lintStructure` + `lintLinks` and reshape the quality package around a shared linting surface.

  **`@templatical/quality`**
  - New `lintStructure(content, options?)` linter — 5 rules: `structure.duplicate-block-id`, `structure.section-column-mismatch`, `structure.nested-section`, `structure.empty-section` (auto-fix removes the section), `structure.empty-column`.
  - New `lintLinks(content, options?)` linter — 5 rules covering URL hygiene across every URL-bearing field in the template (anchors in rich text + `button.url`, `image.linkUrl`, `video.url`, `menu.items[].url`, `social.icons[].url`):
    - `link.javascript-protocol` (error) — flags `javascript:` hrefs that the render-time sanitizer would silently strip.
    - `link.unsupported-protocol` (warning) — flags explicit schemes outside `http`, `https`, `mailto`, `tel`, `sms`.
    - `link.malformed-mailto` (warning) — sanity-checks `mailto:` recipient + domain shape.
    - `link.malformed-tel` (warning) — rejects letters in `tel:` URIs.
    - `link.localhost-or-staging` (warning) — flags URL hosts matching `options.links.nonProductionHosts` (default catches `localhost`, `127.0.0.1`, `0.0.0.0`, `*.local`, `*.staging.*`, `*.dev.*`).
  - New `walkUrls(content) → UrlOccurrence[]` helper for headless callers building URL-scoped rules.
  - `LintOptions` gains `links?: { nonProductionHosts?: string[] }` for `link.localhost-or-staging` configuration. `DEFAULT_NON_PRODUCTION_HOSTS` is exported as the baseline.
  - Rule IDs are now namespaced. Every accessibility rule is prefixed with `a11y.` (e.g. `img-missing-alt` → `a11y.img-missing-alt`); structure rules use `structure.`; link rules use `link.`. Severity overrides and message-map keys must use the prefixed form.
  - Type names renamed for cross-linter reuse: `A11yIssue` → `LintIssue`, `A11yOptions` → `LintOptions`, `A11yPatch` → `LintPatch`, `A11yPatchContext` → `LintPatchContext` (now also exposes `removeBlock`), `A11yThresholds` → `LintThresholds`, `DEFAULT_THRESHOLDS` → `DEFAULT_A11Y_THRESHOLDS`. The `RULES` export is now `ACCESSIBILITY_RULES`; new `STRUCTURE_RULES` and `LINK_RULES` exports sit alongside it.
  - New exports: `lintStructure`, `STRUCTURE_RULES`, `formatStructureMessage`, `getStructureMessages`, `SUPPORTED_STRUCTURE_MESSAGE_LOCALES`, `StructureMessageMap`, `StructureRuleMessageId`, `lintLinks`, `LINK_RULES`, `walkUrls`, `UrlOccurrence`, `UrlSource`, `formatLinkMessage`, `getLinkMessages`, `SUPPORTED_LINK_MESSAGE_LOCALES`, `LinkMessageMap`, `LinkRuleMessageId`, `LintLinksOptions`, `ResolvedLinksOptions`, `DEFAULT_NON_PRODUCTION_HOSTS`.

  **`@templatical/editor`**
  - `init({ accessibility })` is renamed to `init({ lint })` — the same option object now drives every linter exported by `@templatical/quality` (accessibility + structure + links).
  - Sidebar tab renamed from "Accessibility" to "Issues" and now shows all three linter families. The composable is `useTemplateLint` (was `useAccessibilityLint`); the inject key is `TEMPLATE_LINT_KEY`; the components are `IssuesPanel.vue` and `BlockIssueBadge.vue`.
  - Section toolbar now rebalances `children` when the columns layout changes (1↔2↔3 / 1-2 / 2-1) — grows pad with empty columns, shrinks merge trailing columns into the last kept column so blocks are never silently dropped. Eliminates the `structure.section-column-mismatch` error that previously fired on every layout change.
  - Editor button reset (`.tpl button { background: none }`) now wrapped in `:where()` so its specificity drops to (0,0,1) and per-button utility classes (e.g. `tpl:bg-[var(--tpl-primary)]`) win. Fixes the Fix-button-renders-transparent bug introduced by the canvas reset; affects every primary-bg button in the editor.

### Patch Changes

- @templatical/types@0.8.0

## 0.7.3

### Patch Changes

- @templatical/types@0.7.3

## 0.7.2

### Patch Changes

- @templatical/types@0.7.2

## 0.7.1

### Patch Changes

- @templatical/types@0.7.1

## 0.7.0

### Patch Changes

- @templatical/types@0.7.0

## 0.6.7

### Patch Changes

- @templatical/types@0.6.7

## 0.6.6

### Patch Changes

- @templatical/types@0.6.6

## 0.6.5

### Patch Changes

- @templatical/types@0.6.5

## 0.6.4

### Patch Changes

- @templatical/types@0.6.4

## 0.6.3

### Patch Changes

- @templatical/types@0.6.3

## 0.6.2

### Patch Changes

- @templatical/types@0.6.2

## 0.6.1

### Patch Changes

- b79c7cd: Fix four bugs in `@templatical/quality`:
  - **`text-all-caps` now flags non-Latin scripts.** The previous Latin-only character class silently passed all-caps Cyrillic, Greek, Vietnamese, and other non-Latin scripts. The rule now uses the Unicode `\p{L}` class with locale-aware case comparison, so `СКИДКА ПЯТЬДЕСЯТ ПРОЦЕНТОВ…` and `ΜΕΓΑΛΗ ΠΡΟΣΦΟΡΑ…` are reported just like English shouty caps.
  - **`img-linked-no-context` is now locale-aware.** Action-verb hints were hardcoded English, which produced false positives on every German / French / Portuguese alt text. The hints have moved into the dictionary registry as a new `linkedImageActionHints` field, with the same cross-locale union semantics as `vagueLinkText` and `vagueButtonLabels`. Locale contributors should add their language's action verbs (single tokens, e.g. `"kaufen"`, `"compre"`) when adding a new dictionary file.
  - **`link-target-blank-no-rel` auto-fix.** The fix performed a raw substring `String.replace` against the attribute string, so an earlier attribute whose value happened to contain `rel="…"` (e.g. `data-x='rel="external"'`) could be corrupted instead of the real `rel`. The fix now splices by the attribute's parsed start offset.
  - **`extractAnchors` (public utility).** When a nested `<a>` opened (invalid but parsed permissively), the outer anchor's accumulated prefix text was wiped. Each open anchor now owns its own buffer; nested anchors no longer truncate ancestors.

  The `Dictionary` type exported from `@templatical/quality` gains a required `linkedImageActionHints: string[]` field. Downstream contributors maintaining a custom `dictionaries/<locale>.ts` will see a `typeof en` typecheck error until they add the field — see the updated [Contributing locales](https://docs.templatical.com/quality/accessibility/contributing-locales) guide.
  - @templatical/types@0.6.1

## 0.6.0

### Minor Changes

- 55002de: Introduce `@templatical/quality` — an MIT-licensed accessibility linter for Templatical email templates — and wire it into the editor.

  **New package: `@templatical/quality`**
  - `lintAccessibility(content, options?)` — synchronous, pure, no DOM. Walks the JSON `TemplateContent` tree and runs every enabled rule, returning `A11yIssue[]` with `severity`, `message`, `blockId`, and an optional `fix` patch.
  - 19 deterministic rules across images, headings, links, text, buttons, and structure (missing alt, filename-style alt, low contrast, vague CTAs, heading-skip, multiple H1, target=\_blank without rel=noopener, all-caps, undersized touch targets, missing preheader, …). Three rules ship one-click auto-fixes.
  - Public utilities: `walkBlocks`, `getContrastRatio` (WCAG sRGB), `parseHex`, `isOpaqueHex`, `extractAnchors`, `extractText`, `getDictionary`, `formatMessage`, `getMessages`. Plus `Rule`, `RuleHit`, `RuleMeta`, `A11yIssue`, `A11yOptions`, etc.
  - Per-rule severity overrides (`'error' | 'warning' | 'info' | 'off'`) and configurable thresholds (`altMaxLength`, `minFontSize`, `allCapsMinLength`, `minTouchTargetPx`).
  - Locale-aware: rule messages and vague-text dictionaries auto-discover via `import.meta.glob` (drop a `messages/<lang>.ts` or `dictionaries/<lang>.ts` and it's bundled). The dictionary is a cross-locale union — a German-locale email with an English "Click here" button still flags. Ships `en` + `de` today.

  **Type changes (`@templatical/types`)**
  - `TemplateSettings.locale` (optional, defaults to `'en'`) — drives rendered `<mjml lang="…">`.
  - `ImageBlock.decorative` (optional boolean) — when true, the renderer forces `alt=""` and adds `role="presentation"`.
  - `PlanConfig.accessibility.blockOnError` (cloud) — server-side policy hook.

  **Renderer changes (`@templatical/renderer`)**
  - Emits `<mjml lang="…">` from `settings.locale`.
  - Honors `ImageBlock.decorative` (empty alt + role="presentation").

  **Editor integration (`@templatical/editor`)**
  - New `accessibility` option on `init()` / `initCloud()` — full `A11yOptions` shape. Optional peer; the dynamic import is gated and tree-shakeable, so the linter chunk never downloads when not used.
  - New `useAccessibilityLint` composable — debounced 500ms re-lint on content changes, applies auto-fixes through the editor's existing `updateBlock` / `updateSettings` (history-tracked, undoable per fix).
  - New right-sidebar "Accessibility" tab (lazy-loaded). Errors / Warnings / Info groups with localized messages, "Jump to block" and "Fix" buttons, count badge.
  - New inline canvas badge inside `BlockWrapper` — `CircleAlert` for errors, `TriangleAlert` for warnings.
  - New "Decorative image" toggle on `ImageToolbar` bound to `block.decorative`.
  - Editor mode forces the linter `locale` to match `init({ locale })` — `accessibility.locale` is overwritten on the way through. Headless callers keep full control.
  - Cloud save-gate: when `planConfig.accessibility.blockOnError === true` and the linter reports any errors, the save flow surfaces a confirmation modal. Both the toolbar Save button and the `Cmd/Ctrl+S` keyboard shortcut route through the gate.
  - New i18n keys (`accessibility.*` in `en` / `de` OSS chunks; `saveGate.*` in cloud chunks).
  - CDN bundle ships `@templatical/quality` and `@templatical/renderer` as separate code-split chunks, so CDN consumers don't install the optional peer manually.

### Patch Changes

- Updated dependencies [55002de]
  - @templatical/types@1.0.0
