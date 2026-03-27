---
title: Custom Blocks
description: Define your own block types with custom fields, Liquid templates, and data sources in Templatical.
---

# Custom Blocks

Custom blocks let you extend Templatical with your own block types. Define a set of fields, write a Liquid template for rendering, and optionally connect a data source. Users interact with custom blocks through the same drag-and-drop interface as built-in blocks.

## Defining a custom block

Pass custom block definitions through the editor config:

```ts
import { init } from '@templatical/vue';

const editor = init({
  container: '#editor',
  customBlocks: [
    {
      type: 'product-card',
      name: 'Product Card',
      icon: '<svg>...</svg>',
      description: 'Displays a product with image, title, and price',
      fields: [
        { name: 'imageUrl', label: 'Product Image', type: 'image' },
        { name: 'title', label: 'Title', type: 'text' },
        { name: 'price', label: 'Price', type: 'number', min: 0, step: 0.01 },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'ctaUrl', label: 'Button URL', type: 'text' },
        {
          name: 'ctaColor',
          label: 'Button Color',
          type: 'color',
        },
      ],
      template: `
        <div style="text-align: center; font-family: sans-serif;">
          <img src="{{ imageUrl }}" alt="{{ title }}" style="max-width: 100%;" />
          <h2 style="margin: 16px 0 8px;">{{ title }}</h2>
          <p style="color: #666; font-size: 14px;">{{ description }}</p>
          <p style="font-size: 24px; font-weight: bold; color: #111;">
            \${{ price }}
          </p>
          <a href="{{ ctaUrl }}"
             style="display: inline-block; padding: 12px 32px;
                    background-color: {{ ctaColor }}; color: #fff;
                    text-decoration: none; border-radius: 6px;">
            Buy Now
          </a>
        </div>
      `,
    },
  ],
});
```

## CustomBlockDefinition

```ts
interface CustomBlockDefinition {
  type: string;
  name: string;
  icon?: string;
  description?: string;
  fields: CustomBlockField[];
  template: string;
  dataSource?: DataSourceConfig;
}
```

| Property | Required | Description |
|----------|----------|-------------|
| `type` | Yes | Unique identifier (used as `customType` on block instances) |
| `name` | Yes | Display name in the block palette |
| `icon` | No | SVG string for the palette icon |
| `description` | No | Tooltip or subtitle in the palette |
| `fields` | Yes | Array of field definitions |
| `template` | Yes | Liquid template string for rendering |
| `dataSource` | No | External data fetching configuration |

## Field types

Each field defines a form control in the block settings panel.

```ts
interface CustomBlockField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'image' | 'color' | 'number' | 'select' | 'boolean' | 'repeatable';
  defaultValue?: any;
  // Number fields
  min?: number;
  max?: number;
  step?: number;
  // Select fields
  options?: { label: string; value: string }[];
  // Repeatable fields
  fields?: CustomBlockField[];
  minItems?: number;
  maxItems?: number;
}
```

### text

Single-line text input.

```ts
{ name: 'title', label: 'Title', type: 'text', defaultValue: 'Untitled' }
```

### textarea

Multi-line text input for longer content.

```ts
{ name: 'body', label: 'Body Text', type: 'textarea' }
```

### image

Image URL input with upload/browse integration.

```ts
{ name: 'heroImage', label: 'Hero Image', type: 'image' }
```

### color

Color picker input.

```ts
{ name: 'accentColor', label: 'Accent Color', type: 'color', defaultValue: '#6366f1' }
```

### number

Numeric input with optional min, max, and step constraints.

```ts
{ name: 'rating', label: 'Rating', type: 'number', min: 1, max: 5, step: 1 }
```

### select

Dropdown with predefined options.

```ts
{
  name: 'size',
  label: 'Size',
  type: 'select',
  options: [
    { label: 'Small', value: 'sm' },
    { label: 'Medium', value: 'md' },
    { label: 'Large', value: 'lg' },
  ],
  defaultValue: 'md',
}
```

### boolean

Toggle switch.

```ts
{ name: 'showBadge', label: 'Show Badge', type: 'boolean', defaultValue: true }
```

### repeatable

A repeatable group of sub-fields. Users can add or remove items within the configured bounds.

```ts
{
  name: 'features',
  label: 'Features',
  type: 'repeatable',
  minItems: 1,
  maxItems: 5,
  fields: [
    { name: 'icon', label: 'Icon', type: 'image' },
    { name: 'text', label: 'Text', type: 'text' },
  ],
}
```

## Liquid templates

The `template` property uses Liquid syntax. Field values are available as top-level variables matching their `name` property.

For repeatable fields, use Liquid's `for` loop:

```liquid
<table>
  {% for feature in features %}
  <tr>
    <td><img src="{{ feature.icon }}" width="24" /></td>
    <td>{{ feature.text }}</td>
  </tr>
  {% endfor %}
</table>
```

Conditionals work as expected:

