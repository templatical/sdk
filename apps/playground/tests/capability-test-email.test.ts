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

  it("hands through the provider itself, never a spread copy of it", () => {
    // A spread would read every own property once and store the result, so a
    // getter-backed `allowedRecipients` would freeze at whatever it held when
    // `build()` ran. Cloud's adapter fills that list from the JWT after
    // setup, starting `[]` — which means "nobody", so the trigger would never
    // render. Identity is the assertion that pins it: a copy fails this,
    // however carefully each field was re-read into it.
    const config = buildCapabilityConfig(
      testEmailCapability,
      {},
      testEmailProvider,
    );
    expect(config.testEmail).toBe(testEmailProvider);
  });

  it("still tracks a list that fills in after build() ran", () => {
    // The behavioural half of the case above, against a getter rather than
    // the demo's plain array.
    let filled: string[] = [];
    const late = {
      send: async () => {},
      get allowedRecipients() {
        return filled;
      },
    } as unknown as typeof testEmailProvider;

    const config = buildCapabilityConfig(testEmailCapability, {}, late);
    expect(config.testEmail?.allowedRecipients).toEqual([]);

    filled = ["late@example.com"];
    expect(config.testEmail?.allowedRecipients).toEqual(["late@example.com"]);
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
