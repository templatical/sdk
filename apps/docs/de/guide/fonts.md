---
title: Benutzerdefinierte Schriftarten
description: Konfigurieren Sie benutzerdefinierte Schriftarten für die Schriftauswahl des E-Mail-Editors.
---

# Benutzerdefinierte Schriftarten

Standardmäßig enthält der Editor eine Reihe gängiger websicherer Schriftarten (Arial, Georgia, Verdana usw.) in der Schriftauswahl. Sie können diese Liste mit Ihren eigenen Schriftarten erweitern — beispielsweise durch das Laden benutzerdefinierter Schriftarten von Google Fonts oder Ihrem eigenen CDN. Wenn eine benutzerdefinierte Schriftart verwendet wird, wird sie automatisch als `<mj-font>`-Deklaration in der gerenderten MJML-Ausgabe aufgenommen.

Konfigurieren Sie, welche Schriftarten verfügbar sind, über die Option `fonts`:

```ts
import type { FontsConfig } from '@templatical/types';

const fonts: FontsConfig = {
  defaultFont: 'Inter',
  defaultFallback: 'Arial, sans-serif',
  customFonts: [
    {
      name: 'Inter',
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
      fallback: 'Helvetica, Arial, sans-serif',
    },
    {
      name: 'Merriweather',
      url: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap',
      fallback: 'Georgia, serif',
    },
  ],
};

const editor = await init({
  container: '#editor',
  fonts,
});
```

## FontsConfig

| Eigenschaft | Typ | Beschreibung |
|---|---|---|
| `defaultFont` | `string` | Schriftartname, der in neuen Templates standardmäßig ausgewählt ist |
| `defaultFallback` | `string` | Fallback-Stack, der verwendet wird, wenn eine benutzerdefinierte Schriftart nicht verfügbar ist |
| `customFonts` | `CustomFont[]` | Liste benutzerdefinierter Schriftarten, die registriert werden sollen |

## CustomFont

| Eigenschaft | Typ | Beschreibung |
|---|---|---|
| `name` | `string` | Anzeigename in der Schriftauswahl |
| `url` | `string` | URL zum Schriftart-CSS (z. B. Google-Fonts-Link) |
| `fallback` | `string` | Optionaler Fallback-Font-Stack für diese Schriftart |

Benutzerdefinierte Schriftarten werden automatisch als `<mj-font>`-Deklarationen in der gerenderten MJML-Ausgabe eingefügt.

## Best Practices

- **Immer einen Fallback festlegen** — Die meisten E-Mail-Clients unterstützen keine benutzerdefinierten Schriftarten. Der Fallback-Stack stellt sicher, dass Ihre E-Mail auch dann gut aussieht, wenn die benutzerdefinierte Schriftart nicht geladen wird.
- **Schriftgewichte begrenzen** — Fügen Sie nur die Gewichte ein, die Sie tatsächlich benötigen (z. B. `wght@400;700`). Zusätzliche Gewichte erhöhen die Ladezeit für die Empfänger.
- **Bei 1-2 benutzerdefinierten Schriftarten bleiben** — Zu viele Schriftarten verlangsamen das Rendering und machen das Design inkonsistent. Eine für Überschriften und eine für Fließtext ist ein gängiges Muster.
- **Über Clients hinweg testen** — Gmail, Outlook und Apple Mail behandeln Schriftarten alle unterschiedlich. Gmail unterstützt Google Fonts in den meisten Fällen, aber Outlook fällt auf Systemschriftarten zurück.
