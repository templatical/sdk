import { describe, expect, it, vi } from "vitest";
import { lintHtmlFragment } from "../../src/compatibility";
import { supportFor } from "../../src/compatibility/support";

vi.mock("../../src/compatibility/support", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/compatibility/support")>()),
  supportFor: vi.fn(() => []),
}));

describe("compatibility verdicts", () => {
  it("omits a detected feature when no client has limited support", () => {
    expect(lintHtmlFragment('<div style="display:flex">x</div>')).toEqual([]);
    expect(supportFor).toHaveBeenCalledWith("css-display-flex", "flex");
  });
});
