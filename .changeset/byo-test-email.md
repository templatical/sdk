---
"@templatical/editor": patch
"@templatical/types": patch
"@templatical/core": patch
---

Add **bring-your-own test emails** — let users mail themselves the template they're editing, sent through your own infrastructure.

Previously Cloud-only. Now `init()` accepts a `testEmail` provider and one method is the whole integration:

```ts
await init({
  container: '#editor',
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

The editor owns the trigger, the dialog, recipient validation and the sending / success / error states; you own delivery. Omit `testEmail` and the feature is entirely absent — no button, and none of its UI code is downloaded.

**Restricting recipients.** `allowedRecipients` drives the dialog: omitted gives a free-text field, one entry a read-only field, several a picker, and an empty array means nobody may be sent to (so no button renders at all). It restricts the *picker* only — the array lives in the user's browser, so **validate the recipient on your server**.

**Optional MJML.** Set `includeMjml` and the payload carries the rendered MJML, saving you a `renderToMjml()` call. It needs the optional `@templatical/renderer` peer; without it the send still happens with JSON only and one warning is logged, so always guard for `payload.mjml` being absent.

**A live preview.** The dialog renders the template chrome-free at email width with a desktop / mobile switch, so a user can confirm what they're sending without leaving it. It honours display conditions — a block a condition excludes is omitted, so the preview never shows content the recipient won't get — and responsive blocks follow the switch rather than always rendering desktop. Merge tags render unresolved, and the dialog says so: it answers "is this the right template?", not "is this exactly what lands in the inbox?".

`SavedBlockPreviewCanvas` is renamed **`BlockPreviewCanvas`** now that saved blocks and test email both use it, and gained a `viewport` prop plus condition filtering. Both default to the previous behaviour, so saved-block previews are unchanged. Internal component, not part of the public API.

**Preview widths now come from one place.** A new `getEmailFrameWidth(settings, viewport)` helper backs the canvas, the preview canvas and the save dialog's scaled rows. Previously the previews hardcoded 600px while the canvas used the template's own `settings.width`, so a template with a custom body width previewed at the wrong size — and the save dialog's `transform: scale()` divided by that same hardcoded number, so the two had to agree by coincidence rather than by construction.

**Upgrading to Cloud is a deletion.** `initCloud()` takes the same `testEmail` key with the same type: omit it and Templatical Cloud sends (using its own deliverability infrastructure and a server-signed recipient list), or leave it exactly as it is to keep your own sender — useful when mail must leave your own infrastructure for compliance reasons. Your users see no difference; the button, dialog and flow are the same components in both editors.

New exports: `TestEmailProvider` and `TestEmailPayload` from `@templatical/types` and `@templatical/editor`, plus `createCloudTestEmailProvider` from `@templatical/core/cloud`.

**Cloud internals changed.** `useTestEmail` is now configuration only — `isEnabled`, `allowedEmails` and a new `getSignature` — and its `sendTestEmail` / `isSending` / `error` members are gone, replaced by `createCloudTestEmailProvider` driving the shared editor seam. This keeps exactly one send path behind one UI. No runtime impact for `initCloud()` consumers, whose configuration is unchanged; only direct callers of the composable are affected, and Templatical Cloud has not shipped.

Also fixed while migrating: an empty allowed-recipient list previously rendered a dialog with an empty picker and a permanently disabled Send button, instead of hiding the feature.
