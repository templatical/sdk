---
title: Preview Rendering
description: Control what the editor's preview surfaces show — labels, sample values, or real data resolved by your backend.
---

# Preview Rendering

A template is full of things that aren't content: <code v-pre>{{first_name}}</code>, <code v-pre>{% if plan_name == 'pro' %}</code>. The editor has to show *something* for them, and what it shows depends on how much you've told it.

There are three layers, each one more realistic than the last. All of them apply **only to preview surfaces** — the editor's preview mode and the test-email dialog. The editing canvas always shows the tag you inserted, so you never edit text you didn't write.

| Layer | Configure | A preview shows |
| --- | --- | --- |
| **Labels** | nothing — always on | `First Name`, highlighted |
| **Sample values** | `MergeTag.sample` | `Ada`, as ordinary text |
| **Resolved data** | `resolvePreview` | whatever your backend returns, logic evaluated |

Later layers win. Set a `sample` and previews use it instead of the label; configure `resolvePreview` and it supersedes samples entirely.

## Labels (the default)

With `mergeTags.tags` configured, a tag renders as its human-readable `label` with a highlight, so the template reads as prose instead of tokens. Logic tags render as keyword badges — **IF**, **ENDIF**, **FOR**. See [Merge Tags](/guide/merge-tags) and [Logic tag highlighting](/guide/merge-tags#logic-tag-highlighting).

This answers *"which field goes here?"*. It doesn't tell you what the email will look like.

## Sample values {#sample-values}

Give a tag a `sample` and previews render that instead of its label:

```ts
mergeTags: {
  tags: [
    { label: 'First Name', value: '{{first_name}}', sample: 'Ada' },
    { label: 'Plan', value: '{{plan_name}}', sample: 'Pro' },
  ],
}
```

[Open in playground](https://play.templatical.com/scenes/merge-tags-samples)

Setting `sample` is the whole opt-in — there is no flag alongside it. See [Merge Tags](/guide/merge-tags#sample-values) for the field itself.

### The Sample / Label switch

A **Sample / Label** switch floats at the top of the canvas whenever a preview is showing, so a user can flip between the realistic view and the field names. The choice lasts for the session.

It renders **only when at least one configured tag declares a `sample`**, and previews default to Sample view only in that case. Configure none and the editor behaves exactly as before — Label view, no switch — so this is invisible until you opt in.

### The highlight follows the tag, not the view

| | In Sample view | In Label view |
| --- | --- | --- |
| Tag **with** a `sample` | the sample, as ordinary text — no highlight | its label, highlighted |
| Tag **without** one | its label, **highlighted** | its label, highlighted |

So a partly-configured template reads naturally where you've supplied data and stays visibly dynamic where you haven't — the remaining highlights double as a list of tags still missing a sample.

**Samples can't evaluate logic.** Substituting a value is not the same as taking a branch, so `{% if %}` … `{% endif %}` blocks stay visible as badges no matter how many samples you set. That ceiling is what the next layer exists for.

## Resolved data with `resolvePreview` {#resolved-data-with-resolvepreview}

Pass a callback and your own backend resolves the template:

```ts
import { init } from '@templatical/editor';

await init({
  container: '#editor',
  resolvePreview: async ({ content, recipient, trigger }) => {
    const res = await fetch('/api/resolve-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, recipient, trigger }),
    });
    if (!res.ok) throw new Error('Could not resolve the preview');
    return res.json(); // a TemplateContent
  },
});
```

[Open in playground](https://play.templatical.com/scenes/merge-tags-resolve-preview)

### Why a callback rather than a built-in engine

The editor **recognises** tags; it never **evaluates** them. `mergeTags.syntax` is a pair of regex patterns — one for value tags, one for logic tags — and matching is all the editor needs in order to highlight them. It is also all it does: logic tags pass through to the rendered MJML untouched, and whatever sends the email evaluates them there.

Evaluating a branch needs three things the editor doesn't have — your data, your template language, and the rules that decide what a branch means. And `syntax` accepts **your own regexes**, so the set of languages Templatical can be pointed at isn't bounded; there is no engine we could ship that would cover it.

So the hook hands the template to the system that already holds all three. Whatever renders your sends can render your previews.

### What you receive

```ts
interface PreviewResolveContext {
  content: TemplateContent; // the template as it currently stands, as a copy
  recipient?: string;       // the test-email dialog's address, when its field holds one
  surface: PreviewSurface;  // which preview is calling
  trigger: PreviewResolveTrigger; // why the resolver was called
}

type PreviewSurface = 'preview' | 'test-email';
type PreviewResolveTrigger = 'open' | 'refresh' | 'recipient' | 'locale';
```

`content` is a copy — mutating it cannot affect the editor. When `layout` is set, `content` is the composed document. See [Layout](/guide/layout). `surface` is `"preview"` in the editor's preview mode and `"test-email"` in the test-email dialog, on every call. Tell the two apart by `surface`, not by `recipient`: `recipient` is absent in preview mode, and also in the dialog while its recipient field is empty. Its absence means *"no particular recipient"*: return your own default, or obtain one yourself, for example by awaiting your own picker (see [Let the user pick an example audience](#let-the-user-pick-an-example-audience)). `trigger` is required and tells you whether to choose new example data or reuse the current choice.

Return a `TemplateContent`. Anything else is treated as a failure (see below).

### When it runs

- **`open`**, immediately when preview mode or the test-email dialog opens. The dialog passes its seeded recipient in this one call, or none when its field starts empty.
- **`refresh`**, immediately when the user clicks **Refresh preview** or the host calls `editor.refreshPreview()`.
- **`recipient`**, after a 500ms debounce when the test-email recipient changes. Rapid changes collapse into one call.
- **`locale`**, immediately when the template language changes while a preview is open.
- **Never while editing.** An editor that never enters preview mode never calls your hook.

The Refresh preview button appears in preview mode and in the test-email dialog only when `resolvePreview` is configured. `refreshPreview(): void` targets the dialog while it is open, otherwise preview mode; it does nothing when neither preview is open, no resolver is configured, or the editor is unmounted. A refresh also supersedes a pending recipient re-resolve.

A **first** resolve shows a skeleton. Later requests keep the last result on screen until they settle. After a failure, the unresolved template and failure note stay visible during the next request.

Slow answers are discarded when a newer request supersedes them, so switching recipient twice cannot land the first answer last.

### When it fails

If your callback rejects — or returns something that isn't a `TemplateContent` — the preview falls back to the **unresolved** template and says so inline. This also applies after an earlier successful resolve: a failed re-resolve drops the older result. A resolver outage degrades the preview; it never blanks or breaks it.

Failures are **not** routed to `config.onError`. A degraded preview is visible to the user and non-fatal, and reporting it there would read as more severe than it is.

### It is display-only

Resolved content reaches preview surfaces and nothing else. It is never written to editor state, never returned by `getContent()`, never sent by the test-email feature, and never exported — those always carry the real tokens.

That is the guarantee that makes the hook safe to be creative with: nothing you return can reach a recipient.

### Check it

Open the preview: the resolver is called once with `surface: "preview"` and `trigger: "open"`. Click **Refresh preview**: it is called again with `surface: "preview"` and `trigger: "refresh"`, and the preview shows what that call returns. Open the test-email dialog: it is called once with `surface: "test-email"` and `trigger: "open"`, with `recipient` only when the field starts filled.

## Use cases

### Preview as a specific recipient

The most direct one. The test-email dialog passes the selected address as `recipient`, so the preview shows what *that person* will receive — with their name, their plan, their branches taken.

```ts
resolvePreview: async ({ content, recipient }) => {
  const data = recipient
    ? await fetchSubscriber(recipient)
    : await fetchSampleSubscriber();
  return renderWithMyEngine(content, data);
},
```

### Let the user pick an example audience {#let-the-user-pick-an-example-audience}

Because the callback is `async`, you can open **your own UI** inside it and resolve once the user has chosen. Open the picker in preview mode (`surface: "preview"`) on `open` and `refresh`, and reuse the current choice on every other call. In the test-email dialog (`surface: "test-email"`) the recipient field is the user's choice, so the picker stays closed there, even while that field is empty. If you have several kinds of subscriber — free vs pro, trial vs churned, EU vs US — this lets someone flip between them and see each version of the email. The small picker below uses a browser prompt; replace it with your own dialog.

```ts
import { init } from '@templatical/editor';

let selectedAudience: string | null = null;

function openMyAudiencePicker(): string | null {
  return window.prompt('Example audience', selectedAudience ?? 'pro');
}

await init({
  container: '#editor',
  resolvePreview: async ({ content, recipient, surface, trigger }) => {
    if (surface === 'preview' && (trigger === 'open' || trigger === 'refresh')) {
      // A dismissed picker keeps the current choice.
      selectedAudience = openMyAudiencePicker() ?? selectedAudience;
    }
    if (!selectedAudience && !recipient) return content;

    const res = await fetch('/api/resolve-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, recipient, audience: selectedAudience }),
    });
    if (!res.ok) throw new Error('Could not resolve the preview');
    return res.json();
  },
});
```

While your picker is open on the first resolve, the preview shows its skeleton; on a refresh it keeps the current preview on screen. With no choice made yet and no recipient, returning `content` shows the unresolved template without a failure note. A recipient typed in the test-email dialog still resolves before anyone has used the picker. In the dialog, `recipient` is only where the test is sent: the remembered audience decides whose data renders, and your backend combines the two.

### Evaluate display conditions

[Display conditions](/guide/display-conditions) let a block be shown only when some rule holds. In the editor a user *simulates* that by clicking the block's filter icon — nothing checks the rule against data. A resolver can do it properly: omit blocks whose condition doesn't hold for the recipient, and the preview shows the real variation.

The manual filter steps aside while your resolver is showing, along with its restore button — you evaluated the conditions against real data, so a hand-toggled hide would veto the answer that was asked for. Nothing is discarded: the user's hidden blocks are back when they leave the preview.

### Reuse the engine that renders your sends

Something already renders your sends — your sending platform, your own service, a template engine on your server. It holds the data and speaks your template language, so posting the template to it and returning its output makes the preview agree with the delivered email by construction instead of approximating it in the browser.

It is also the only route when your template language can't be evaluated client-side at all, which includes any custom `syntax` you configure.

### Show what your platform appends at send time

If your application adds something to every email after it leaves the editor — a branding badge, a legal footer, an unsubscribe line, a logo header — the author never sees it while composing, so nothing tells them how the finished message ends. Have your backend append the same blocks it will append for real, and the preview shows the whole email.

```ts
resolvePreview: async ({ content, recipient }) => {
  // Your backend resolves the template and appends the same chrome it
  // adds at send time, so the unsubscribe link is that recipient's real one.
  const res = await fetch("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template: content, recipient }),
  });
  return res.json();
},
```

Return a whole `TemplateContent`, not just its `blocks`. An object carrying only `blocks` is accepted — that is all the shape check looks for — but it arrives without `settings`, and the preview loses the template's width, background and fonts. The appended blocks otherwise render through the canvas like any others, picking up the template's fonts and link styles, the dark-mode preview and the viewport switch.

Appending server-side is what keeps the two in step. The chrome is defined once, in the code path that appends it for real, so the preview cannot drift from the delivered email the way a second copy in the browser would. It also means the values are resolved rather than approximated: a real unsubscribe URL for `recipient`, not a token.

None of it can double up. Resolved content reaches preview surfaces only, so what your endpoint appends is never saved by `getContent()`, never exported by `toMjml()`, and never part of what the test-email feature sends — your send pipeline stays the only thing that appends for real.

### Pull in live data

Prices, stock levels, a personalised product grid. Anything the template references but doesn't store can be fetched at preview time, so the preview reflects reality rather than whatever was authored.

## See also

- [Merge Tags](/guide/merge-tags) — configuring tags, labels and `sample` values
- [Logic Tags](/guide/logic-tags) — inserting and highlighting control flow
- [Display Conditions](/guide/display-conditions) — condition simulation, and evaluating conditions for real via this hook
- [Test Emails](/backend/test-email) — the dialog whose preview resolves per recipient
- [Editor API](/api/editor) — the `resolvePreview` and `mergeTags` config reference
