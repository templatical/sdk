---
title: Test-E-Mails
description: Senden Sie Test-E-Mails direkt aus dem Editor.
---

# Test-E-Mails

Senden Sie Test-E-Mails direkt aus dem Editor, um das Rendering in verschiedenen E-Mail-Clients vor dem Go-Live zu überprüfen.

## So funktioniert es

1. Der Nutzer klickt in der Editor-Toolbar auf „Test-E-Mail senden"
2. Er gibt eine Empfänger-E-Mail-Adresse ein
3. Das Template wird gespeichert und serverseitig zu HTML gerendert
4. Eine Test-E-Mail wird an den Empfänger zugestellt

Die Liste der erlaubten Empfänger-E-Mails wird durch Ihre Plan-Konfiguration gesteuert und in der Antwort des Auth-Tokens zurückgegeben.

## Before-Send-Hook

Sie können das HTML vor dem Versand als Test-E-Mail transformieren. Das ist nützlich, um Tracking-Pixel einzufügen, Preheader-Text hinzuzufügen oder Merge-Tags durch Testdaten zu ersetzen:

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  onBeforeTestEmail: async (html) => {
    // Merge-Tags durch Testwerte ersetzen
    return html
      .replace('{{first_name}}', 'Jane')
      .replace('{{company}}', 'Acme Corp');
  },
});
```

## Composable

```js
import { useTestEmail } from '@templatical/core/cloud';

const {
  isEnabled,        // ComputedRef<boolean> — Plan erlaubt Test-E-Mails
  allowedEmails,    // ComputedRef<string[]> — zugelassene Empfänger
  isSending,        // Ref<boolean>
  error,            // Ref<string | null>

  sendTestEmail,    // (recipient) => Promise<void>
} = useTestEmail({
  authManager,
  getTemplateId: () => templateId,
  save: () => editor.save(),
  exportHtml: (templateId) => exportFn(templateId),
  onBeforeTestEmail: (html) => html,
  onError: (error) => { /* Fehler behandeln */ },
});
```
