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
});

describe("formatRelativeTime consumers", () => {
  const { readFileSync } = require("node:fs");
  const { resolve } = require("node:path");

  function readSrc(path: string): string {
    return readFileSync(resolve(__dirname, "..", "src", path), "utf-8");
  }

  describe("CommentsSidebar.vue", () => {
    const src = readSrc("cloud/components/CommentsSidebar.vue");

    it("imports formatRelativeTime utility", () => {
      expect(src).toContain(
        'import { formatRelativeTime } from "../../utils/formatRelativeTime"',
      );
    });

    it("uses formatRelativeTime in formatTime function", () => {
      expect(src).toContain("formatRelativeTime(dateString");
    });

    it("does not have inline time calculation", () => {
      expect(src).not.toContain("Math.floor(diffMs / 60000)");
      expect(src).not.toContain("86400000");
    });
  });

  describe("SnapshotHistory.vue", () => {
    const src = readSrc("cloud/components/SnapshotHistory.vue");

    it("imports formatRelativeTime utility", () => {
      expect(src).toContain(
        'import { formatRelativeTime } from "../../utils/formatRelativeTime"',
      );
    });

    it("uses formatRelativeTime with maxDays=7 for absolute fallback", () => {
      expect(src).toMatch(/formatRelativeTime\([\s\S]*?7/);
    });

    it("does not have inline time calculation", () => {
      expect(src).not.toContain("Math.floor(diff / 60000)");
      expect(src).not.toContain("86400000");
    });
  });
});