```liquid
{% if showBadge %}
  <span style="background: #10b981; color: #fff; padding: 2px 8px;
               border-radius: 4px; font-size: 12px;">New</span>
{% endif %}
```

## Data sources

A data source lets a custom block fetch external data. When the block is added to the canvas (or when the user triggers a refresh), the `onFetch` callback is called and the returned data populates the block's field values.

```ts
interface DataSourceConfig {
  onFetch: (fieldValues: Record<string, any>) => Promise<Record<string, any>>;
}
```

```ts
{
  type: 'weather-widget',
  name: 'Weather',
  fields: [
    { name: 'city', label: 'City', type: 'text', defaultValue: 'New York' },
    { name: 'temperature', label: 'Temperature', type: 'text' },
    { name: 'condition', label: 'Condition', type: 'text' },
    { name: 'iconUrl', label: 'Icon', type: 'image' },
  ],
  template: `
    <div style="text-align: center;">
      <img src="{{ iconUrl }}" width="48" />
      <p style="font-size: 24px; margin: 8px 0;">{{ temperature }}</p>
      <p>{{ condition }} in {{ city }}</p>
    </div>
  `,
  dataSource: {
    onFetch: async (fieldValues) => {
      const res = await fetch(
        `https://api.weather.example.com?city=${encodeURIComponent(fieldValues.city)}`
      );
      const data = await res.json();
      return {
        temperature: `${data.temp}°F`,
        condition: data.condition,
        iconUrl: data.icon_url,
      };
    },
  },
}
```

The `onFetch` callback receives the block's current `fieldValues` so you can use user-provided inputs (like a city name) as parameters. The returned object is merged into `fieldValues`, and the block's `dataSourceFetched` flag is set to `true`.

## Complete example: Product card

Here is a full custom block definition for a product card with a data source that fetches product details from an API:

```ts
const productCard: CustomBlockDefinition = {
  type: 'product-card',
  name: 'Product Card',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>',
  description: 'Fetches and displays product details',
  fields: [
    { name: 'productId', label: 'Product ID', type: 'text' },
    { name: 'imageUrl', label: 'Image', type: 'image' },
    { name: 'name', label: 'Product Name', type: 'text' },
    { name: 'price', label: 'Price', type: 'text' },
    { name: 'showRating', label: 'Show Rating', type: 'boolean', defaultValue: true },
    { name: 'rating', label: 'Rating', type: 'number', min: 0, max: 5, step: 0.1 },
    {
      name: 'badges',
      label: 'Badges',
      type: 'repeatable',
      minItems: 0,
      maxItems: 3,
      fields: [
        { name: 'text', label: 'Badge Text', type: 'text' },
        { name: 'color', label: 'Badge Color', type: 'color', defaultValue: '#6366f1' },
      ],
    },
  ],
  template: `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; font-family: sans-serif;">
      <img src="{{ imageUrl }}" alt="{{ name }}" style="width: 100%; display: block;" />
      <div style="padding: 16px;">
        {% for badge in badges %}
          <span style="display: inline-block; background: {{ badge.color }}; color: #fff;
                       padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px;">
            {{ badge.text }}
          </span>
        {% endfor %}
        <h3 style="margin: 8px 0 4px; font-size: 18px;">{{ name }}</h3>
        {% if showRating %}
          <p style="color: #f59e0b; font-size: 14px; margin: 0 0 8px;">
            Rating: {{ rating }}/5
          </p>
        {% endif %}
        <p style="font-size: 22px; font-weight: bold; margin: 0;">{{ price }}</p>
      </div>
    </div>
  `,
  dataSource: {
    onFetch: async (fieldValues) => {
      if (!fieldValues.productId) {
        return {};
      }
      const res = await fetch(`/api/products/${fieldValues.productId}`);
      const product = await res.json();
      return {
        imageUrl: product.image_url,
        name: product.name,
        price: `$${product.price.toFixed(2)}`,
        rating: product.average_rating,
      };
    },
  },
};
```

Users enter a product ID, the data source fetches the product details, and the Liquid template renders the card. Badges are managed manually through the repeatable field.

## More examples

### Event card

An event invitation block with a schedule built using repeatable fields:

```ts
const eventCard: CustomBlockDefinition = {
  type: 'event-card',
  name: 'Event Card',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  description: 'Event details with schedule and RSVP',
  fields: [
    { name: 'eventName', label: 'Event Name', type: 'text', defaultValue: 'Untitled Event' },
    { name: 'date', label: 'Date', type: 'text', defaultValue: 'January 1, 2026' },
    { name: 'venue', label: 'Venue', type: 'text' },
    { name: 'venueAddress', label: 'Venue Address', type: 'text' },
    { name: 'accentColor', label: 'Accent Color', type: 'color', defaultValue: '#4f46e5' },
    { name: 'rsvpUrl', label: 'RSVP URL', type: 'text' },
    {
      name: 'schedule',
      label: 'Schedule',
      type: 'repeatable',
      minItems: 1,
      maxItems: 10,
      fields: [
        { name: 'time', label: 'Time', type: 'text' },
        { name: 'session', label: 'Session', type: 'text' },
      ],
    },
  ],
  template: `
    <div style="border-left: 4px solid {{ accentColor }}; padding: 16px 20px; font-family: sans-serif;">
      <h2 style="margin: 0 0 4px; font-size: 20px;">{{ eventName }}</h2>
      <p style="color: #666; margin: 0 0 12px; font-size: 14px;">{{ date }}{% if venue %} &middot; {{ venue }}{% endif %}</p>
      {% if venueAddress %}
        <p style="color: #999; margin: 0 0 16px; font-size: 13px;">{{ venueAddress }}</p>
      {% endif %}
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        {% for item in schedule %}
        <tr>
          <td style="padding: 6px 12px 6px 0; font-size: 13px; color: #666; white-space: nowrap; vertical-align: top;">{{ item.time }}</td>
          <td style="padding: 6px 0; font-size: 14px;{% unless forloop.last %} border-bottom: 1px solid #eee;{% endunless %}">{{ item.session }}</td>
        </tr>
        {% endfor %}
      </table>
      {% if rsvpUrl %}
        <a href="{{ rsvpUrl }}" style="display: inline-block; padding: 10px 24px; background: {{ accentColor }}; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px;">RSVP Now</a>
      {% endif %}
    </div>
  `,
};
```

### Testimonial

A customer testimonial with star rating and avatar:

```ts
const testimonial: CustomBlockDefinition = {
  type: 'testimonial',
  name: 'Testimonial',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  description: 'Customer quote with photo and rating',
  fields: [
    { name: 'quote', label: 'Quote', type: 'textarea' },
    { name: 'authorName', label: 'Author Name', type: 'text' },
    { name: 'authorTitle', label: 'Author Title', type: 'text' },
    { name: 'avatar', label: 'Avatar', type: 'image' },
    { name: 'rating', label: 'Rating (1-5)', type: 'number', min: 1, max: 5, step: 1, defaultValue: 5 },
    { name: 'showRating', label: 'Show Rating', type: 'boolean', defaultValue: true },
  ],
  template: `
    <table style="width: 100%; font-family: sans-serif;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding: 20px; background: #f9fafb; border-radius: 8px;">
          {% if showRating %}
            <p style="margin: 0 0 12px; font-size: 18px; letter-spacing: 2px;">
              {% if rating >= 1 %}&#9733;{% else %}&#9734;{% endif %}
              {% if rating >= 2 %}&#9733;{% else %}&#9734;{% endif %}
              {% if rating >= 3 %}&#9733;{% else %}&#9734;{% endif %}
              {% if rating >= 4 %}&#9733;{% else %}&#9734;{% endif %}
              {% if rating >= 5 %}&#9733;{% else %}&#9734;{% endif %}
            </p>
          {% endif %}
          <p style="margin: 0 0 16px; font-size: 16px; font-style: italic; color: #333; line-height: 1.5;">"{{ quote }}"</p>
          <table cellpadding="0" cellspacing="0">
            <tr>
              {% if avatar %}
                <td style="vertical-align: middle; padding-right: 12px;">
                  <img src="{{ avatar }}" width="40" height="40" style="border-radius: 50%; display: block;" alt="{{ authorName }}" />
                </td>
              {% endif %}
              <td style="vertical-align: middle;">
                <p style="margin: 0; font-weight: 600; font-size: 14px;">{{ authorName }}</p>
                {% if authorTitle %}
                  <p style="margin: 2px 0 0; font-size: 13px; color: #666;">{{ authorTitle }}</p>
                {% endif %}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `,
};
```

## Email compatibility tips

Custom block templates are rendered as raw HTML inside the email. Keep these guidelines in mind:

- **Use inline styles** -- Email clients strip `<style>` blocks. Put all styling in `style` attributes.
- **Use tables for layout** -- Flexbox and CSS Grid don't work in most email clients (especially Outlook). Use `<table>` for side-by-side layouts.
- **Avoid complex CSS** -- No `position`, `float`, `display: flex`, `box-shadow`, or CSS animations. Stick to `padding`, `margin`, `border`, `background-color`, `color`, `font-size`, and `text-align`.
- **Test in real clients** -- Outlook, Gmail, Apple Mail, and Yahoo all render HTML differently. Use a testing tool like Litmus or Email on Acid.

## Error handling in data sources

The `onFetch` callback should handle errors gracefully. If the fetch fails, return an empty object or partial data -- the block will render with whatever field values are available:

```ts
dataSource: {
  onFetch: async (fieldValues) => {
    try {
      const res = await fetch(`/api/products/${fieldValues.productId}`);
      if (!res.ok) return {};
      return await res.json();
    } catch {
      return {}; // Block renders with existing field values
    }
  },
},
```
