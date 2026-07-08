---
title: Merge-Tags
description: Dynamische Inhalte mit Merge-Tags in Templatical-E-Mail-Templates.
---

# Merge-Tags

Merge-Tags sind Tokens für dynamische Inhalte -- zum Beispiel den Namen eines Empfängers, einen Produktpreis oder eine Abmelde-URL. Sie erscheinen als hervorgehobene Tokens im Editor und werden unverändert im gerenderten MJML durchgereicht. Ihre E-Mail-Versandplattform ersetzt sie beim Versand durch echte Werte.

Templatical bietet integrierte Syntax-Presets für beliebte Plattformen und unterstützt benutzerdefinierte Syntaxdefinitionen.

## Konfiguration

Übergeben Sie ein `tags`-Array, um Ihre Merge-Tags beim Editor zu registrieren. Wenn der Editor einen Merge-Tag-Wert im Inhalt erkennt (z. B. <code v-pre>{{first_name}}</code>), ersetzt er ihn visuell durch das menschenlesbare `label` ("First Name") — was das Template viel einfacher lesbar und bearbeitbar macht. Der Rohwert bleibt in der Ausgabe erhalten.

![Daten-Tag im Editor angezeigt](/images/data-tag.png)

Beim Hovern über ein Tag wird der Rohwert hinter dem Label angezeigt.

Die Eigenschaft `syntax` ist optional und standardmäßig `'liquid'`.

