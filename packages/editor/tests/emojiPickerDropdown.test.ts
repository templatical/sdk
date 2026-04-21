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
    "EmojiPickerDropdown.vue",
  ),
  "utf-8",
);

describe("EmojiPickerDropdown structure", () => {
  it("wires focus trap to the picker element", () => {
    expect(src).toContain("useFocusTrap(pickerRef, isOpenRef)");
  });

  it("closes on outside click of the root", () => {
    expect(src).toContain("onClickOutside(rootRef");
  });

  it("closes on Escape keydown", () => {
    expect(src).toContain("@keydown.esc");
    expect(src).toContain("closeEmojiPicker");
  });

  it("exposes aria-expanded and aria-controls on the trigger button", () => {
    expect(src).toContain(':aria-expanded="showEmojiPicker"');
    expect(src).toContain('aria-controls="tpl-emoji-picker"');
  });

  it("marks each emoji button with a localized aria-label template", () => {
    expect(src).toContain("t.paragraphEditor.emojiItemLabel");
    expect(src).toContain("emoji }");
  });

  it("applies role=dialog to the dropdown panel", () => {
    expect(src).toContain('role="dialog"');
  });
});

describe("EmojiPickerDropdown i18n", () => {
  it("exposes emojiItemLabel in en + de with the {emoji} placeholder", () => {
    expect(en.paragraphEditor.emojiItemLabel).toContain("{emoji}");
    expect(de.paragraphEditor.emojiItemLabel).toContain("{emoji}");
  });

  it("exposes closeEmojiPicker label in en + de", () => {
    expect(en.paragraphEditor.closeEmojiPicker.length).toBeGreaterThan(0);
    expect(de.paragraphEditor.closeEmojiPicker.length).toBeGreaterThan(0);
  });
});
