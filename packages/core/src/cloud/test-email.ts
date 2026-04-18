import type {
  ExportResult,
  Template,
  TestEmailConfig,
} from "@templatical/types";
import type { AuthManager } from "./auth";
import { ApiClient } from "./api";
import type { ComputedRef, Ref } from "vue";
import { computed, ref, watch } from "vue";

export interface UseTestEmailOptions {
  authManager: AuthManager;
  getTemplateId: () => string | null;
  save: () => Promise<Template>;
  exportHtml: (templateId: string) => Promise<ExportResult>;
  onError?: (error: Error) => void;
  isAuthReady?: Ref<boolean>;
  onBeforeTestEmail?: (html: string) => string | Promise<string>;
}

export interface UseTestEmailReturn {
  isEnabled: ComputedRef<boolean>;
  allowedEmails: ComputedRef<string[]>;
  isSending: Ref<boolean>;
  error: Ref<string | null>;
  sendTestEmail: (recipient: string) => Promise<void>;
}

export function useTestEmail(options: UseTestEmailOptions): UseTestEmailReturn {
  const {
    authManager,
    getTemplateId,
    save,
    exportHtml,
    onError,
    isAuthReady,
    onBeforeTestEmail,
  } = options;
  const api = new ApiClient(authManager);

  const isSending = ref(false);
  const error = ref<string | null>(null);

  const testEmailConfig = ref<TestEmailConfig | null>(null);

  if (isAuthReady) {
    watch(
      isAuthReady,
      (ready) => {
        if (ready) {
          testEmailConfig.value = authManager.testEmailConfig;
        }
      },
      { immediate: true },
    );
  }

  const isEnabled = computed<boolean>(() => testEmailConfig.value !== null);

  const allowedEmails = computed<string[]>(
    () => testEmailConfig.value?.allowedEmails ?? [],
  );

  async function sendTestEmail(recipient: string): Promise<void> {
    if (!testEmailConfig.value) {
      throw new Error("Test email is not enabled for this project");
    }

    const templateId = getTemplateId();
    if (!templateId) {
      throw new Error("Template must be saved before sending a test email");
    }

    isSending.value = true;
    error.value = null;

    try {
      await save();

      let { html } = await exportHtml(templateId);

      if (onBeforeTestEmail) {
        html = await onBeforeTestEmail(html);
      }

      await api.sendTestEmail(templateId, {
        recipient,
        html,
        allowed_emails: testEmailConfig.value.allowedEmails,
        signature: testEmailConfig.value.signature,
      });
    } catch (err) {
      const wrappedError =
        err instanceof Error
          ? err
          : new Error("Failed to send test email", { cause: err });
      error.value = wrappedError.message;
      onError?.(wrappedError);
      throw wrappedError;
    } finally {
      isSending.value = false;
    }
  }

  return {
    isEnabled,
    allowedEmails,
    isSending,
    error,
    sendTestEmail,
  };
}
