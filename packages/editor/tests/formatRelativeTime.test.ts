import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { formatRelativeTime } from "../src/utils/formatRelativeTime";
import type { RelativeTimeLabels } from "../src/utils/formatRelativeTime";

const labels: RelativeTimeLabels = {
  justNow: "Just now",
  minutesAgo: "{minutes} minutes ago",
  hoursAgo: "{hours} hours ago",
  daysAgo: "{days} days ago",
};

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns justNow for dates less than 1 minute ago", () => {
    const result = formatRelativeTime("2026-04-04T11:59:30Z", labels);
    expect(result).toBe("Just now");
  });

  it("returns minutes ago for dates 1-59 minutes old", () => {
    const result = formatRelativeTime("2026-04-04T11:55:00Z", labels);
    expect(result).toBe("5 minutes ago");
  });

  it("returns hours ago for dates 1-23 hours old", () => {
    const result = formatRelativeTime("2026-04-04T09:00:00Z", labels);
    expect(result).toBe("3 hours ago");
  });

  it("returns days ago for dates 1+ days old", () => {
    const result = formatRelativeTime("2026-04-02T12:00:00Z", labels);
    expect(result).toBe("2 days ago");
  });

  it("uses format function when provided", () => {
    const format = vi.fn(
      (template: string, values: Record<string, string | number>) => {
        return template.replace(
          /\{(\w+)\}/g,
          (_, key) => String(values[key]),
        );
      },
    );

    const result = formatRelativeTime(
      "2026-04-04T09:00:00Z",
      labels,
      format,
    );
    expect(result).toBe("3 hours ago");
    expect(format).toHaveBeenCalledWith("{hours} hours ago", { hours: 3 });
  });

  it("returns null when days exceed maxDays", () => {
    const result = formatRelativeTime(
      "2026-03-20T12:00:00Z",
      labels,
      undefined,
      7,
    );
    expect(result).toBeNull();
  });

  it("returns days string when days are within maxDays", () => {
    const result = formatRelativeTime(
      "2026-04-01T12:00:00Z",
      labels,
      undefined,
      7,
    );
    expect(result).toBe("3 days ago");
  });

  it("returns days string when maxDays is not specified", () => {
    const result = formatRelativeTime("2026-03-01T12:00:00Z", labels);
    expect(result).toBe("34 days ago");
  });

  it("handles edge case at exactly 60 minutes (becomes 1 hour)", () => {
    const result = formatRelativeTime("2026-04-04T11:00:00Z", labels);
    expect(result).toBe("1 hours ago");
  });

  it("handles edge case at exactly 24 hours (becomes 1 day)", () => {
    const result = formatRelativeTime("2026-04-03T12:00:00Z", labels);
    expect(result).toBe("1 days ago");
  });

  it("uses placeholder replacement without format function", () => {
    const result = formatRelativeTime("2026-04-04T11:50:00Z", labels);
    expect(result).toBe("10 minutes ago");
  });

  it("returns justNow for slightly future dates (clock skew tolerance)", () => {
    const result = formatRelativeTime("2026-04-04T12:00:30Z", labels);
    expect(result).toBe("Just now");
  });

  it("returns null for far-future dates instead of mislabeling them as 'just now'", () => {
    // 1 hour in the future — clearly not "just now"; caller should fall back
    // to the absolute date format.
    const result = formatRelativeTime("2026-04-04T13:00:00Z", labels);
    expect(result).toBeNull();
  });

  it("returns null for far-future dates beyond 1-minute clock-skew window", () => {
    // 5 minutes in the future
    const result = formatRelativeTime("2026-04-04T12:05:00Z", labels);
    expect(result).toBeNull();
  });

  it("returns null for invalid date strings instead of NaN-laced output", () => {
    const result = formatRelativeTime("not-a-date", labels);
    expect(result).toBeNull();
  });
});

