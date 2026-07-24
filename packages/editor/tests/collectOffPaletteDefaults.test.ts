import { describe, expect, it } from "vitest";
import { collectOffPaletteDefaults } from "../src/utils/collectOffPaletteDefaults";

describe("collectOffPaletteDefaults", () => {
  it("lists the factory default colours that fall outside the palette", () => {
    // `#ffffff` covers button.textColor / countdown.backgroundColor /
    // template.backgroundColor; everything else is off this palette.
    const offenders = collectOffPaletteDefaults(["#ffffff", "#7c3aed"]);
    expect(offenders).toEqual([
      "button.backgroundColor: #333333",
      "divider.color: #e0e0e0",
      "menu.separatorColor: #e0e0e0",
      "table.borderColor: #e0e0e0",
      "countdown.digitColor: #1a1a1a",
      "countdown.labelColor: #6b7280",
      "template.textColor: #1a1a1a",
    ]);
  });

  it("drops offenders that consumer overrides bring back on-palette", () => {
    const offenders = collectOffPaletteDefaults(
      ["#ffffff", "#7c3aed", "#111827"],
      {
        button: { backgroundColor: "#7c3aed" },
        divider: { color: "#111827" },
        menu: { separatorColor: "#111827" },
        table: { borderColor: "#111827" },
        countdown: { digitColor: "#111827", labelColor: "#7c3aed" },
      },
      { textColor: "#111827" },
    );
    // Every effective default colour now sits inside the palette.
    expect(offenders).toEqual([]);
  });

  it("matches a 3-digit preset against a 6-digit default via canonicalization", () => {
    // Palette lists the shorthand `#abc`; the button default is its 6-digit form.
    const offenders = collectOffPaletteDefaults(["#abc"], {
      button: { backgroundColor: "#aabbcc" },
    });
    expect(offenders).not.toContain("button.backgroundColor: #aabbcc");
    // Sanity: a genuinely off-palette factory default is still flagged.
    expect(offenders).toContain("divider.color: #e0e0e0");
  });

  it("ignores non-colour keys entirely", () => {
    // A palette covering every factory colour leaves zero offenders — proving the
    // walk never reports non-colour string keys (content, url, separator, locale…).
    const fullPalette = ["#333333", "#ffffff", "#e0e0e0", "#1a1a1a", "#6b7280"];
    expect(collectOffPaletteDefaults(fullPalette)).toEqual([]);
  });

  it("skips empty-string colour values (an unset default is not off-palette)", () => {
    const offenders = collectOffPaletteDefaults(["#ffffff"], {
      button: { backgroundColor: "" },
    });
    expect(offenders).not.toContain("button.backgroundColor: ");
    // The tiny palette still flags the other factory colours.
    expect(offenders).toContain("divider.color: #e0e0e0");
  });

  it("reports off-palette templateDefaults with a template. prefix", () => {
    const offenders = collectOffPaletteDefaults(
      // Covers every block-level factory colour, isolating the template axis.
      ["#333333", "#ffffff", "#e0e0e0", "#1a1a1a", "#6b7280"],
      undefined,
      { textColor: "#abcdef", backgroundColor: "#123456" },
    );
    expect(offenders).toEqual([
      "template.backgroundColor: #123456",
      "template.textColor: #abcdef",
    ]);
  });
});
