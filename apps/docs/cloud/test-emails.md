---
title: Test Emails
description: Send test emails directly from the editor.
---

# Test Emails

Send test emails directly from the editor to verify rendering across email clients before going live.

## How It Works

1. User clicks "Send Test Email" in the editor toolbar
2. Enters a recipient email address
3. The template is saved and rendered to HTML server-side
4. A test email is delivered to the recipient

The list of allowed recipient emails is controlled by your plan configuration and returned in the auth token response.

## Before Send Hook

You can transform the HTML before it's sent as a test email. This is useful for injecting tracking pixels, adding preheader text, or replacing merge tags with test data:

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  onBeforeTestEmail: async (html) => {
    // Replace merge tags with test values
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
  isEnabled,        // ComputedRef<boolean> — plan allows test emails
  allowedEmails,    // ComputedRef<string[]> — whitelisted recipients
  isSending,        // Ref<boolean>
  error,            // Ref<string | null>

  sendTestEmail,    // (recipient) => Promise<void>
} = useTestEmail({
  authManager,
  getTemplateId: () => templateId,
  save: () => editor.save(),
  exportHtml: (templateId) => exportFn(templateId),
  onBeforeTestEmail: (html) => html,
  onError: (error) => { /* handle error */ },
});
```
