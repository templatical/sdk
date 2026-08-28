import { describe, expect, it } from "vitest";
import { renderConfig } from "../src/config/render";

describe("renderConfig", () => {
  it("prints scalars and literal false", () => {
    const out = renderConfig({ locale: "en", savedBlocks: { update: false } });
    expect(out).toContain('locale: "en"');
    expect(out).toContain("update: false");
  });

  it("prints a function's own source, not a placeholder", () => {
    const list = async () => [];
    const out = renderConfig({ savedBlocks: { list } });
    expect(out).toContain("async () =>");
    expect(out).not.toContain("[Function");
  });

  /**
   * The load-bearing guarantee: the panel is not a description of the config,
   * it IS the config. Parsing the render back must reproduce the same shape.
   * A snapshot would only prove the output is stable, not that it is true.
   */
  it("round-trips: the rendered source parses back to the same shape", () => {
    const config = {
      locale: "de",
      autoSave: { debounce: 2000 },
      savedBlocks: { create: false, update: false },
    };
    const parsed = JSON.parse(
      renderConfig(config).replace(/(\w+):/g, '"$1":').replace(/'/g, '"'),
    );
    expect(parsed).toEqual(config);
  });
});
