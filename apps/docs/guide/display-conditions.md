---
title: Display Conditions
description: Conditional block visibility using display conditions in Templatical email templates.
---

# Display Conditions

Display conditions let template authors wrap blocks in conditional logic. When rendered, the block's output is surrounded by platform-specific conditional tags (e.g., Liquid `{% if %}` / `{% endif %}`), allowing the sending platform to show or hide content based on recipient data.

## Configuration

Define available conditions through the editor config:

```ts
import { init } from '@templatical/vue';

const editor = init({
  container: '#editor',
  displayConditions: {
    conditions: [
      {
        label: 'VIP Customers',
        before: '{% if customer.vip == true %}',
        after: '{% endif %}',
        description: 'Only shown to VIP customers',
      },
      {
        label: 'Has Active Subscription',
        before: '{% if subscription.active %}',
        after: '{% endif %}',
        description: 'Shown when user has an active subscription',
      },
    ],
  },
});
```

## DisplayCondition type

```ts
interface DisplayCondition {
  label: string;
  before: string;
  after: string;
  group?: string;
  description?: string;
}
```

| Property | Required | Description |
|----------|----------|-------------|
| `label` | Yes | Display name shown in the editor UI |
| `before` | Yes | Markup inserted before the block output |
| `after` | Yes | Markup inserted after the block output |
| `group` | No | Group name for organizing conditions in the dropdown |
| `description` | No | Explanatory text shown below the label |

## DisplayConditionsConfig

```ts
interface DisplayConditionsConfig {
  conditions: DisplayCondition[];
  allowCustom?: boolean;
}
```

When `allowCustom` is `true`, users can write their own `before` and `after` strings directly in the editor instead of choosing from the predefined list.

## Grouping conditions

Use the `group` property to organize conditions into logical sections. Groups appear as labeled sections in the condition picker dropdown.

```ts
displayConditions: {
  conditions: [
    {
      label: 'Premium Plan',
      before: '{% if user.plan == "premium" %}',
      after: '{% endif %}',
      group: 'Plan',
    },
    {
      label: 'Free Plan',
      before: '{% if user.plan == "free" %}',
      after: '{% endif %}',
      group: 'Plan',
    },
    {
      label: 'English',
      before: '{% if user.locale == "en" %}',
      after: '{% endif %}',
      group: 'Locale',
    },
    {
      label: 'Spanish',
      before: '{% if user.locale == "es" %}',
      after: '{% endif %}',
      group: 'Locale',
    },
  ],
}
```

## Platform-specific examples

### Liquid (Shopify, custom platforms)

```ts
{
  label: 'Returning Customer',
  before: '{% if customer.orders_count > 0 %}',
  after: '{% endif %}',
}
```

### Handlebars

```ts
{
  label: 'Has First Name',
  before: '{{#if first_name}}',
  after: '{{/if}}',
}
```

### Salesforce Marketing Cloud (AMPscript)

```ts
{
  label: 'Subscribed to Newsletter',
  before: '%%[IF @newsletter == "true" THEN]%%',
  after: '%%[ENDIF]%%',
}
```

### Liquid / Django / Jinja2

```ts
{
  label: 'Admin User',
  before: '{% if user.is_admin %}',
  after: '{% endif %}',
}
```

## How conditions affect output

When a block has a display condition assigned, the renderer wraps the block's HTML output with the `before` and `after` strings:

```html
{% if customer.vip == true %}
<tr>
  <td>
    <!-- block content here -->
  </td>
</tr>
{% endif %}
```

The conditional logic is evaluated by the sending platform at send time, not by Templatical. The editor and renderer treat the `before` and `after` strings as opaque -- they are inserted exactly as defined.

## Applying conditions in the editor

Users select a display condition from the block settings panel. Each block can have at most one display condition. In the editor canvas, blocks with conditions show a visual indicator so template authors can see which content is conditional at a glance.

::: tip Testing conditional content
Since Templatical doesn't evaluate conditions, the editor always shows conditional blocks. To verify conditions work correctly, send test emails with different recipient profiles through your email platform and confirm each variation renders as expected.
:::
