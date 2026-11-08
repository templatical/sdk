import { describe, expect, it } from "vitest";
import { noteValue } from "../note-value";

describe("noteValue", () => {
  it("keeps a value of up to 80 characters unchanged", () => {
    expect(noteValue("a".repeat(80))).toBe("a".repeat(80));
  });
  it("cuts a longer value to 80 characters and an ellipsis", () => {
    expect(noteValue("a".repeat(81))).toBe(`${"a".repeat(80)}…`);
  });
  it("quotes a value that is not a string", () => {
    expect(noteValue(42)).toBe("42");
  });
  it("never ends on half of a surrogate pair", () => {
    expect(noteValue(`${"a".repeat(79)}😀😀`)).toBe(`${"a".repeat(79)}…`);
  });
});
