import { describe, expect, it } from "vitest";
import { formatFileSize } from "../src/utils/formatFileSize";

describe("formatFileSize", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1024, "1 KB"],
    [1536, "1.5 KB"],
    [10 * 1024 * 1024, "10 MB"],
    [1.25 * 1024 * 1024, "1.3 MB"],
    [2 * 1024 * 1024 * 1024, "2 GB"],
    [5 * 1024 ** 4, "5120 GB"],
  ])("formats %d bytes as %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});
