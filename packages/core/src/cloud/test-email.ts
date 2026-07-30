import type { TestEmailConfig } from "@templatical/types";
import type { AuthManager } from "./auth";
import type { ComputedRef, Ref } from "vue";
import { computed, ref, watch } from "vue";

/**
 * Cloud's test-email *configuration* — whether the project has the feature, who
 * may be sent to, and the signature that lets the backend verify that list.
 *
 * Sending itself lives in `createCloudTestEmailProvider`, which plugs into the
 * shared `useTestEmailFeature` seam in `@templatical/editor` alongside a
 * consumer's own sender. Keeping the send body in exactly one place is the point:
 * both editors then drive identical UI, state and error handling, so the sending
 * spinner, the inline error and the success confirmation can't drift apart.
 */
export interface UseTestEmailOptions {
  authManager: AuthManager;
  /** Gates reading the config off the auth manager until the JWT has resolved. */
  isAuthReady?: Ref<boolean>;
}

export interface UseTestEmailReturn {
  /** Whether the project's token carries a test-email config at all. */
  isEnabled: ComputedRef<boolean>;
  /**
   * Addresses the project permits. Empty until auth resolves — read it
   * reactively, never snapshot it, or it stays empty for the session.
   */
  allowedEmails: ComputedRef<string[]>;
  /** The signature accompanying {@link allowedEmails}, or `null` when disabled. */
  getSignature: () => string | null;
}

export function useTestEmail(options: UseTestEmailOptions): UseTestEmailReturn {
  const { authManager, isAuthReady } = options;

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

  function getSignature(): string | null {
    return testEmailConfig.value?.signature ?? null;
  }

  return { isEnabled, allowedEmails, getSignature };
}
