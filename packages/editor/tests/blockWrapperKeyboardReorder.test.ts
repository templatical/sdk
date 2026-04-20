import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../src/i18n/locales/en";
import de from "../src/i18n/locales/de";

const src = readFileSync(
  resolve(
    __dirname,
    "..",
    "src",
    "components",
    "blocks",
    "BlockWrapper.vue",
  ),
  "utf-8",
);

describe("BlockWrapper keyboard reorder wiring", () => {
  it("injects the keyboard reorder composable", () => {
    expect(src).toContain("KEYBOARD_REORDER_KEY");
    expect(src).toContain("inject(KEYBOARD_REORDER_KEY");
  });

  it("binds a keydown handler on the drag handle", () => {
    expect(src).toContain('@keydown="handleDragKeydown"');
  });

  it("exposes aria-pressed + aria-keyshortcuts on the drag handle", () => {
    expect(src).toContain(':aria-pressed="isLifted"');
    expect(src).toContain(
      'aria-keyshortcuts="Space Enter ArrowUp ArrowDown Escape"',
    );
  });

  it("swaps the drag handle aria-label when lifted", () => {
    expect(src).toContain("dragAriaLabel");
    expect(src).toContain("t.blockActions.dragLifted");
  });

  it("toggles the tpl-block--lifted class when in keyboard-lift state", () => {
    expect(src).toContain("'tpl-block--lifted': isLifted");
  });

  it("handles Space / Enter / ArrowUp / ArrowDown / Escape keys", () => {
    const keys = ['" "', '"Enter"', '"ArrowUp"', '"ArrowDown"', '"Escape"'];
    for (const key of keys) {
      expect(src).toContain(key);
    }
  });
});

describe("BlockWrapper keyboard reorder i18n", () => {
  it("exposes all reorder announcement keys in en + de", () => {
    const keys = ["dragLifted", "lifted", "moved", "dropped", "cancelled"];
    for (const key of keys) {
      expect(en.blockActions).toHaveProperty(key);
      expect(de.blockActions).toHaveProperty(key);
      expect(
        (en.blockActions as unknown as Record<string, string>)[key].length,
      ).toBeGreaterThan(0);
      expect(
        (de.blockActions as unknown as Record<string, string>)[key].length,
      ).toBeGreaterThan(0);
    }
  });

  it("reorder announcement templates include the required placeholders", () => {
    expect(en.blockActions.lifted).toContain("{block}");
    expect(en.blockActions.lifted).toContain("{position}");
    expect(en.blockActions.lifted).toContain("{total}");
    expect(en.blockActions.moved).toContain("{position}");
    expect(en.blockActions.cancelled).toContain("{position}");
    expect(de.blockActions.lifted).toContain("{block}");
    expect(de.blockActions.lifted).toContain("{position}");
    expect(de.blockActions.lifted).toContain("{total}");
    expect(de.blockActions.moved).toContain("{position}");
    expect(de.blockActions.cancelled).toContain("{position}");
  });
});
