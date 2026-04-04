import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INIT_TIMEOUT_MS,
  COLLAB_UNDO_WARNING_MS,
  DEFAULT_AUTO_SAVE_DEBOUNCE_MS,
  MAX_UPLOAD_SIZE_BYTES,
} from "../src/constants/timeouts";

function readSrc(relativePath: string): string {
  return readFileSync(resolve(__dirname, "..", "src", relativePath), "utf-8");
}

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

describe("constant consumers", () => {
  it("index.ts uses INIT_TIMEOUT_MS instead of 30000", () => {
    const src = readSrc("index.ts");
    expect(src).toContain("INIT_TIMEOUT_MS");
    expect(src).not.toMatch(/setTimeout[\s\S]*?30000/);
  });

  it("CloudEditor.vue uses COLLAB_UNDO_WARNING_MS instead of 4000", () => {
    const src = readSrc("cloud/CloudEditor.vue");
    expect(src).toContain("COLLAB_UNDO_WARNING_MS");
    expect(src).not.toMatch(/}, 4000\)/);
  });

  it("CloudEditor.vue uses DEFAULT_AUTO_SAVE_DEBOUNCE_MS instead of 5000", () => {
    const src = readSrc("cloud/CloudEditor.vue");
    expect(src).toContain("DEFAULT_AUTO_SAVE_DEBOUNCE_MS");
    expect(src).not.toMatch(/\?\? 5000/);
  });

  it("DesignReferenceSidebar.vue uses MAX_UPLOAD_SIZE_BYTES", () => {
    const src = readSrc("cloud/components/DesignReferenceSidebar.vue");
    expect(src).toContain("MAX_UPLOAD_SIZE_BYTES");
    expect(src).not.toContain("10 * 1024 * 1024");
  });
});

describe("CloudEditor.vue deprecated API fix", () => {
  const src = readSrc("cloud/CloudEditor.vue");

  it("does not use deprecated navigator.platform", () => {
    expect(src).not.toContain("navigator.platform");
  });

  it("uses navigator.userAgent for Mac detection", () => {
    expect(src).toMatch(/navigator\.userAgent/);
  });
});
