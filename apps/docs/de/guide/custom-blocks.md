---
title: Benutzerdefinierte Blöcke
description: Definieren Sie Ihre eigenen Blocktypen mit benutzerdefinierten Feldern, Liquid-Templates und Datenquellen in Templatical.
---

# Benutzerdefinierte Blöcke

Benutzerdefinierte Blöcke ermöglichen es Ihnen, Templatical um Ihre eigenen Blocktypen zu erweitern. Definieren Sie eine Reihe von Feldern, schreiben Sie ein Liquid-Template für das Rendering und verbinden Sie optional eine Datenquelle. Benutzer interagieren mit benutzerdefinierten Blöcken über die gleiche Drag-and-Drop-Oberfläche wie mit integrierten Blöcken.

## Einen benutzerdefinierten Block definieren

Übergeben Sie benutzerdefinierte Blockdefinitionen über die Editor-Konfiguration. Das folgende Beispiel erstellt einen "Testimonial"-Block mit einem Zitat, Autorendetails, Avatar und einer Sternebewertung. Nach der Registrierung können Benutzer ihn aus der Block-Palette in ihr Template ziehen und jedes Feld im Einstellungsbereich bearbeiten.

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  customBlocks: [
    {
      type: 'testimonial',
      name: 'Testimonial',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      description: 'Customer quote with photo and rating',
      fields: [
        { key: 'quote', label: 'Quote', type: 'textarea' },
        { key: 'authorName', label: 'Author Name', type: 'text' },
        { key: 'authorTitle', label: 'Author Title', type: 'text' },
        { key: 'avatar', label: 'Avatar', type: 'image' },
        { key: 'rating', label: 'Rating (1-5)', type: 'number', min: 1, max: 5, step: 1, default: 5 },
        { key: 'showRating', label: 'Show Rating', type: 'boolean', default: true },
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
              <p style="margin: 0 0 16px; font-size: 16px; font-style: italic;
                        color: #333; line-height: 1.5;">"{{ quote }}"</p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  {% if avatar %}
                    <td style="vertical-align: middle; padding-right: 12px;">
                      <img src="{{ avatar }}" width="40" height="40"
                           style="border-radius: 50%; display: block;"
                           alt="{{ authorName }}" />
                    </td>
                  {% endif %}
                  <td style="vertical-align: middle;">
                    <p style="margin: 0; font-weight: 600; font-size: 14px;">
                      {{ authorName }}
                    </p>
                    {% if authorTitle %}
                      <p style="margin: 2px 0 0; font-size: 13px; color: #666;">
                        {{ authorTitle }}
                      </p>
                    {% endif %}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `,
    },
  ],
});
```

![Übersicht benutzerdefinierter Blöcke](/images/custom-blocks-overview.png)

1. **Block-Palette** — Der `name` und das `icon` erscheinen hier. Benutzer ziehen den Block aus der Palette in ihr Template.
2. **Editor-Canvas** — Das Liquid-`template` wird genau wie definiert gerendert, wobei die Feldwerte aus dem Einstellungsbereich übernommen werden.
3. **Einstellungsbereich** — Jeder Eintrag in `fields` wird zu einem Formularelement, mit dem Benutzer den Inhalt des Blocks bearbeiten können.

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

| Eigenschaft | Erforderlich | Beschreibung |
|----------|----------|-------------|
| `type` | Ja | Eindeutige Kennung (wird als `customType` in Block-Instanzen verwendet) |
| `name` | Ja | Anzeigename in der Block-Palette |
| `icon` | Nein | Inline-SVG-String, Bild-URL oder base64-Daten-URI für das Palettensymbol |
| `description` | Nein | Tooltip oder Untertitel in der Palette |
| `fields` | Ja | Array von Felddefinitionen |
| `template` | Ja | Liquid-Template-String für das Rendering |
| `dataSource` | Nein | Konfiguration für das Abrufen externer Daten |

## Feldtypen

Jedes Feld definiert ein Formularelement im Einstellungsbereich des Blocks.

```ts
interface CustomBlockFieldBase {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}
```

Alle Feldtypen erweitern diese Basis. Der `key` wird als Variablenname in Ihrem Liquid-Template verwendet. Zusätzliche Eigenschaften hängen vom Feld-`type` ab:

| Eigenschaft | Gilt für | Beschreibung |
|----------|------------|-------------|
| `required` | Alle | Feld als erforderlich markieren |
| `placeholder` | Alle | Platzhaltertext für die Eingabe |
| `readOnly` | Alle | Benutzerbearbeitung verhindern (nützlich bei Datenquellen) |
| `default` | Alle | Standardwert bei Erstellung des Blocks |
| `min`, `max`, `step` | `number` | Numerische Einschränkungen |
| `options` | `select` | Array von `{ label, value }`-Auswahlmöglichkeiten |
| `fields` | `repeatable` | Unterfelddefinitionen |
| `minItems`, `maxItems` | `repeatable` | Grenzen für die Anzahl der Einträge |

### text

Einzeilige Texteingabe.

```ts
{
  key: 'title',
  label: 'Title',
  type: 'text',
  default: 'Untitled',
}
```

### textarea

Mehrzeilige Texteingabe für längere Inhalte.

```ts
{
  key: 'body',
  label: 'Body Text',
  type: 'textarea',
}
```

### image

Bild-URL-Eingabe mit Upload-/Browse-Integration.

```ts
{
  key: 'heroImage',
  label: 'Hero Image',
  type: 'image',
}
```

### color

Farbauswahl-Eingabe.

```ts
{
  key: 'accentColor',
  label: 'Accent Color',
  type: 'color',
  default: '#6366f1',
}
```

### number

Numerische Eingabe mit optionalen min-, max- und step-Einschränkungen.

```ts
{
  key: 'rating',
  label: 'Rating',
  type: 'number',
  min: 1,
  max: 5,
  step: 1,
}
```

### select

Dropdown mit vordefinierten Optionen.

```ts
{
  key: 'size',
  label: 'Size',
  type: 'select',
  options: [
    { label: 'Small', value: 'sm' },
    { label: 'Medium', value: 'md' },
    { label: 'Large', value: 'lg' },
  ],
  default: 'md',
}
```

### boolean

Umschalter.

```ts
{
  key: 'showBadge',
  label: 'Show Badge',
  type: 'boolean',
  default: true,
}
```

### repeatable

Eine wiederholbare Gruppe von Unterfeldern. Benutzer können Einträge innerhalb der konfigurierten Grenzen hinzufügen oder entfernen. Jeder Eintrag in `fields` folgt der gleichen Feldkonfiguration wie Felder auf oberster Ebene. Verschachtelte wiederholbare Felder werden nicht unterstützt.

```ts
{
  key: 'features',
  label: 'Features',
  type: 'repeatable',
  minItems: 1,
  maxItems: 5,
  fields: [
    { key: 'icon', label: 'Icon', type: 'image' },
    { key: 'text', label: 'Text', type: 'text' },
  ],
}
```

## Liquid-Templates

Die Eigenschaft `template` verwendet die [Liquid](https://liquidjs.com/)-Syntax. Feldwerte sind als Variablen auf oberster Ebene verfügbar, die ihrer `key`-Eigenschaft entsprechen. Hier sind die gängigsten Muster:

**Eine Variable ausgeben:**

```liquid
<p>{{ title }}</p>
```

**Bedingungen:**

```liquid
{% if showBadge %}
  <span>New</span>
{% endif %}

{% if price > 100 %}
  <p>Premium item</p>
{% elsif price > 50 %}
  <p>Mid-range item</p>
{% else %}
  <p>Budget item</p>
{% endif %}
```

**Schleifen** (für wiederholbare Felder):

```liquid
{% for feature in features %}
  <p>{{ feature.text }}</p>
{% endfor %}
```

**Standardwerte:**

```liquid
<p>{{ title | default: "Untitled" }}</p>
```

**String-Filter:**

```liquid
<p>{{ name | upcase }}</p>
<p>{{ description | truncate: 100 }}</p>
```

**Vergleiche:** `==`, `!=`, `>`, `<`, `>=`, `<=`, `and`, `or`, `contains`

Die vollständige Syntaxreferenz finden Sie in der [Liquid-Dokumentation](https://liquidjs.com/tags/overview.html).

## Datenquellen

Benutzerdefinierte Blöcke werden noch leistungsfähiger, wenn sie durch eine API-Datenquelle gestützt werden. Anstatt jedes Feld manuell auszufüllen, ruft eine Datenquelle externe Daten ab und füllt den Block automatisch. Wenn der Block zur Arbeitsfläche hinzugefügt wird (oder wenn der Benutzer eine Aktualisierung auslöst), wird der `onFetch`-Callback aufgerufen und die zurückgegebenen Daten füllen die Feldwerte des Blocks.

```ts
interface DataSourceConfig {
  label: string;
  onFetch: (context: DataSourceFetchContext) => Promise<Record<string, unknown> | null>;
}

interface DataSourceFetchContext {
  fieldValues: Record<string, unknown>;
  blockId: string;
}
```

Das `label` wird auf der Abrufschaltfläche in der Editor-Oberfläche angezeigt. Der `onFetch`-Callback erhält ein Kontextobjekt mit den aktuellen `fieldValues` und der `blockId` des Blocks. Geben Sie die abgerufenen Daten als Objekt zurück oder `null`, wenn der Abruf übersprungen werden soll.

```ts
{
  type: 'product-card',
  name: 'Product Card',
  fields: [
    { key: 'productId', label: 'Product ID', type: 'text', readOnly: true },
    { key: 'imageUrl', label: 'Image', type: 'image', readOnly: true },
    { key: 'name', label: 'Product Name', type: 'text' },
    { key: 'price', label: 'Price', type: 'text' },
  ],
  template: `
    <div style="text-align: center; font-family: sans-serif;">
      <img src="{{ imageUrl }}" alt="{{ name }}" style="max-width: 100%;" />
      <h2 style="margin: 16px 0 8px;">{{ name }}</h2>
      <p style="font-size: 24px; font-weight: bold;">{{ price }}</p>
    </div>
  `,
  dataSource: {
    label: 'Fetch Product',
    // Wird aufgerufen, wenn der Benutzer im Editor auf die Schaltfläche "Fetch Product" klickt.
    // Verwenden Sie dies, um einen benutzerdefinierten Picker zu öffnen, Ihre API aufzurufen oder Daten
    // aus einer beliebigen externen Quelle zu laden. Geben Sie ein Objekt mit Schlüsseln zurück, die
    // Ihren Felddefinitionen entsprechen, um den Block zu befüllen, oder null, um abzubrechen.
    onFetch: async ({ fieldValues }) => {
      const product = await showMyProductPicker();
      if (!product) return null;
      return {
        productId: product.id,
        imageUrl: product.image_url,
        name: product.name,
        price: `$${product.price.toFixed(2)}`,
      };
    },
  },
}
```

Das zurückgegebene Objekt wird in die `fieldValues` des Blocks eingefügt — die Schlüssel im zurückgegebenen Objekt sollten den `key`-Eigenschaften Ihrer Felddefinitionen entsprechen. Das Flag `dataSourceFetched` des Blocks wird dann auf `true` gesetzt.

::: warning Daten werden einmal abgerufen, nicht dynamisch
Der Datenabruf ist eine einmalige Operation, um die Felder aus einer externen Quelle zu befüllen. Einmal abgerufen, werden die Werte wie alle anderen Felddaten direkt im Template gespeichert. Die Datenquelle wird nicht dynamisch zum Rendering-Zeitpunkt aufgerufen — Benutzer können die befüllten Werte weiterhin manuell bearbeiten, es sei denn, das Feld ist als `readOnly` markiert.
:::

## Weitere Beispiele

### Event-Karte

Ein Einladungsblock für eine Veranstaltung mit einem Zeitplan, der mit wiederholbaren Feldern erstellt wurde:

```ts
const eventCard: CustomBlockDefinition = {
  type: 'event-card',
  name: 'Event Card',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  description: 'Event details with schedule and RSVP',
  fields: [
    { key: 'eventName', label: 'Event Name', type: 'text', default: 'Untitled Event' },
    { key: 'date', label: 'Date', type: 'text', default: 'January 1, 2026' },
    { key: 'venue', label: 'Venue', type: 'text' },
    { key: 'venueAddress', label: 'Venue Address', type: 'text' },
    { key: 'accentColor', label: 'Accent Color', type: 'color', default: '#4f46e5' },
    { key: 'rsvpUrl', label: 'RSVP URL', type: 'text' },
    {
      key: 'schedule',
      label: 'Schedule',
      type: 'repeatable',
      minItems: 1,
      maxItems: 10,
      fields: [
        { key: 'time', label: 'Time', type: 'text' },
        { key: 'session', label: 'Session', type: 'text' },
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

### Preisstufe

Ein Preisblock mit einer Funktionsliste und CTA-Schaltfläche:

```ts
const pricingTier: CustomBlockDefinition = {
  type: 'pricing-tier',
  name: 'Pricing Tier',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  description: 'Pricing card with features list',
  fields: [
    { key: 'planName', label: 'Plan Name', type: 'text', default: 'Pro' },
    { key: 'price', label: 'Price', type: 'text', default: '$29/mo' },
    { key: 'highlighted', label: 'Highlighted', type: 'boolean', default: false },
    { key: 'accentColor', label: 'Accent Color', type: 'color', default: '#4f46e5' },
    { key: 'ctaLabel', label: 'Button Label', type: 'text', default: 'Get Started' },
    { key: 'ctaUrl', label: 'Button URL', type: 'text' },
    {
      key: 'features',
      label: 'Features',
      type: 'repeatable',
      minItems: 1,
      maxItems: 8,
      fields: [
        { key: 'text', label: 'Feature', type: 'text' },
      ],
    },
  ],
  template: `
    <div style="font-family: sans-serif; border: {% if highlighted %}2px solid {{ accentColor }}{% else %}1px solid #e5e7eb{% endif %}; border-radius: 8px; padding: 24px; text-align: center;">
      <h3 style="margin: 0 0 4px; font-size: 18px;">{{ planName }}</h3>
      <p style="font-size: 32px; font-weight: bold; margin: 8px 0 16px;">{{ price }}</p>
      <table style="width: 100%; text-align: left; margin-bottom: 20px;">
        {% for feature in features %}
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #333;">&#10003; {{ feature.text }}</td>
        </tr>
        {% endfor %}
      </table>
      {% if ctaUrl %}
        <a href="{{ ctaUrl }}" style="display: inline-block; padding: 10px 24px; background: {{ accentColor }}; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px;">{{ ctaLabel }}</a>
      {% endif %}
    </div>
  `,
};
```

## Tipps zur E-Mail-Kompatibilität

Benutzerdefinierte Block-Templates werden als rohes HTML innerhalb der E-Mail gerendert. Beachten Sie diese Richtlinien:

- **Inline-Stile verwenden** -- E-Mail-Clients entfernen `<style>`-Blöcke. Platzieren Sie alle Stilangaben in `style`-Attributen.
- **Tabellen für Layouts verwenden** -- Flexbox und CSS Grid funktionieren in den meisten E-Mail-Clients nicht (insbesondere in Outlook). Verwenden Sie `<table>` für nebeneinander liegende Layouts.
- **Komplexes CSS vermeiden** -- Kein `position`, `float`, `display: flex`, `box-shadow` oder CSS-Animationen. Halten Sie sich an `padding`, `margin`, `border`, `background-color`, `color`, `font-size` und `text-align`.
- **In echten Clients testen** -- Outlook, Gmail, Apple Mail und Yahoo rendern HTML alle unterschiedlich. Verwenden Sie ein E-Mail-Testtool zur Vorschau in verschiedenen Clients.

## Fehlerbehandlung in Datenquellen

Der `onFetch`-Callback sollte Fehler elegant behandeln. Wenn der Abruf fehlschlägt, geben Sie ein leeres Objekt oder Teildaten zurück -- der Block wird mit den verfügbaren Feldwerten gerendert:

```ts
dataSource: {
  label: 'Fetch Product',
  onFetch: async ({ fieldValues }) => {
    try {
      const res = await fetch(`/api/products/${fieldValues.productId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null; // Block wird mit vorhandenen Feldwerten gerendert
    }
  },
},
```
