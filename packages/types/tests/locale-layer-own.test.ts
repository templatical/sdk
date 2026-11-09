import { describe, expect, it } from "vitest";
import { applyOperationsInPlace, type TemplateContent } from "../src";

describe("a locale edit writes only to the block's own language layer", () => {
  it("adds an own layer and leaves an inherited one untouched", () => {
    const inherited: Record<string, unknown> = {};
    const l10n = Object.create({ de: inherited }) as Record<string, unknown>;
    const content = {
      blocks: [{ id: "t1", type: "title", content: "Hello", l10n }],
      settings: { locale: "en", locales: ["de"] },
    } as unknown as TemplateContent;

    applyOperationsInPlace(content, [
      { op: "updateBlockLocale", blockId: "t1", locale: "de", hidden: true },
    ]);

    expect(inherited).toEqual({});
    expect(Object.prototype.hasOwnProperty.call(l10n, "de")).toBe(true);
    expect(l10n.de).toEqual({ hidden: true });
  });
});
