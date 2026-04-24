import { describe, expect, it } from "vitest";
import {
  INIT_TIMEOUT_MS,
  COLLAB_UNDO_WARNING_MS,
  DEFAULT_AUTO_SAVE_DEBOUNCE_MS,
  MAX_UPLOAD_SIZE_BYTES,
} from "../src/constants/timeouts";

describe("timeout constants", () => {
  it("INIT_TIMEOUT_MS is 30 seconds", () => {
    expect(INIT_TIMEOUT_MS).toBe(30000);
  });

  it("COLLAB_UNDO_WARNING_MS is 4 seconds", () => {
    expect(COLLAB_UNDO_WARNING_MS).toBe(4000);
  });

  it("DEFAULT_AUTO_SAVE_DEBOUNCE_MS is 5 seconds", () => {
    expect(DEFAULT_AUTO_SAVE_DEBOUNCE_MS).toBe(5000);
  });

  it("MAX_UPLOAD_SIZE_BYTES is 10 MB", () => {
    expect(MAX_UPLOAD_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});
