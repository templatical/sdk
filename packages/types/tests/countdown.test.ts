import { describe, expect, it } from "vitest";
import {
  countdownAltText,
  countdownTargetTime,
  countdownWallTime,
  createCountdownBlock,
} from "../src";

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

  it("formats an English regional locale with its requested date conventions", () => {
    expect(countdownAltText(block, "en-GB")).toBe(
      "Countdown to 24 December 2026 at 18:00 (Europe/Berlin)",
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

describe("countdownTargetTime", () => {
  const at = (targetDate: string, timezone: string) =>
    countdownTargetTime({ targetDate, timezone });

  it("reads wall-clock time in the block's timezone, across DST", () => {
    expect(at("2026-12-24T18:00", "Europe/Berlin")).toBe(
      Date.UTC(2026, 11, 24, 17, 0),
    );
    expect(at("2026-07-01T12:00", "Europe/Berlin")).toBe(
      Date.UTC(2026, 6, 1, 10, 0),
    );
    expect(at("2026-03-08T12:00:30", "America/New_York")).toBe(
      Date.UTC(2026, 2, 8, 16, 0, 30),
    );
    expect(at("2026-12-24T18:00", "UTC")).toBe(Date.UTC(2026, 11, 24, 18, 0));
  });

  it("moves a wall time inside a DST gap forward by the gap, on both sides of UTC", () => {
    // 02:30 does not exist on these nights; it resolves to 03:30 summer time.
    expect(at("2026-03-29T02:30", "Europe/Berlin")).toBe(
      Date.UTC(2026, 2, 29, 1, 30),
    );
    expect(at("2026-03-08T02:30", "America/New_York")).toBe(
      Date.UTC(2026, 2, 8, 7, 30),
    );
  });

  it("resolves a wall time that occurs twice to the later occurrence", () => {
    expect(at("2026-10-25T02:30", "Europe/Berlin")).toBe(
      Date.UTC(2026, 9, 25, 1, 30),
    );
    expect(at("2026-11-01T01:30", "America/New_York")).toBe(
      Date.UTC(2026, 10, 1, 6, 30),
    );
  });

  it("does not depend on the process timezone", () => {
    const previous = process.env.TZ;
    process.env.TZ = "Pacific/Auckland";
    try {
      expect(at("2026-12-24T18:00", "Europe/Berlin")).toBe(
        Date.UTC(2026, 11, 24, 17, 0),
      );
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it("reads a value with Z or an offset as that instant, ignoring the timezone", () => {
    expect(at("2026-12-24T18:00Z", "Not/AZone")).toBe(
      Date.UTC(2026, 11, 24, 18, 0),
    );
    expect(at("2026-12-24T18:00:00+01:00", "America/New_York")).toBe(
      Date.UTC(2026, 11, 24, 17, 0),
    );
    expect(at("2026-12-24T17:00:00.000Z", "Europe/Berlin")).toBe(
      Date.UTC(2026, 11, 24, 17, 0),
    );
  });

  it("returns null for empty, malformed or impossible dates and unknown zones", () => {
    expect(at("", "UTC")).toBeNull();
    expect(at("not-a-date", "UTC")).toBeNull();
    expect(at("2026-12-24", "UTC")).toBeNull();
    expect(at("2026-02-30T10:00", "UTC")).toBeNull();
    expect(at("2026-12-24T24:30", "UTC")).toBeNull();
    expect(at("2026-12-24T18:00", "Invalid/Zone")).toBeNull();
    expect(at("2026-02-30T10:00Z", "UTC")).toBeNull();
    expect(at("2026-02-30T10:00:00+01:00", "UTC")).toBeNull();
    expect(at("2026-04-31T10:00:00Z", "UTC")).toBeNull();
    expect(
      countdownTargetTime({ targetDate: 42, timezone: "UTC" } as never),
    ).toBeNull();
  });
});

describe("countdownWallTime", () => {
  it("keeps a wall-clock value, trimmed to minutes", () => {
    expect(
      countdownWallTime({ targetDate: "2026-12-24T18:00:59", timezone: "UTC" }),
    ).toBe("2026-12-24T18:00");
  });

  it("converts a value with an offset into the block's timezone", () => {
    expect(
      countdownWallTime({
        targetDate: "2026-12-24T18:00:00+01:00",
        timezone: "Europe/Berlin",
      }),
    ).toBe("2026-12-24T18:00");
    expect(
      countdownWallTime({
        targetDate: "2026-12-24T17:00:00.000Z",
        timezone: "America/New_York",
      }),
    ).toBe("2026-12-24T12:00");
  });

  it("returns an empty string for an unreadable value", () => {
    expect(countdownWallTime({ targetDate: "", timezone: "UTC" })).toBe("");
    expect(
      countdownWallTime({ targetDate: "2026-02-30T10:00", timezone: "UTC" }),
    ).toBe("");
    expect(
      countdownWallTime({
        targetDate: "2026-12-24T17:00:00Z",
        timezone: "Invalid/Zone",
      }),
    ).toBe("");
  });
});

describe("countdownAltText with a wall-clock target", () => {
  it("formats the wall time in the block's zone, whatever the process zone", () => {
    const previous = process.env.TZ;
    process.env.TZ = "Pacific/Auckland";
    try {
      expect(
        countdownAltText(
          createCountdownBlock({
            targetDate: "2026-12-24T18:00",
            timezone: "Europe/Berlin",
          }),
          "en",
        ),
      ).toBe("Countdown to December 24, 2026 at 6:00 PM (Europe/Berlin)");
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});
