import type {
  ExportResult,
  Template,
  TestEmailProvider,
} from "@templatical/types";
import type { AuthManager } from "./auth";
import { ApiClient } from "./api";
import type { ComputedRef } from "vue";

export interface CreateCloudTestEmailProviderOptions {
  authManager: AuthManager;
  getTemplateId: () => string | null;
  save: () => Promise<Template>;
  exportHtml: (templateId: string) => Promise<ExportResult>;
  /**
   * The project's allowed recipients, from the signed JWT.
   *
   * Taken as a `ComputedRef` rather than an array because it only becomes
   * populated once auth resolves — see the getter note on the returned provider.
   */
  allowedEmails: ComputedRef<string[]>;
  /** The signature that lets the backend verify {@link allowedEmails}. */
  getSignature: () => string | null;
  onBeforeTestEmail?: (html: string) => string | Promise<string>;
}

/**
 * Templatical Cloud's test-email sender, shaped as a {@link TestEmailProvider}
 * so it plugs into the same editor seam a consumer's own sender would.
 *
 * Two things about it are deliberately unlike a BYO provider:
 *
 * - **It ignores `payload.content` and `payload.allowedRecipients`.** Cloud saves
 *   the template, has its backend render the HTML, and derives the allowlist plus
 *   its signature from the auth manager. Trusting the echoed payload would swap a
 *   server-signed list for an unsigned browser value. The contract is "send a test
 *   of the current template" — how an adapter obtains the bytes is its business,
 *   so this is honest rather than a smell. Don't "fix" it.
 * - **It never sets `includeMjml`.** Cloud renders server-side, so the editor
 *   should not spend a render pass producing MJML nobody reads.
 */
export function createCloudTestEmailProvider(
  options: CreateCloudTestEmailProviderOptions,
): TestEmailProvider {
  const api = new ApiClient(options.authManager);

  return {
    /**
     * A getter, not a snapshot: the allowlist arrives with the JWT, so it starts
     * empty and fills once auth is ready. The editor reads this property inside a
     * computed, which is what makes the trigger appear at that point — reading it
     * once at construction would pin it to `[]` and, because an empty allowlist
     * means "nobody may be sent to", hide the button forever.
     */
    get allowedRecipients(): string[] {
      return options.allowedEmails.value;
    },

    async send({ recipient }): Promise<void> {
      const signature = options.getSignature();
      if (signature === null) {
        throw new Error("Test email is not enabled for this project");
      }

      const templateId = options.getTemplateId();
      if (templateId === null) {
        throw new Error("Template must be saved before sending a test email");
      }

      // Save first: the backend renders from the stored template, so sending
      // without this would mail a stale version of what's on screen.
      await options.save();

      let { html } = await options.exportHtml(templateId);
      if (options.onBeforeTestEmail) {
        html = await options.onBeforeTestEmail(html);
      }

      await api.sendTestEmail(templateId, {
        recipient,
        html,
        allowed_emails: options.allowedEmails.value,
        signature,
      });
    },
  };
}
