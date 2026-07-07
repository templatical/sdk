---
title: Logik-Tags
description: Control-Flow-Logik-Tags in Templatical-E-Mail-Vorlagen einfügen und hervorheben.
---

# Logik-Tags

Logik-Tags sind die Control-Flow-Tokens Ihrer Vorlagensyntax — Bedingungen und Schleifen wie <code v-pre>{% if vip %}</code> … <code v-pre>{% endif %}</code> oder <code v-pre>{% for item in items %}</code> … <code v-pre>{% endfor %}</code>. Sie sind **getrennt von [Merge-Tags](/de/guide/merge-tags)**: Merge-Tags sind Daten-Platzhalter, die man aus einer Liste auswählt, Logik-Tags sind Struktur, die Ihre Versandplattform zum Sendezeitpunkt auswertet.

Es gibt zwei unabhängige Teile:

- **Hervorhebung** — jedes Logik-Tag, das Sie in einen Titel- oder Absatzblock **tippen oder einfügen**, wird anhand des `logic`-Musters des Syntax-Presets erkannt und als großgeschriebenes Schlüsselwort-Badge dargestellt (**IF**, **ENDIF**, **FOR**…). Das ist immer aktiv und benötigt keine Konfiguration. Siehe [Merge-Tags → Logik-Tags](/de/guide/merge-tags#logik-tags) für Details zur Erkennung und zu den Syntax-Presets.
- **Einfügen** — konfigurieren Sie eine `logicTags`-Option, um Autoren eine eigene Schaltfläche **Logik** zu geben, damit sie Control-Flow einfügen können, ohne die Syntax von Hand zu schreiben. Darum geht es auf dieser Seite.

## Konfiguration

Übergeben Sie eine `logicTags`-Option mit `tags` (einzelne Tokens) und/oder `pairs` (Öffnen/Schließen-Konstrukte). Beide sind optional.

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  logicTags: {
    tags: [
      { label: 'Sonst', value: '{% else %}', group: 'Bedingungen' },
    ],
    pairs: [
      {
        label: 'Wenn VIP',
        before: '{% if customer.vip %}',
        after: '{% endif %}',
        group: 'Bedingungen',
        description: 'Zeigt den umschlossenen Inhalt nur VIP-Kunden',
      },
      {
        label: 'Positionen durchlaufen',
        before: '{% for item in order.items %}',
        after: '{% endfor %}',
        group: 'Schleifen',
      },
    ],
  },
});
```

Logik-Tags verwenden dasselbe `mergeTags.syntax`-Preset (das Preset definiert sowohl das Daten- als auch das Logik-Muster), Sie konfigurieren die Syntax also nicht doppelt.

## Typen

```ts
interface LogicTag {
  label: string;
  value: string;        // ein einzelnes Logik-Token, z. B. '{% else %}'
  group?: string;       // optionale Abschnittsbezeichnung im Picker
  description?: string; // optionaler Hilfetext im Picker
}

interface LogicPair {
  label: string;
  before: string;       // öffnendes Tag, z. B. '{% if vip %}'
  after: string;        // schließendes Tag, z. B. '{% endif %}'
  group?: string;       // optionale Abschnittsbezeichnung im Picker
  description?: string;
}

