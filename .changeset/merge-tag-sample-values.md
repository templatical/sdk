---
"@templatical/editor": minor
"@templatical/types": minor
---

Add **`MergeTag.sample`** — an example value that previews render in place of the tag, so a preview reads like a delivered email instead of a list of field names.

```ts
mergeTags: {
  tags: [
    { label: 'First Name', value: '{{first_name}}', sample: 'Ada' },
    { label: 'Plan', value: '{{plan_name}}', sample: 'Pro' },
  ],
}
```

Setting `sample` is the whole opt-in — there is no flag to enable alongside it. **Nothing appears until you configure one:** the Sample/Label switch renders only when at least one tag declares a `sample`, and previews default to Sample view only in that case. Set none and the editor behaves exactly as before, so this is a no-op for every existing configuration.

**Preview surfaces only, never while editing.** Substitution happens in preview mode and in the test-email dialog's preview. On the editing canvas a tag always shows its label, so an author keeps seeing the field they inserted rather than a value they never typed.

**A Sample / Label switch** appears beside the viewport toggle whenever a preview is showing, so you can flip between the realistic view and the field-name view. The choice lasts for the session.

**The highlight follows the individual tag, not the view.** In Sample view a tag with a `sample` renders as ordinary text with no highlight, while a tag without one keeps its label *and* its highlight. So a partly-configured template reads naturally where you've supplied data and stays visibly dynamic where you haven't — and the remaining highlights double as a list of tags still missing a sample.

**Display-only, and structurally so.** A sample is never written to the template, never included in `getContent()`, never sent by the test-email feature, and never present in MJML or HTML output — those always carry the real token. In rich text the substitution replaces the whole `<span data-merge-tag>`, so the substituted markup has no token left in it to export; the stored content is untouched.

Covered everywhere tags render: rich text, plain-string fields (button, image, video, menu), `html` block content, and top-level custom-block field values. Table cells are **not** covered — they are `contenteditable`, and injecting sample text into an editing control is a different problem. Logic tags (`{% if %}`) are unaffected: substitution replaces a value, it cannot evaluate a branch, so they stay keyword badges in both views.

The built-in merge tag picker now shows a tag's sample, so an author can see what it will render before inserting.

New exports from `@templatical/types`: `getMergeTagSample`, `hasMergeTagSamples`, `substituteHtmlMergeTagSamples`, `substituteTextMergeTagSamples`.
