import { describe, expect, it } from "vitest";
import { countdownAltText, createCountdownBlock } from "../src";

describe("countdownAltText", () => {
  const block = createCountdownBlock({
    targetDate: "2026-12-24T17:00:00.000Z",
    timezone: "Europe/Berlin",
  });

  it("formats the target in the block timezone using the content locale", () => {
    expect(countdownAltText(block, "en")).toBe(
      "Countdown to December 24, 2026 at 6:00 PM (Europe/Berlin)",
    );
    expect(countdownAltText(block, "de")).toBe(
      "Countdown: 24. Dezember 2026 um 18:00 (Europe/Berlin)",
    );
  });

  it("uses English for unknown and malformed locale tags", () => {
    expect(countdownAltText(block, "xx-XX")).toBe(
      countdownAltText(block, "en"),
    );
    expect(countdownAltText(block, "!!")).toBe(countdownAltText(block, "en"));
  });

  it("uses the locale's countdown label for invalid dates and timezones", () => {
    expect(countdownAltText({ ...block, targetDate: "bad" }, "en")).toBe(
      "Countdown",
    );
    expect(countdownAltText({ ...block, targetDate: "bad" }, "fr")).toBe(
      "Compte à rebours",
    );
    expect(countdownAltText({ ...block, timezone: "Invalid/Zone" }, "fr")).toBe(
      "Compte à rebours",
    );
  });
});
