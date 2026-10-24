// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { validateChatAttachments } from "../src/utils/aiAttachments";
const mb = 1024 * 1024;
const file = (name: string, size = 1, type = "image/png") =>
  new File([new Uint8Array(size)], name, { type });
describe("validateChatAttachments", () => {
  it("keeps existing files and accepts supported kinds in order", () => {
    const existing = [file("old")];
    const added = [
      file("pdf", 1, "application/pdf"),
      file("webp", 1, "image/webp"),
      file("gif", 1, "image/gif"),
    ];
    expect(validateChatAttachments(existing, added)).toEqual({
      accepted: [...existing, ...added],
      errors: [],
    });
    expect(existing).toHaveLength(1);
    expect(
      validateChatAttachments([], [file("jpeg", 1, "image/jpeg")]).errors,
    ).toEqual([]);
  });
  it("reports every reason and keeps the order while accepting later valid files", () => {
    const a = file("a", 5 * mb),
      b = file("b", 5 * mb),
      zero = file("zero", 0);
    const result = validateChatAttachments(
      [a],
      [
        file("bad", 1, "text/plain"),
        file("large", 5 * mb + 1),
        b,
        file("total"),
        zero,
        file("last", 0),
        file("fifth", 0),
      ],
    );
    expect(result.accepted).toEqual([
      a,
      b,
      zero,
      expect.objectContaining({ name: "last" }),
    ]);
    expect(result.errors).toEqual([
      { name: "bad", reason: "wrongType" },
      { name: "large", reason: "tooLarge" },
      { name: "total", reason: "totalTooLarge" },
      { name: "fifth", reason: "tooMany" },
    ]);
  });
});
