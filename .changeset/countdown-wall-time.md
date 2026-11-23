---
"@templatical/types": minor
"@templatical/editor": patch
"@templatical/template-tools": patch
"@templatical/ai-kit": patch
---

A countdown's `targetDate` is now read as wall-clock time in its `timezone` everywhere. The type documents it as `YYYY-MM-DDTHH:mm` read in `timezone`, which is the value the editor's date field writes. Three places changed:

- The canvas preview and the alt text read that value in the block's timezone. They used to read it in the browser's timezone, so an author outside that zone saw a shifted countdown and alt text.
- A `targetDate` that carries `Z` or an offset is read as that instant.
- The date field shows a `targetDate` with `Z` or an offset as wall time in the block's timezone. Before, the field rendered empty.

Two new `@templatical/types` exports cover this: `countdownTargetTime(block)` returns the instant in epoch milliseconds, or `null`, and `countdownWallTime(block)` returns the `YYYY-MM-DDTHH:mm` value, or `""`. The docs and the agent skill no longer write `targetDate` with an offset.
