---
"@templatical/quality": patch
---

Add `a11y.link-nested-anchor` rule and embrace HTML5-spec anchor parsing.

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