```ts
import { init } from '@templatical/editor';

const editor = await init({
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

## MergeTag-Typ

Jedes Tag wird mit einem Label (in der Editor-Oberfläche angezeigt) und einem Wert (der vollständige Merge-Tag-String einschließlich Trennzeichen) definiert. Zwei optionale Felder — `group` und `description` — werden vom integrierten Picker zur Gruppierung und Erklärung verwendet:

```ts
interface MergeTag {
  label: string;
  value: string;
  group?: string;        // optionale Gruppierung im Picker
  description?: string;  // optionaler Hilfetext im Picker
}
```

Der `value` muss die Syntax-Trennzeichen enthalten. Zum Beispiel mit Liquid-Syntax:

<code v-pre>value: '{{first_name}}'</code>

Die Felder `group` und `description` sind ausschließlich für den Picker — sie erscheinen weder im Editor-Canvas, noch in der Autovervollständigung, noch in der gerenderten MJML-Ausgabe. Sie werden ignoriert, wenn Sie nur `onRequest` für die Tag-Auswahl verwenden.

## Syntax-Presets

Templatical enthält vier integrierte Syntax-Presets. Die Einstellung `syntax` teilt dem Editor mit, wie sowohl Daten-Tags als auch Logik-Tags im Inhalt erkannt und hervorgehoben werden sollen.

Jedes Preset definiert zwei Muster:
- **Daten-Tags** -- Variable Merge-Tags wie der Name oder die E-Mail eines Empfängers
- **Logik-Tags** -- Kontrollflussanweisungen wie Bedingungen und Schleifen

| Preset | Daten-Tag | Logik-Tag | Plattform |
|--------|----------|-----------|----------|
| `'liquid'` | <code v-pre>{{first_name}}</code> | <code v-pre>{% if vip %}</code> | Shopify, Jekyll, Django, Jinja2 |
| `'handlebars'` | <code v-pre>{{first_name}}</code> | <code v-pre>{{#if vip}}</code> | Handlebars.js, Mandrill |
| `'mailchimp'` | `*\|FIRST_NAME\|*` | `*\|IF:VIP\|*` | Mailchimp |
| `'ampscript'` | `%%=first_name=%%` | `%%[IF @vip]%%` | Salesforce Marketing Cloud |

```ts
mergeTags: {
  syntax: 'handlebars',
  tags: [
    { label: 'First Name', value: '{{first_name}}' },
  ],
}
```

## Logik-Tags

Neben Daten-Tags erkennt der Editor auch Logik-Tags -- bedingte Anweisungen, Schleifen und andere Kontrollflusssyntax, die von Ihrer E-Mail-Plattform verwendet wird. Diese werden automatisch mit dem `logic`-Regex-Muster aus dem ausgewählten Syntax-Preset erkannt.

Wenn ein Logik-Tag im Inhalt erkannt wird, extrahiert der Editor das Schlüsselwort (die erste Erfassungsgruppe aus der Logik-Regex) und zeigt es als Großbuchstaben-Abzeichen an -- zum Beispiel wird `{% if customer.vip %}` als **IF** gerendert und `{% endif %}` als **ENDIF**. Beim Hovern über das Abzeichen wird der vollständige Tag-Wert als Tooltip angezeigt. Benutzer können auf das Abzeichen klicken, um den Rohwert zu bearbeiten.

![Logik-Tag im Editor angezeigt](/images/logic-tags-selection-3.png)

Logik-Tags werden anders formatiert als Daten-Tags (umrahmtes Abzeichen mit Primärfarbe vs. gefüllter Hintergrund), sodass Template-Autoren auf einen Blick zwischen Daten-Tags und Kontrollfluss unterscheiden können.

Wie Daten-Tags werden Logik-Tags unverändert im gerenderten MJML durchgereicht — Ihre Versandplattform wertet sie zum Versandzeitpunkt aus.

::: tip Logik-Tags einfügen
Dieser Abschnitt behandelt die **Hervorhebung** — jedes Logik-Tag, das Sie tippen oder einfügen, wird automatisch erkannt. Um Benutzern das **Einfügen** von Logik-Tags ohne Tippen zu ermöglichen (eine eigene Schaltfläche **Logik**, Bedingungs-/Schleifenblöcke, die eine Auswahl umschließen), siehe den separaten Leitfaden [Logik-Tags](/de/guide/logic-tags). Logik wird unabhängig von Merge-Tags konfiguriert.
:::

Beispiele für Logik-Tags nach Preset:

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

## Benutzerdefinierte Syntax

Wenn die integrierten Presets nicht zu Ihrer Plattform passen, definieren Sie eine benutzerdefinierte Syntax mit zwei Regex-Mustern -- eines für Daten-Tags und eines für Logik-Tags:

```ts
interface SyntaxPreset {
  value: RegExp;  // matches data tags like ${user.name}
  logic: RegExp;  // matches logic tags like $[IF ...]
}
```

Beispiel für eine `${...}` / `$[...]`-Syntax:

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

Die `value`-Regex erkennt Daten-Tags. Die `logic`-Regex erkennt Kontrollflussanweisungen — die erste Erfassungsgruppe `(\w+)` extrahiert das Schlüsselwort (z. B. `IF`, `FOR`), das der Editor als Anzeigelabel verwendet.

## Autovervollständigung

Wenn Benutzer den Syntax-Öffner (z. B. <code v-pre>{{</code> für Liquid/Handlebars, `*|` für Mailchimp, `%%=` für AMPscript) eingeben, zeigt der Editor ein Popup mit übereinstimmenden Tags aus dem konfigurierten `tags`-Array an. Das Auswählen eines Eintrags (Mausklick, `Enter` oder `Tab`) fügt es als Merge-Tag ein — dieselbe Form, die der Toolbar-Picker erzeugt. `Esc` oder ein Klick außerhalb schließt das Popup.

Die Autovervollständigung funktioniert sowohl in Titel- und Absatz-Rich-Text-Blöcken **als auch** in jedem Eingabe- und Textbereichsfeld mit Merge-Tag-Unterstützung (Schaltflächen- und Bild-URLs, Bild-Alt-Text, Video- und Menü-Links, Template-Einstellungen und Textfelder benutzerdefinierter Blöcke). Popup, Filterung, Tastaturnavigation und Positionierung sind auf beiden Oberflächen identisch.

Die Filterung ist nicht groß-/kleinschreibungsabhängig und gleicht sowohl `label` als auch `value` ab. Die Liste ist auf 10 Ergebnisse begrenzt.

Die Autovervollständigung ist standardmäßig aktiviert. Sie wird **automatisch deaktiviert**, wenn:

- `tags` leer ist (keine Kandidaten zum Vorschlagen) oder
- `syntax` eine benutzerdefinierte Regex ist (der Editor kann aus beliebigen Regex-Mustern keine Trigger-Zeichenkette ableiten).

Um sie explizit zu deaktivieren, setzen Sie `autocomplete: false`:

```ts
const editor = await init({
  container: '#editor',
  mergeTags: {
    autocomplete: false,
    tags: [
      { label: 'Vorname', value: '{{first_name}}' },
    ],
  },
});
```

Die Schaltfläche **Merge-Tag** in der Symbolleiste funktioniert weiterhin unabhängig von der Autovervollständigungs-Einstellung.

## Integrierter Picker

Wenn Sie `mergeTags.tags` ohne `onRequest`-Callback konfigurieren, öffnet ein Klick auf die Schaltfläche **Merge-Tag** in der Rich-Text-Symbolleiste (oder neben einem Texteingabefeld in der Seitenleiste) ein integriertes modales Picker-Fenster. Der Picker listet jedes Tag aus `tags` auf, unterstützt Tastaturnavigation und bietet ein Suchfeld, das gegen `label`, `value` und `description` filtert.

![Integrierter Merge-Tag-Picker](/images/merge-tag-picker.png)

Der Picker zeigt:

- das **Label** (fett)
- den rohen **Wert** (Monospace, gedimmt)
- die optionale **Beschreibung** (klein, gedimmt), sofern gesetzt

Wenn mindestens ein Tag ein `group`-Feld trägt, rendert der Picker sektionierte Überschriften in Einfügereihenfolge (der Reihenfolge in Ihrem `tags`-Array). Tags ohne `group` landen unter einer lokalisierten „Sonstige"-Überschrift. Wenn kein Tag eine `group` hat, rendert der Picker eine flache Liste — keine Überschriften, kein „Sonstige"-Eimer.

Während Sie tippen, werden Gruppen aufgelöst und die Liste gefiltert. Die Filterung ist nicht groß-/kleinschreibungsabhängig und gleicht Teilzeichenketten in `label`, `value` oder `description` ab. Beim Löschen der Suche wird das gruppierte (oder flache) Layout wiederhergestellt.

Ein-Schritt-Einfügen: Ein Klick auf eine Zeile oder das Drücken von `Enter` auf der hervorgehobenen Zeile fügt das Tag ein und schließt das Modal. `Esc`, das Schließen-Symbol im Header (×) oder ein Klick auf den Hintergrund schließen den Picker ohne Einfügen.

```ts
const editor = await init({
  container: '#editor',
  mergeTags: {
    tags: [
      {
        label: 'Vorname',
        value: '{{first_name}}',
        group: 'Empfänger',
        description: 'Persönliche Anrede',
      },
      {
        label: 'Nachname',
        value: '{{last_name}}',
        group: 'Empfänger'
      },
      {
        label: 'Unternehmen',
        value: '{{company.name}}',
        group: 'Konto'
      },
      {
        label: 'Abmelde-URL',
        value: '{{unsubscribe_url}}',
        description: 'Gesetzlich vorgeschrieben (Anti-Spam)',
      },
    ],
  },
});
```

## Dynamisches Tag-Laden

Für große oder kontextabhängige Tag-Listen verwenden Sie den `onRequest`-Callback anstelle von (oder zusätzlich zu) einem statischen `tags`-Array. Der Editor ruft diese Funktion auf, wenn der Benutzer klickt, um ein Merge-Tag einzufügen. Verwenden Sie sie, um ein benutzerdefiniertes Picker-Modal zu öffnen, verfügbare Merge-Tags von Ihrer API abzurufen oder eine kontextbezogene Tag-Liste basierend auf dem aktuellen Benutzer zu erstellen. Geben Sie das ausgewählte `MergeTag` oder `null` zurück, um abzubrechen.

```ts
const editor = await init({
  container: '#editor',
  mergeTags: {
    onRequest: async () => {
      const tag = await showMyMergeTagPicker();
      return tag; // MergeTag or null if cancelled
    },
  },
});
```

::: tip Vorrangregel
Wenn Sie sowohl `tags` als auch `onRequest` angeben, hat `onRequest` Vorrang — die Schaltfläche **Merge-Tag** ruft immer Ihren Callback auf. Das statische `tags`-Array versorgt weiterhin die Autovervollständigungs-Vorschläge beim Tippen.
:::

## Merge-Tags in anderen Eingaben

Merge-Tags sind nicht auf Titel- und Absatzblöcke beschränkt. Der Editor erkennt und hebt Merge-Tags auch in anderen Blockeingaben hervor — Schaltflächentext, Schaltflächen-URL, Bild-URL, Bild-Alternativtext und Link-href-Werte. Das gleiche Label-Ersetzungs- und Tooltip-Verhalten gilt in diesen Feldern.

<img src="/images/button-merge-tag.png" alt="Merge-Tag in einer Schaltflächen-URL" style="max-width: 360px;" />