interface LogicTagsConfig {
  tags?: LogicTag[];
  pairs?: LogicPair[];
  onRequest?: () => Promise<LogicTag | LogicPair | null>;
}
```

`value` / `before` / `after` müssen die Syntax-Trennzeichen enthalten. `group` und `description` sind nur für den Picker — sie erscheinen weder auf dem Canvas noch im gerenderten MJML.

## Der Picker

Wenn `logicTags` konfiguriert ist, erscheint eine Schaltfläche **Logik** in der Titel- und Absatz-Symbolleiste (neben **Merge-Tag**). Ein Klick öffnet einen Picker:

![Die Schaltflächen „Logik" und „Merge-Tag" in der Rich-Text-Symbolleiste](/images/logic-tags-picker-rich-text.png)

- `tags` und `pairs` teilen sich eine Liste, gegliedert nach `group` — ein Abschnitt listet zuerst die Öffnen/Schließen-Paare, dann die einzelnen Tags, sodass eine von beiden genutzte Gruppe (z. B. „Bedingungen") nur einmal erscheint.
- Ein einzelnes Tag zeigt ein einzelnes Schlüsselwort-Badge (z. B. **ELSE**), ein Paar zeigt beide (z. B. **IF … ENDIF**) und signalisiert damit, dass es die Auswahl umschließt.

Tippen filtert; mit `↑`/`↓` und `Enter` einfügen; `Esc` oder ein Klick auf den Hintergrund schließt.

![Der Logik-Picker — die Gruppe „Bedingungen" listet zuerst das Paar „Wenn VIP", dann das Tag „Sonst", jeweils mit Schlüsselwort-Badges](/images/logic-tags-selection-2.png)

## Einfügeverhalten

- Ein **einzelnes Tag** wird an der Cursorposition eingefügt.
- Ein **Paar** umschließt die aktuelle Auswahl — `[open]{Auswahl}[close]` — sodass Autoren einen Absatz auswählen und ihn in einem Schritt bedingt machen können.
- Ein **Paar ohne Auswahl** setzt beide Pills nebeneinander, mit dem Cursor dazwischen, sodass Sie den umschlossenen Inhalt eintippen können.

Wählen Sie zum Beispiel den Text aus, den Sie bedingt machen möchten:

![Ein Absatzblock mit dem markierten Text „You your VIP ticket now!"](/images/logic-tags-selection-1.png)

Wählen Sie ein Paar (hier **Wenn VIP**), und es umschließt die Auswahl — der Text steht nun zwischen dem öffnenden und dem schließenden Pill:

![Derselbe Absatz, dessen Auswahl nun von IF … ENDIF-Logik-Pills umschlossen ist](/images/logic-tags-selection-3.png)

Beide Seiten werden als dieselben formatierten Logik-Badges wie getippte Logik dargestellt und unverändert im gerenderten MJML durchgereicht. Der Editor erzwingt keine Balancierung, bieten Sie das passende Öffnen/Schließen daher als ein einzelnes `pair` an (empfohlen) statt als zwei separate `tags`.

## Ihr eigener Picker

Setzen Sie `logicTags.onRequest`, um den integrierten Picker durch Ihre eigene UI zu ersetzen — ein eigenes Modal, einen Bedingungs-Builder oder per API geladene Logik-Konstrukte (und so binden Konsumenten mit einer nicht-voreingestellten Syntax ihre eigene Erfahrung ein). Die Funktion wird aufgerufen, wenn der Benutzer auf **Logik** klickt; geben Sie das gewählte `LogicTag` / `LogicPair` zurück oder `null` zum Abbrechen. Die Reihenfolge entspricht den Merge-Tags: **`onRequest` → integrierter Picker → nichts**.

```ts
const editor = await init({
  container: '#editor',
  logicTags: {
    onRequest: async () => {
      const choice = await showMyLogicPicker();
      return choice; // LogicTag | LogicPair | null
    },
  },
});
```

## Über Rich-Text hinaus: Textfelder

Logik ist nicht auf Titel-/Absatzblöcke beschränkt. Eingabefelder und Textareas, die bereits Merge-Tags unterstützen — Button-Text, Button-/Bild-URLs, Alt-Text — erhalten ebenfalls die **Logik**-Schaltfläche und heben Logik-Tags in ihrem Wert hervor.

![Das Textfeld eines Button-Blocks mit den Schaltflächen „Merge-Tag" und „Logik" darunter](/images/logic-tags-picker-input.png)

Machen Sie z. B. den Button-Text bedingt:

<code v-pre>{% if guest.status == 'vip' %}VIP-Zugang{% else %}Registrieren{% endif %}</code>

In einem Textfeld wird ein Tag an der Cursorposition eingefügt und ein Paar umschließt den ausgewählten Text (als Zeichenkette) — genau wie im Rich-Text.
