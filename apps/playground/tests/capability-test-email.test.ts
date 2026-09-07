import { describe, expect, it } from "vitest";
import { buildCapabilityConfig } from "../src/config/build";
import { testEmailCapability } from "../src/config/capabilities/test-email";
import { testEmailProvider } from "../src/providers/test-email";

describe("testEmailCapability", () => {
  it("keeps the pinned allowlist, so the feature never hides itself", () => {
    // `useTestEmailFeature.isAvailable` is false for an empty list, and an
    // editable list control would let a user delete the feature with no
    // explanation. Two recipients is also what makes the picker branch — not
    // the single read-only field — the shape being demonstrated.
    const config = buildCapabilityConfig(
      testEmailCapability,
      {},
      testEmailProvider,
    );
    expect(config.testEmail?.allowedRecipients).toEqual([
      "you@example.com",
      "teammate@example.com",
    ]);
  });

  it("has no control that can empty the allowlist", () => {
    expect(
      testEmailCapability.controls.map((c) => c.path),
    ).not.toContain("testEmail.allowedRecipients");
  });

  it("defaults includeMjml on, so the renderer chain is exercised", () => {
    const config = buildCapabilityConfig(
      testEmailCapability,
      {},
      testEmailProvider,
    );
    expect(config.testEmail?.includeMjml).toBe(true);
  });

  it("drops the mjml payload when includeMjml is off", () => {
    const config = buildCapabilityConfig(
      testEmailCapability,
      { "testEmail.includeMjml": false },
      testEmailProvider,
    );
    expect(config.testEmail?.includeMjml).toBe(false);
  });

  it("offers only pinned recipients as the default", () => {
    const [, defaultRecipient] = testEmailCapability.controls;
    expect(
      defaultRecipient.kind === "enum" && defaultRecipient.options,
    ).toEqual(["you@example.com", "teammate@example.com"]);
  });

  it("forwards the provider's own send", () => {
    const config = buildCapabilityConfig(
      testEmailCapability,
      {},
      testEmailProvider,
    );
    expect(config.testEmail?.send).toBe(testEmailProvider.send);
  });
});
