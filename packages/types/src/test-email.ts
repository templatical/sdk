import type { TemplateContent } from "./template";

/**
 * What a {@link TestEmailProvider} receives when the user asks to send a test.
 */
export interface TestEmailPayload {
  recipient: string;
  /**
   * The editor's current content, exactly as `getContent()` would return it.
   * Always present.
   */
  content: TemplateContent;
  /**
   * The template rendered to MJML.
   *
   * Present only when {@link TestEmailOptions.includeMjml} is set **and**
   * `@templatical/renderer` resolved. Always guard for absence: opting in
   * without the renderer installed still sends, just without this field (the
   * editor logs one warning naming the package).
   *
   * You still have to compile MJML to HTML — the editor never does, and
   * deliberately doesn't bundle a compiler.
   */
  mjml?: string;
  /**
   * Echo of {@link TestEmailOptions.allowedRecipients}, present only when one
   * was configured.
   *
   * **Untrusted.** It is read out of the browser and carries no signature, so it
   * is not authoritative about anything. Two things it is genuinely useful for:
   * keeping one `send` implementation portable between your own backend and
   * Templatical Cloud, and comparing it against `recipient` server-side — a
   * mismatch means the client was tampered with or is buggy, which is worth
   * logging. Never treat it *as* the allowlist; that list belongs on your
   * server.
   */
  allowedRecipients?: string[];
}

/**
 * Configuration and outward notifications for test-email sending. Every
 * member is optional.
 *
 * Separate from `send` so `initCloud()` can accept this half alone: these are
 * meaningful whichever backend does the sending, Cloud's own or yours.
 * {@link TestEmailProvider} extends this, adding only `send`.
 */
export interface TestEmailOptions {
  /**
   * Also render the template to MJML and pass it as
   * {@link TestEmailPayload.mjml}, saving you a `renderToMjml()` call.
   *
   * **Requires `@templatical/renderer`**, an optional peer dependency. If it
   * isn't installed the send still happens with JSON only and one warning is
   * logged — opting in never breaks sending. A *rendering* failure is different:
   * that fails the send, because it means the template itself is broken and
   * silently sending without the MJML would hide it.
   */
  includeMjml?: boolean;
  /**
   * Restrict who may be sent to:
   *
   * - **omitted** — the dialog accepts free text, validated for shape only;
   * - **one entry** — a read-only field, pre-filled with it;
   * - **several** — a picker of exactly those addresses;
   * - **empty array** — nobody may be sent to, so the feature reports itself
   *   unavailable and no trigger renders. `[]` is read as a decision, not as
   *   "unset".
   *
   * A picker constraint, **not a security boundary**: this array lives in the
   * user's browser and is trivially edited there. Validate the recipient on your
   * server regardless of what the dialog offered.
   */
  allowedRecipients?: string[];
  /**
   * Pre-fills the recipient field. Ignored when it isn't in
   * {@link allowedRecipients}.
   */
  defaultRecipient?: string;
  /**
   * A test send completed. Fires once `send` resolves, with the same payload
   * it was given — never for a rejected send, since that surfaces through the
   * dialog's own inline error instead.
   */
  onSent?: (payload: TestEmailPayload) => void;
}

/**
 * Sending contract for test emails. Implement it to let users send a test of the
 * template they're editing through your own infrastructure — the editor owns the
 * trigger, the dialog, recipient validation and the sending/success/error
 * states; you own delivery.
 *
 * Pass an implementation as `testEmail` to `init()`. When omitted the feature
 * stays off entirely and no trigger renders.
 *
 * ```ts
 * const provider: TestEmailProvider = {
 *   send: ({ recipient, content }) =>
 *     fetch("/api/test-email", {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify({ recipient, content }),
 *     }).then((r) => {
 *       if (!r.ok) throw new Error("Could not send the test email");
 *     }),
 * };
 * ```
 */
export interface TestEmailProvider extends TestEmailOptions {
  /**
   * Deliver a test of the current template.
   *
   * Resolve on success — the dialog confirms, then closes. Reject with a
   * **user-presentable** message on failure: the dialog renders `error.message`
   * inline and stays open so the user can retry.
   */
  send(payload: TestEmailPayload): Promise<void>;
}
