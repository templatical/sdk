import type { TestEmailProvider } from "@templatical/types";

/**
 * Fake test-email sender, on for every template.
 *
 * Nothing is delivered — the playground has no backend and shouldn't acquire
 * one. The provider waits, logs exactly what a real `send` would have received,
 * and resolves. That exercises the full UI path: the sending spinner, the success
 * confirmation and the auto-close.
 *
 * Unlike `savedBlocksProviderFor`, this is a single module-level provider rather
 * than one per template: a sender depends on the recipient and the current
 * content, never on which template is open.
 *
 * Everything is fixed rather than flag-driven, so what a visitor sees is what a
 * sensible integration looks like:
 *
 *  - **Two allowed recipients**, which is the realistic shape (send only to
 *    verified addresses) and renders the picker rather than a free-text field.
 *    `example.com` is IANA-reserved for documentation, so nothing here could
 *    resolve to a real mailbox even if the send weren't faked.
 *  - **`includeMjml` on**, so the logged payload shows the rendered MJML a real
 *    backend would hand to its mail service.
 *  - **Always succeeds.** A demo that intermittently errors reads as broken.
 *
 * The other branches — free text, a single read-only recipient, an empty
 * allowlist hiding the button, and a rejected send — are covered by unit and
 * component tests rather than here, where they'd need a control surface no
 * visitor would find.
 */
const FAKE_SEND_LATENCY_MS = 800;

export const testEmailProvider: TestEmailProvider = {
  includeMjml: true,
  allowedRecipients: ["you@example.com", "teammate@example.com"],

  send: async (payload) => {
    await new Promise((resolve) => setTimeout(resolve, FAKE_SEND_LATENCY_MS));

    console.info("[playground] test email 'sent'", {
      recipient: payload.recipient,
      blocks: payload.content.blocks.length,
      mjmlBytes: payload.mjml?.length ?? null,
      allowedRecipients: payload.allowedRecipients ?? null,
    });

    // E2E affordance, same rationale as `__tplPlaygroundGetMjml` in App.vue:
    // lets a spec assert on the payload without scraping console output.
    (
      window as { __tplPlaygroundLastTestEmail?: unknown }
    ).__tplPlaygroundLastTestEmail = payload;
  },
};
