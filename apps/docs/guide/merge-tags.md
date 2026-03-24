---
title: Merge Tags
description: Dynamic content placeholders using merge tags in Templatical email templates.
---

# Merge Tags

Merge tags are placeholders that get replaced with dynamic content when the email is sent. Templatical provides built-in syntax presets for popular platforms and supports custom syntax definitions.

## Configuration

Pass merge tags through the editor config:

```ts
import { init } from '@templatical/vue';

const editor = init({
  el: '#editor',
  mergeTags: {
    syntax: 'liquid',
    tags: [
      { label: 'First Name', value: 'first_name' },
      { label: 'Last Name', value: 'last_name' },
      { label: 'Email', value: 'email' },
      { label: 'Company', value: 'company.name' },
      { label: 'Unsubscribe URL', value: 'unsubscribe_url' },
    ],
  },
});
```

## MergeTag type

Each tag is defined with a label (shown in the editor UI) and a value (inserted into the template):

```ts
interface MergeTag {
  label: string;
  value: string;
}
```

The `value` is the variable name without the surrounding syntax delimiters. For example, with Liquid syntax, a tag with `value: 'first_name'` renders as <code v-pre>{{ first_name }}</code> in the template.

## MergeTagsConfig

```ts
interface MergeTagsConfig {
  syntax?: MergeTagSyntax | CustomMergeTagSyntax;
  tags?: MergeTag[];
}
```

## Syntax presets

Templatical includes five built-in syntax presets:

| Preset | Output | Platform |
|--------|--------|----------|
| `'liquid'` | <code v-pre>{{ first_name }}</code> | Shopify, Jekyll |
| `'handlebars'` | <code v-pre>{{first_name}}</code> | Handlebars.js, Mandrill |
| `'mailchimp'` | `*\|FIRST_NAME\|*` | Mailchimp |
| `'ampscript'` | `%%first_name%%` | Salesforce Marketing Cloud |
| `'django'` | <code v-pre>{{ first_name }}</code> | Django, Jinja2 |

```ts
mergeTags: {
  syntax: 'handlebars',
  tags: [
    { label: 'First Name', value: 'first_name' },
  ],
}
// Inserts: {{first_name}}
```

## Custom syntax

If the built-in presets do not match your platform, define a custom syntax with a regex pattern:

```ts
mergeTags: {
  syntax: {
    prefix: '${',
    suffix: '}',
  },
  tags: [
    { label: 'User Name', value: 'user.name' },
  ],
}
// Inserts: ${user.name}
```

## Dynamic tag loading

For large or context-dependent tag lists, use the `onRequestMergeTag` callback instead of (or in addition to) a static `tags` array. The editor calls this function when the user opens the merge tag picker.

```ts
const editor = init({
  el: '#editor',
  mergeTags: {
    syntax: 'liquid',
  },
  onRequestMergeTag: async () => {
    const response = await fetch('/api/merge-tags');
    const tags = await response.json();
    return tags; // MergeTag[]
  },
});
```

The callback should return a `MergeTag[]` array. Results replace any previously loaded tags in the picker UI.

## Usage in templates

Once configured, users can insert merge tags from the toolbar while editing text blocks. Tags appear as highlighted tokens in the editor and render with the configured syntax delimiters in the exported HTML/MJML output.

Merge tags can also be used in:
- Button URLs
- Image `src` and `linkUrl` properties
- Link `href` values in text content

```ts
const block = createButtonBlock({
  text: 'View your dashboard',
  url: '{{ dashboard_url }}',
});
```
