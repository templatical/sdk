---
"@templatical/renderer": patch
---

Fix: the unrenderable-block marker could emit a stray `--` inside its HTML comment.

`renderUnrenderableBlock` wraps a block's `type` and `id` in an HTML comment, and `commentSafe` scrubs both first. It collapsed hyphen runs *before* stripping `<` / `>`:

```ts
value.replace(/-{2,}/g, "-").replace(/[<>]/g, "")
```

Removing a bracket can bring two hyphens together that the collapse pass has already walked past, so the sanitizer reintroduced the sequence it exists to remove — `-<-` came out as `--`, and `-<-<-` as `---`. The two passes now run the other way round.

**Not a vulnerability, and the marker was never escapable.** Closing a comment needs `>` (`-->` or `--!>`) and every `>` is stripped, so no input could terminate the comment early — verified against inputs including `a--><script>x</script>`. What a stray `--` produced was a non-conforming comment, which email clients are free to treat as they like.

Both marker tests now count terminators as `--!?>` rather than `-->`. `--!>` closes a comment too — the HTML parser's "comment end bang state" — so an assertion that counted only `-->` could not see a leak through the other spelling.

This is also what a CodeQL `js/incomplete-html-attribute-sanitization` alert on this line was gesturing at, though not what it reported — it read the comment's `type="…"` text as an HTML attribute and warned about unescaped double quotes. A `"` is inert inside a comment; the real flaw was the ordering above.
