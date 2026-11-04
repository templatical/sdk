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
  data?: unknown;
}
```

| Eigenschaft | Erforderlich | Beschreibung |
|----------|----------|-------------|
| `label` | Ja | Anzeigename in der Editor-Oberfläche |
| `before` | Ja | Markup, das vor der Blockausgabe eingefügt wird |
| `after` | Ja | Markup, das nach der Blockausgabe eingefügt wird |
| `group` | Nein | Gruppenname zur Organisation von Bedingungen im Dropdown |
| `description` | Nein | Erklärender Text, der unter dem Label angezeigt wird |
| `data` | Nein | Opaker Zustand des Hosts. Der Editor speichert ihn und gibt ihn als `current.data` zurück, wenn der Dialog erneut geöffnet wird. Der Wert muss `JSON.stringify` überstehen (der Inhalt wird mit `safeClone` kopiert). Der Editor liest ihn nicht. |

## DisplayConditionsConfig

```ts
interface DisplayConditionRequestContext {
  current?: DisplayCondition;
  block: Block;
}

interface DisplayConditionsConfig {
  conditions?: DisplayCondition[];
  allowCustom?: boolean;
  onRequest?: (
    context: DisplayConditionRequestContext,
  ) => Promise<DisplayCondition | null>;
}
```

Wenn `allowCustom` auf `true` gesetzt ist, können Benutzer ihre eigenen `before`- und `after`-Zeichenketten direkt im Editor schreiben, anstatt aus der vordefinierten Liste zu wählen. Standardwert ist `false`. `conditions` kann entfallen.

## Eigener Bedingungsdialog

`displayConditions.onRequest` ersetzt die eingebaute Bedingungsliste. In den Blockeinstellungen erscheint **Bedingung hinzufügen**, und bei gesetzter Bedingung **Bearbeiten** sowie **Bedingung entfernen**. Der Callback erhält `{ block }`, wenn der Block keine Bedingung hat, und `{ current, block }`, wenn eine gesetzt ist. Beide Werte sind Kopien. Geben Sie eine `DisplayCondition` zurück, oder `null`, damit der Block unverändert bleibt.

`current.data` ist der opake Zustand der Bedingung, damit Ihr Dialog wieder ausgefüllt öffnet. Ein aufgelöster Wert braucht die Zeichenketten `label`, `before` und `after`. Leere Zeichenketten sind gültig. `description`, `group` und `data` bleiben erhalten. Ist `onRequest` gesetzt, werden `conditions` und `allowCustom` ignoriert.

```ts
import { init } from '@templatical/editor';

function openConditionBuilder({
  data,
}: {
  blockId: string;
  data?: unknown;
}) {
  const saved =
    data !== null && typeof data === 'object'
      ? (data as { field?: string; operator?: string; value?: string })
      : undefined;
  const field = saved?.field ?? 'customer.vip';
  const operator = saved?.operator ?? '==';
  const value = saved?.value ?? 'true';
  return Promise.resolve({
    label: `${field} ${operator} ${value}`,
    before: `{% if ${field} ${operator} ${value} %}`,
    after: '{% endif %}',
    data: { field, operator, value },
  });
}

const editor = await init({
  container: '#editor',
  displayConditions: {
    onRequest: async ({ block, current }) => {
      const chosen = await openConditionBuilder({
        blockId: block.id,
        data: current?.data,
      });
      if (!chosen) return null;
      return {
        label: chosen.label,
        before: chosen.before,
        after: chosen.after,
        data: chosen.data,
      };
    },
  },
});
```

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

## Ausgabe

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

### Bedingungen echt auswerten

Das Filtersymbol **simuliert** eine falsche Bedingung — es ist ein manuelles Was-wäre-wenn, und nichts prüft die Bedingung gegen Daten. Damit Bedingungen tatsächlich ausgewertet werden, verdrahten Sie den Hook [`resolvePreview`](/de/guide/preview-rendering): Ihr Backend erhält die Vorlage und kann Blöcke weglassen, deren Bedingung für einen bestimmten Empfänger nicht zutrifft — die Vorschau zeigt dann die echte Variante statt einer von Hand umgeschalteten.

Solange ein Resolver die Vorschau liefert, treten das Filtersymbol und die Wiederherstellungsschaltfläche zurück — der Resolver hat jede Bedingung bereits gegen echte Daten geprüft, sodass ein von Hand ausgeblendeter Block genau die Antwort überstimmen würde, die Sie angefordert haben. Ihre ausgeblendeten Blöcke sind zurück, sobald Sie die Vorschau verlassen.

::: tip Jede Variante prüfen
Zwei Wege, die unterschiedliche Fragen beantworten:

- **[Vorschau-Rendering](/de/guide/preview-rendering)** — verdrahten Sie `resolvePreview`, und jede Variante wird im Editor gerendert, ohne etwas zu versenden. Die schnellste Schleife beim Erstellen und der einzige Weg, eine Variante für einen Empfänger zu sehen, dem Sie nicht schreiben können.
- **[Test-E-Mails](/de/backend/test-email)** — senden Sie an verschiedene Empfängerprofile und bestätigen Sie, dass jede Variante in einem echten Postfach ankommt. Langsamer, prüft aber die Auswertung Ihrer Plattform und den E-Mail-Client selbst, was keine Vorschau leisten kann.
  :::

## Im Playground

Das Setup **Display conditions** übergibt `displayConditions`, sodass sich jeder Block pro Empfänger ein- oder ausblenden lässt.

[Im Playground öffnen](https://play.templatical.com/scenes/display-conditions)

## Prüfen

Mounten Sie den Editor mit `displayConditions.onRequest` und öffnen Sie die Einstellungen eines Blocks. Der Abschnitt zeigt die Schaltfläche **Bedingung hinzufügen**. Lösen Sie den Callback mit einer Bedingung auf, die `data` enthält, und lesen Sie den gespeicherten Block aus `getContent()`:

```ts
const stored = editor.getContent().blocks.find((block) => block.id === 'title');
if (stored?.displayCondition?.label !== 'VIP') {
  throw new Error('expected label VIP');
}
const data = stored.displayCondition.data as { tier: string };
if (data.tier !== 'vip') {
  throw new Error('expected displayCondition.data.tier vip');
}
```
