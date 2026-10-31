// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sanitizeHtml, sanitizeSvg } from "../src/utils/sanitizeHtml";

describe("sanitizer without a DOM", () => {
  it("escapes HTML and SVG as text", () => {
    expect(sanitizeHtml('<img src="x" onerror="fire()">')).toBe(
      "&lt;img src=&quot;x&quot; onerror=&quot;fire()&quot;&gt;",
    );
    expect(sanitizeSvg('<svg onload="fire()"></svg>')).toBe(
      "&lt;svg onload=&quot;fire()&quot;&gt;&lt;/svg&gt;",
    );
  });
});
