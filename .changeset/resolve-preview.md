---
"@templatical/editor": minor
"@templatical/types": minor
---

Add **`resolvePreview`** — a hook that resolves the template for preview surfaces using your own backend, so previews can show real data instead of tokens.

```ts
await init({
  container: '#editor',
  resolvePreview: async ({ content, recipient }) => {
    const res = await fetch('/api/resolve-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, recipient }),
    });
    if (!res.ok) throw new Error('Could not resolve');
    return res.json();
  },
});
```

**This is what `MergeTag.sample` cannot do.** Samples substitute value tags client-side; they can't evaluate **logic tags** — `{% if %}` … `{% endif %}` blocks stay visible as keyword badges, because substituting a value isn't taking a branch. And mailchimp/ampscript branching is a server-side dialect no browser can evaluate, so only your backend can. `initCloud()` takes the same key with the same type, and it is not plan-gated.

**Preview surfaces only, never while editing.** Runs on entering preview mode and — in the test-email dialog — on every recipient change, debounced 500ms. The editing canvas always shows the tag you inserted.

**Degrades, never breaks.** If the resolver rejects, or returns something that isn't a `TemplateContent`, the preview falls back to the unresolved template and says so inline. A shape check means a mis-shaped API response degrades rather than throwing inside the render. Failures are deliberately **not** routed to `onError`: a degraded preview is user-visible and non-fatal.

**Races are handled.** A superseded response is discarded even when it settles last, so switching recipient twice can't land the first answer. A *first* resolve shows a skeleton; a re-resolve keeps the previous result on screen rather than flashing over content that's already correct.

**Supersedes sample values entirely.** Configuring a resolver turns `MergeTag.sample` off: the Sample/Label switch never renders and the preview hint names your backend as the data source. This applies from the first frame rather than once a result lands — gating it on resolved content made the switch appear for the debounce plus resolver latency and then vanish. It also keeps the failure note truthful, since that note says the *unresolved* template is showing.

**Display-only, structurally.** Resolved content reaches preview surfaces and nothing else: never editor state, never `getContent()`, never a send, never an export. The `content` handed to your resolver is a `safeClone` copy, so mutating it cannot affect the editor.

New exports from `@templatical/types`: `ResolvePreview`, `PreviewResolveContext`, `isRenderableTemplateContent`.
