---
title: Test Emails
description: How Templatical Cloud sends test emails, and how to send them from your own infrastructure instead.
---

# Test Emails

Send test emails directly from the editor to verify rendering in a real inbox before going live.

Test email is a **shared feature**: the trigger, the dialog, recipient validation and every sending state are the same components in the OSS and Cloud editors. Only the sender differs. The [Test Emails guide](/backend/test-email) covers the feature itself — this page is what Cloud adds, and how to override it.

## How Cloud sends

1. The user clicks **Test** in the editor header.
2. They pick a recipient from the project's allowed list.
3. The template is saved, then rendered to HTML **server-side**.
4. Cloud delivers the email.

Three conditions gate the button, and none implies another — all must hold for it to appear:

- the `test_email` plan feature;
- a test-email config on the project's auth token (the allowed recipients plus their signature);
- a **saved** template, because Cloud renders from the stored copy.

### The allowed-recipient list is signed

The list arrives with the auth token and is posted back with a signature the backend verifies. That matters because the SDK runs in the user's browser: without a server-signed list, the endpoint would be an open relay.

This is the one place Cloud and a BYO sender genuinely differ. A provider you supply carries an `allowedRecipients` array that is **unsigned** — it restricts the picker, and your own backend has to enforce it. See [Restricting recipients](/backend/test-email#restricting-recipients).

## Before-send hook

Transform the rendered HTML just before Cloud sends it — useful for injecting a preheader, or filling merge tags with test data:

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  onBeforeTestEmail: async (html) => {
    return html
      .replace('{{first_name}}', 'Jane')
      .replace('{{company}}', 'Acme Corp');
  },
});
```

Cloud-only, and deliberately so: it exists because *Cloud* renders the HTML, so you need a seam into it. If you supply your own sender (below), that provider **is** the seam and this hook does not apply to it.

## Sending it yourself instead

`initCloud()` accepts the same `testEmail` key as `init()`, so you can keep Cloud for everything else and still send mail from your own infrastructure — usually for compliance or data-residency reasons:

```js
await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  testEmail: {
    send: async ({ recipient, content }) => {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, content }),
      });
      if (!res.ok) throw new Error('Could not send the test email');
    },
  },
});
```

Omit the key and Cloud sends. Provide it and yours does — and it is **not** plan-gated, because the `test_email` feature licenses Cloud's sending, not the editor's UI. Your users see no difference either way.

Because the key and its type are identical on both entry points, moving an OSS integration to Cloud means deleting this key or leaving it untouched — never rewriting it.

## Composables

Cloud's test-email configuration and its sender are separate, so one send path serves both editors:

```js
import { useTestEmail, createCloudTestEmailProvider } from '@templatical/core/cloud';

// Configuration: what this project is allowed to do.
const {
  isEnabled,      // ComputedRef<boolean> — the token carries a test-email config
  allowedEmails,  // ComputedRef<string[]> — permitted recipients
  getSignature,   // () => string | null — lets the backend verify that list
} = useTestEmail({ authManager, isAuthReady });

// Sending: a `TestEmailProvider`, interchangeable with your own.
const provider = createCloudTestEmailProvider({
  authManager,
  getTemplateId: () => templateId,
  save: () => editor.save(),
  exportHtml: (id) => exportFn(id),
  allowedEmails,
  getSignature,
  onBeforeTestEmail: (html) => html,
});
```

::: warning `allowedEmails` fills asynchronously
It arrives with the auth token, so it is empty until auth resolves. **Read it reactively** — a value snapshotted at setup stays empty for the whole session, and because an empty allowlist means "nobody may be sent to", the button would never appear.
:::
