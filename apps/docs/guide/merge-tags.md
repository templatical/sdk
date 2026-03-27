---
title: Merge Tags
description: Dynamic content placeholders using merge tags in Templatical email templates.
---

# Merge Tags

Merge tags are placeholders for dynamic content -- things like a recipient's name, a product price, or an unsubscribe URL. They appear as highlighted tokens in the editor and pass through unchanged in the rendered MJML. Your email sending platform replaces them with real values at send time.

Templatical provides built-in syntax presets for popular platforms and supports custom syntax definitions.

## Configuration

Pass a `tags` array to register your merge tags with the editor. When the editor detects a merge tag value in the content (e.g. <code v-pre>{{first_name}}</code>), it replaces it visually with the human-readable `label` ("First Name") — making the template much easier to read and edit. The raw value is preserved in the output.

![Data tag displayed in the editor](/images/data-tag.png)

Hovering over a tag reveals the raw value behind the label.

The `syntax` property is optional and defaults to `'liquid'`.

```ts
import { init } from '@templatical/vue';

const editor = init({
  container: '#editor',
  mergeTags: {
    tags: [
      { label: 'First Name', value: '{{first_name}}' },
      { label: 'Last Name', value: '{{last_name}}' },
      { label: 'Email', value: '{{email}}' },
      { label: 'Company', value: '{{company.name}}' },
      { label: 'Unsubscribe URL', value: '{{unsubscribe_url}}' },
    ],
  },
});
```

## MergeTag type

Each tag is defined with a label (shown in the editor UI) and a value (the full merge tag string including delimiters):

```ts
interface MergeTag {
  label: string;
  value: string;
}
```

The `value` must include the syntax delimiters. For example, with Liquid syntax:

<code v-pre>value: '{{first_name}}'</code>

## Syntax presets

Templatical includes five built-in syntax presets. The `syntax` setting tells the editor how to detect and highlight both data tags and logic tags in content.

Each preset defines two patterns:
- **Data tags** -- variable placeholders like a recipient's name or email
- **Logic tags** -- control flow statements like conditionals and loops

| Preset | Data tag | Logic tag | Platform |
|--------|----------|-----------|----------|
| `'liquid'` | <code v-pre>{{first_name}}</code> | <code v-pre>{% if vip %}</code> | Shopify, Jekyll, Django, Jinja2 |
| `'handlebars'` | <code v-pre>{{first_name}}</code> | <code v-pre>{{#if vip}}</code> | Handlebars.js, Mandrill |
| `'mailchimp'` | `*\|FIRST_NAME\|*` | `*\|IF:VIP\|*` | Mailchimp |
| `'ampscript'` | `%%first_name%%` | `%%[IF @vip]%%` | Salesforce Marketing Cloud |

```ts
mergeTags: {
  syntax: 'handlebars',
  tags: [
    { label: 'First Name', value: '{{first_name}}' },
  ],
}
```

## Logic tags

Beyond data placeholders, the editor also recognizes logic tags -- conditional statements, loops, and other control flow syntax used by your email platform. These are detected automatically using the `logic` regex pattern from the selected syntax preset.

When a logic tag is detected in content, the editor extracts the keyword (the first capture group from the logic regex) and displays it as an uppercase badge -- for example, `{% if customer.vip %}` renders as **IF** and `{% endif %}` renders as **ENDIF**. Hovering over the badge shows the full tag value as a tooltip. Users can click the badge to edit the raw value.

![Logic tag displayed in the editor](/images/logic-tag.png)

Logic tags are styled differently from data tags (outlined badge with primary color vs filled background) so template authors can distinguish between variable placeholders and control flow at a glance.

Like data tags, logic tags pass through unchanged in the rendered MJML — your sending platform evaluates them at send time.

Examples of logic tags by preset:

::: code-group
```html [Liquid]
{% if customer.vip %}
  <p>Exclusive offer just for you!</p>
{% endif %}

{% for item in cart.items %}
  <p>{{item.name}} - {{item.price}}</p>
{% endfor %}
```
```html [Handlebars]
{{#if hasSubscription}}
  <p>Your plan renews on {{renewal_date}}</p>
{{/if}}

{{#each products}}
  <p>{{this.name}}</p>
{{/each}}
```
```html [Mailchimp]
*|IF:VIP|*
  <p>VIP discount applied</p>
*|END:IF|*
```
```html [AMPscript]
%%[IF @subscriber_type == "premium"]%%
  <p>Premium content here</p>
%%[ENDIF]%%
```
:::

## Custom syntax

If the built-in presets don't match your platform, define a custom syntax with two regex patterns -- one for data tags and one for logic tags:

```ts
interface SyntaxPreset {
  value: RegExp;  // matches data tags like ${user.name}
  logic: RegExp;  // matches logic tags like $[IF ...]
}
```

Example for a `${...}` / `$[...]` syntax:

```ts
mergeTags: {
  syntax: {
    value: /\$\{.+?\}/g,
    logic: /\$\[\s*(\w+).*?\]/g,
  },
  tags: [
    { label: 'User Name', value: '${user.name}' },
    { label: 'Order Total', value: '${order.total}' },
  ],
}
```

The `value` regex detects data placeholders. The `logic` regex detects control flow statements — the first capture group `(\w+)` extracts the keyword (e.g., `IF`, `FOR`) which the editor uses as the display label.

## Dynamic tag loading

For large or context-dependent tag lists, use the `onRequest` callback instead of (or in addition to) a static `tags` array. The editor calls this function when the user clicks to insert a merge tag. Use it to open a custom picker modal, fetch available placeholders from your API, or build a context-aware tag list based on the current user. Return the selected `MergeTag` or `null` to cancel.

```ts
const editor = init({
  container: '#editor',
  mergeTags: {
    onRequest: async () => {
      const tag = await showMyMergeTagPicker();
      return tag; // MergeTag or null if cancelled
    },
  },
});
```

## Merge tags in other inputs

Placeholders aren't limited to text blocks. The editor detects and highlights merge tags in other block inputs too — button text, button URL, image URL, image alt text, and link href values. The same label replacement and tooltip behavior applies in these fields.

<img src="/images/button-merge-tag.png" alt="Merge tag in a button URL" style="max-width: 360px;" />
