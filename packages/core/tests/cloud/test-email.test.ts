import { describe, expect, it } from 'vitest';
import { useTestEmail } from '../../src/cloud/test-email';
import type { AuthManager } from '../../src/cloud/auth';
import { ref } from 'vue';

/**
 * `useTestEmail` is configuration only — plan enablement, the allowed-recipient
 * list, and the signature that lets the backend verify it. Sending moved to
 * `createCloudTestEmailProvider` so that exactly one send body serves both the
 * OSS and Cloud editors; see `test-email-provider.test.ts`.
 */

function createMockAuthManager(
  testEmailConfig: { allowedEmails: string[]; signature: string } | null = {
    allowedEmails: ['test@example.com'],
    signature: 'sig-123',
  },
): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: () => Promise.resolve(),
    testEmailConfig,
  } as unknown as AuthManager;
}

describe('useTestEmail', () => {
  it('isEnabled reflects testEmailConfig availability', () => {
    const { isEnabled } = useTestEmail({
      authManager: createMockAuthManager(),
      isAuthReady: ref(true),
    });

    expect(isEnabled.value).toBe(true);
  });

  it('isEnabled is false when no testEmailConfig', () => {
    const { isEnabled } = useTestEmail({
      authManager: createMockAuthManager(null),
      isAuthReady: ref(true),
    });

    expect(isEnabled.value).toBe(false);
  });

  it('allowedEmails returns emails from config', () => {
    const { allowedEmails } = useTestEmail({
      authManager: createMockAuthManager(),
      isAuthReady: ref(true),
    });

    expect(allowedEmails.value).toEqual(['test@example.com']);
  });

  it('allowedEmails is empty when config is null', () => {
    const { allowedEmails } = useTestEmail({
      authManager: createMockAuthManager(null),
      isAuthReady: ref(true),
    });

    expect(allowedEmails.value).toEqual([]);
  });

  it('getSignature returns the config signature, or null when disabled', () => {
    expect(
      useTestEmail({
        authManager: createMockAuthManager(),
        isAuthReady: ref(true),
      }).getSignature(),
    ).toBe('sig-123');

    expect(
      useTestEmail({
        authManager: createMockAuthManager(null),
        isAuthReady: ref(true),
      }).getSignature(),
    ).toBeNull();
  });

  /**
   * The config arrives with the JWT, so everything above is empty until auth
   * resolves. This is why consumers must read `allowedEmails` reactively — the
   * editor's `isAvailable` treats an empty allowlist as "nobody may be sent to",
   * so a value snapshotted before this flip would hide the feature for the whole
   * session.
   */
  it('stays empty until isAuthReady flips, then fills', async () => {
    const isAuthReady = ref(false);
    const { isEnabled, allowedEmails, getSignature } = useTestEmail({
      authManager: createMockAuthManager(),
      isAuthReady,
    });

    expect(isEnabled.value).toBe(false);
    expect(allowedEmails.value).toEqual([]);
    expect(getSignature()).toBeNull();

    isAuthReady.value = true;
    await Promise.resolve();

    expect(isEnabled.value).toBe(true);
    expect(allowedEmails.value).toEqual(['test@example.com']);
    expect(getSignature()).toBe('sig-123');
  });

  it('never reads the config when isAuthReady is omitted', () => {
    // No gate means nothing ever sets it — the caller opted out of the feature.
    const { isEnabled, allowedEmails } = useTestEmail({
      authManager: createMockAuthManager(),
    });

    expect(isEnabled.value).toBe(false);
    expect(allowedEmails.value).toEqual([]);
  });
});
