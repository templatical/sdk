import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(__dirname, "../src/components/SpacingControl.vue"),
  "utf-8",
);

describe("SpacingControl.vue structure", () => {
  it("uses computed for isUniform instead of deep watcher", () => {
    expect(src).toContain("const isUniform = computed(");
  });

  it("watches isUniform (shallow) instead of modelValue (deep)", () => {
    expect(src).toContain("watch(isUniform,");
    expect(src).not.toMatch(/watch\(\s*\(\)\s*=>\s*props\.modelValue/);
  });

  it("does not use deep: true watcher", () => {
    expect(src).not.toContain("{ deep: true }");
  });

  it("initializes locked from isUniform computed", () => {
    expect(src).toContain("const locked = ref(isUniform.value)");
  });
});
