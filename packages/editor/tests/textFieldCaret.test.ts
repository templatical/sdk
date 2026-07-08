// @vitest-environment happy-dom
//
// happy-dom has no layout engine, so the mirror's marker offsets are 0 and
// getComputedStyle borders/line-height resolve to 0. These tests therefore
// assert the util's integration math — how it folds the field's bounding rect
// and scroll offset into a viewport caret rect — and that the temporary mirror
// element is always cleaned up. Sub-pixel caret precision is a real-browser
// concern covered by manual/e2e verification, not unit tests.

import { describe, expect, it, vi } from "vitest";
import { getCaretRect } from "../src/utils/textFieldCaret";

function stubRect(el: Element, rect: Partial<DOMRect>): void {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
}

describe("getCaretRect", () => {
  it("returns null when the field has no view (detached)", () => {
    const fake = {
      ownerDocument: { defaultView: null },
    } as unknown as HTMLInputElement;
    expect(getCaretRect(fake, 0)).toBeNull();
  });

  it("anchors an input vertically to the field and horizontally at the caret", () => {
    const input = document.createElement("input");
    input.value = "hello world";
    document.body.appendChild(input);
    stubRect(input, { top: 100, bottom: 120, left: 50, right: 250 });

    const rect = getCaretRect(input, 5)!;

    expect(rect).not.toBeNull();
    // Input branch: vertical from the element rect, not the mirror.
    expect(rect.top).toBe(100);
    expect(rect.bottom).toBe(120);
    // No layout in happy-dom → markerLeft 0, borderLeft 0, scrollLeft 0.
    expect(rect.left).toBe(50);

    input.remove();
  });

  it("subtracts the field's scroll offset from a textarea caret rect", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "line one\nline two";
    document.body.appendChild(textarea);
    stubRect(textarea, { top: 200, bottom: 260, left: 30 });
    textarea.scrollTop = 40;
    textarea.scrollLeft = 7;

    const rect = getCaretRect(textarea, 10)!;

    // top = elRect.top(200) + markerTop(0) + borderTop(0) - scrollTop(40)
    expect(rect.top).toBe(160);
    // left = elRect.left(30) + markerLeft(0) + borderLeft(0) - scrollLeft(7)
    expect(rect.left).toBe(23);

    textarea.remove();
  });

  it("removes the temporary mirror element after measuring", () => {
    const input = document.createElement("input");
    input.value = "abc";
    document.body.appendChild(input);
    stubRect(input, { top: 0, bottom: 20, left: 0 });

    const before = document.body.childElementCount;
    getCaretRect(input, 2);
    expect(document.body.childElementCount).toBe(before);
    expect(document.body.querySelector("div[aria-hidden='true']")).toBeNull();

    input.remove();
  });
});
