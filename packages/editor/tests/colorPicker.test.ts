import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(__dirname, "../src/components/ColorPicker.vue"),
  "utf-8",
);

describe("ColorPicker.vue structure", () => {
  it("uses writable computed instead of ref + watcher", () => {
    expect(src).toContain("const internalColor = computed({");
    expect(src).toContain("get: ()");
    expect(src).toContain("set: (val)");
  });

  it("does not use a separate watch for modelValue sync", () => {
    expect(src).not.toMatch(/watch\(\s*\(\)\s*=>\s*props\.modelValue/);
  });

  it("does not have redundant emit in event handlers", () => {
    const onPickerChange = src.match(
      /function onPickerChange[\s\S]*?^}/m,
    )?.[0];
    const onTextInput = src.match(
      /function onTextInput[\s\S]*?^}/m,
    )?.[0];

    expect(onPickerChange).not.toContain('emit("update:modelValue"');
    expect(onTextInput).not.toContain('emit("update:modelValue"');
  });
});
