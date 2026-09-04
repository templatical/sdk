import { beforeEach, describe, expect, it } from "vitest";
import { SCRATCH_TEMPLATE_NAME, slugFor } from "@/providers/template-name";
import {
  savedBlocksKeyFor,
  savedBlocksProviderFor,
} from "@/providers/saved-blocks";

describe("slugFor", () => {
  it("lowercases and hyphenates a template name", () => {
    expect(slugFor("Product Launch")).toBe("product-launch");
  });
});

describe("savedBlocksProviderFor", () => {
  beforeEach(() => localStorage.clear());

  it("keys storage by template name", () => {
    expect(savedBlocksKeyFor("Product Launch")).toBe(
      "templatical:saved-blocks:product-launch",
    );
  });

  it("memoises one provider per template name", () => {
    const first = savedBlocksProviderFor();
    const second = savedBlocksProviderFor();
    expect(second).toBe(first);
  });

  it("defaults to the scratch template when none is given", () => {
    expect(SCRATCH_TEMPLATE_NAME).toBe("Scratch");
    expect(savedBlocksKeyFor(SCRATCH_TEMPLATE_NAME)).toBe(
      "templatical:saved-blocks:scratch",
    );
  });
});
