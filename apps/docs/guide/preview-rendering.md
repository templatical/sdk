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

## Sample values

Give a tag a `sample` and previews render that instead of its label:

```ts
mergeTags: {
  tags: [
    { label: 'First Name', value: '{{first_name}}', sample: 'Ada' },
    { label: 'Plan', value: '{{plan_name}}', sample: 'Pro' },
  ],
}
```

Setting `sample` is the whole opt-in — there is no flag alongside it. See [Merge Tags](/guide/merge-tags#sample-values) for the field itself.

### The Sample / Label switch

A **Sample / Label** switch appears beside the viewport toggle whenever a preview is showing, so a user can flip between the realistic view and the field names. The choice lasts for the session.

It renders **only when at least one configured tag declares a `sample`**, and previews default to Sample view only in that case. Configure none and the editor behaves exactly as before — Label view, no switch — so this is invisible until you opt in.

### The highlight follows the tag, not the view

| | In Sample view | In Label view |
| --- | --- | --- |
| Tag **with** a `sample` | the sample, as ordinary text — no highlight | its label, highlighted |
| Tag **without** one | its label, **highlighted** | its label, highlighted |

So a partly-configured template reads naturally where you've supplied data and stays visibly dynamic where you haven't — the remaining highlights double as a list of tags still missing a sample.

**Samples can't evaluate logic.** Substituting a value is not the same as taking a branch, so `{% if %}` … `{% endif %}` blocks stay visible as badges no matter how many samples you set. That ceiling is what the next layer exists for.

## Resolved data with `resolvePreview`

Pass a callback and your own backend resolves the template:

```ts
import { init } from '@templatical/editor';

await init({
  container: '#editor',
  resolvePreview: async ({ content, recipient }) => {
    const res = await fetch('/api/resolve-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, recipient }),
    });
    if (!res.ok) throw new Error('Could not resolve the preview');
    return res.json(); // a TemplateContent
  },
});
```

### Why a callback rather than a built-in engine

Templatical supports four merge-tag syntaxes, and two of them — **Mailchimp** and **AMPscript** — express branching in a server-side dialect that cannot be evaluated in a browser by us or by anyone. A first-party engine would resolve logic for Liquid consumers and nothing for everyone else, which is worse than being consistent. Your backend already knows your data and your dialect; this hook hands the template to it.

### What you receive

```ts
interface PreviewResolveContext {
  content: TemplateContent; // the template as it currently stands, as a copy
  recipient?: string;       // present only where the surface has one
}
```

`content` is a copy — mutating it cannot affect the editor. `recipient` is present in the test-email dialog and absent in the editor's preview mode; treat its absence as *"no particular recipient"* and return something renderable anyway.

Return a `TemplateContent`. Anything else is treated as a failure (see below).

### When it runs

- **Immediately** when a preview opens. There is nothing to coalesce at that moment, so it is not debounced — the skeleton is up in the same frame as the click.
- **Debounced 500ms** on subsequent re-resolves, which today means the test-email recipient changing. Rapid changes collapse into one call.
- **Never while editing.** An editor that never enters preview mode never calls your hook.

A **first** resolve shows a skeleton. A re-resolve keeps the previous result on screen instead of flashing a skeleton over content that is already correct.

Slow answers are discarded when a newer request supersedes them, so switching recipient twice cannot land the first answer last.

### When it fails

If your callback rejects — or returns something that isn't a `TemplateContent` — the preview falls back to the **unresolved** template and says so inline. A resolver outage degrades the preview; it never blanks or breaks it.

Failures are deliberately **not** routed to `config.onError`. A degraded preview is visible to the user and non-fatal, and reporting it there would read as more severe than it is.

### It is display-only

Resolved content reaches preview surfaces and nothing else. It is never written to editor state, never returned by `getContent()`, never sent by the test-email feature, and never exported — those always carry the real tokens.

That is the guarantee that makes the hook safe to be creative with: nothing you return can reach a recipient.

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

### Let the user pick an example audience

Because the callback is `async`, you can open **your own UI** inside it and resolve once the user has chosen. If you have several kinds of subscriber — free vs pro, trial vs churned, EU vs US — this lets someone flip between them and see each version of the email.

**Ask once and cache the choice.** A resolver that opens a picker on every call will re-prompt whenever the preview re-resolves, and worse: if a newer request supersedes the one whose dialog is open, the answer is discarded when it finally settles and the user's pick appears to do nothing.

```ts
let persona: Persona | null = null;

async function choosePersona(): Promise<Persona | null> {
  // Your own modal. Resolve with the chosen persona, or null if dismissed.
  return openPersonaPicker();
}

// Your own "Preview as…" button can clear the cache to re-prompt.
export function resetPersona() {
  persona = null;
}

const resolvePreview = async ({ content }) => {
  persona ??= await choosePersona();
  if (!persona) {
    // Dismissed. Throwing shows the unresolved template *and* the inline note;
    // returning `content` unchanged shows it with no note. Pick deliberately.
    return content;
  }
  return renderWithMyEngine(content, persona.data);
};
```

While your dialog is open the preview shows its skeleton, which is what you want — the preview genuinely isn't ready yet.

### Evaluate display conditions

[Display conditions](/guide/display-conditions) let a block be shown only when some rule holds. In the editor a user *simulates* that by clicking the block's filter icon — nothing checks the rule against data. A resolver can do it properly: omit blocks whose condition doesn't hold for the recipient, and the preview shows the real variation.

The manual filter steps aside while your resolver is showing, along with its restore button — you evaluated the conditions against real data, so a hand-toggled hide would veto the answer that was asked for. Nothing is discarded: the user's hidden blocks are back when they leave the preview.

### Run a template engine the browser can't

If your tokens are AMPscript or Mailchimp syntax, this is the only way to see branches resolved at all. Post the template to the service that already renders your sends and return its output.

### Pull in live data

Prices, stock levels, a personalised product grid. Anything the template references but doesn't store can be fetched at preview time, so the preview reflects reality rather than whatever was authored.

## Trying it out

The [playground](https://play.templatical.com) wires a fake resolver on the **Welcome Email** template only — it substitutes values and evaluates that template's `{% if plan_name == … %}` branches after a short delay, so you can watch the skeleton and see the conditional collapse to just the branch that applies.

Every other template leaves it off, so they demonstrate the Sample / Label switch instead. Both templates describe which feature they're showing in their "what's on this template" panel.

## See also

- [Merge Tags](/guide/merge-tags) — configuring tags, labels and `sample` values
- [Logic Tags](/guide/logic-tags) — inserting and highlighting control flow
- [Display Conditions](/guide/display-conditions) — condition simulation, and evaluating conditions for real via this hook
- [Test Emails](/guide/test-email) — the dialog whose preview resolves per recipient
- [Editor API](/api/editor) — the `resolvePreview` and `mergeTags` config reference
