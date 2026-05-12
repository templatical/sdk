---
title: Anzeigebedingungen
description: Bedingte Blocksichtbarkeit mit Anzeigebedingungen in Templatical-E-Mail-Templates.
---

# Anzeigebedingungen

Anzeigebedingungen erlauben es Benutzern, die Sichtbarkeit von Blöcken basierend auf Bedingungen zu ändern. Wenn einem Block eine Bedingung zugewiesen ist, umschließt der Renderer dessen Ausgabe mit der von Ihnen definierten Bedingungssyntax (z. B. Liquid `{% if %}` / `{% endif %}`). Die Bedingungen werden unverändert durchgereicht — Ihre Versandplattform oder Template-Engine sollte sie vor dem Versand rendern.

## Konfiguration

Definieren Sie verfügbare Bedingungen über die Editor-Konfiguration:

```ts
import { init } from '@templatical/editor';

const editor = await init({
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

## DisplayCondition-Typ

```ts
interface DisplayCondition {
  label: string;
  before: string;
  after: string;
  group?: string;
  description?: string;
}
```

| Eigenschaft | Erforderlich | Beschreibung |
|----------|----------|-------------|
| `label` | Ja | Anzeigename in der Editor-Oberfläche |
| `before` | Ja | Markup, das vor der Blockausgabe eingefügt wird |
| `after` | Ja | Markup, das nach der Blockausgabe eingefügt wird |
| `group` | Nein | Gruppenname zur Organisation von Bedingungen im Dropdown |
| `description` | Nein | Erklärender Text, der unter dem Label angezeigt wird |

## DisplayConditionsConfig

```ts
interface DisplayConditionsConfig {
  conditions: DisplayCondition[];
  allowCustom?: boolean;
}
```

Wenn `allowCustom` auf `true` gesetzt ist, können Benutzer ihre eigenen `before`- und `after`-Zeichenketten direkt im Editor schreiben, anstatt aus der vordefinierten Liste zu wählen. Standardwert ist `false`.

## Bedingungen gruppieren

Verwenden Sie die Eigenschaft `group`, um Bedingungen in logische Abschnitte zu organisieren. Gruppen erscheinen als beschriftete Abschnitte im Dropdown des Bedingungs-Pickers.

```ts
displayConditions: {
  allowCustom: true,
  conditions: [
    {
      label: 'VIP Partners',
      before: '{% if customer.vip %}',
      after: '{% endif %}',
      group: 'Audience',
    },
    {
      label: 'Free Users',
      before: '{% if customer.plan == "free" %}',
      after: '{% endif %}',
      group: 'Audience',
    },
    {
      label: 'Enterprise',
      before: '{% if customer.plan == "enterprise" %}',
      after: '{% endif %}',
      group: 'Audience',
    },
    {
      label: 'Beta Testers',
      before: '{% if customer.beta %}',
      after: '{% endif %}',
      group: 'Audience',
    },
    {
      label: 'Early Bird',
      before: '{% if registration.early_bird %}',
      after: '{% endif %}',
      group: 'Registration',
    },
    {
      label: 'Speakers',
      before: '{% if role == "speaker" %}',
      after: '{% endif %}',
      group: 'Role',
    },
  ],
}
```

<img src="/images/display-condition-grouping.png" alt="Gruppierte Anzeigebedingungen im Dropdown" style="max-width: 360px;" />

Die Felder `before` und `after` akzeptieren jede Zeichenkette, sodass Sie jede Template-Syntax verwenden können, die Ihre Plattform unterstützt — Liquid, Handlebars, AMPscript, Jinja2 oder alles andere.

## Wie sich Bedingungen auf die Ausgabe auswirken

Wenn einem Block eine Anzeigebedingung zugewiesen ist, umschließt der Renderer die HTML-Ausgabe des Blocks mit den `before`- und `after`-Zeichenketten:

```html
{% if customer.vip == true %}
<tr>
  <td>
    <!-- block content here -->
  </td>
</tr>
{% endif %}
```

Der Editor und der Renderer behandeln die `before`- und `after`-Zeichenketten als undurchsichtig — sie werden genau wie definiert eingefügt.

## Anwenden von Bedingungen im Editor

Benutzer wählen eine Anzeigebedingung aus dem Einstellungsbereich des Blocks aus. Jeder Block kann höchstens eine Anzeigebedingung haben. Auf der Editor-Arbeitsfläche zeigen Blöcke mit Bedingungen ein Filtersymbol, sodass auf einen Blick erkennbar ist, welcher Inhalt bedingt ist.

<img src="/images/display-condition-icon.png" alt="Anzeigebedingungssymbol auf einem Block" style="max-width: 360px;" />

Das Klicken auf das Filtersymbol blendet den Block aus und simuliert eine falsche Bedingung. Dies ermöglicht es Benutzern, eine Vorschau anzuzeigen, wie das Template aussieht, wenn bestimmte bedingte Blöcke nicht sichtbar sind. Wenn ein Block auf diese Weise ausgeblendet ist, erscheint eine Wiederherstellungsschaltfläche im Editor, um alle ausgeblendeten Blöcke wiederherzustellen.

<img src="/images/display-condition-restore.png" alt="Schaltfläche zum Wiederherstellen ausgeblendeter Bedingungen" style="max-width: 360px;" />

::: tip Bedingte Inhalte testen
Um zu überprüfen, ob Bedingungen korrekt funktionieren, senden Sie Test-E-Mails mit verschiedenen Empfängerprofilen über Ihre E-Mail-Plattform und bestätigen Sie, dass jede Variante wie erwartet gerendert wird.
:::
