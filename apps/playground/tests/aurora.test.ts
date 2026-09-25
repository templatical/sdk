import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AURORA_GRAIN,
  AURORA_THEMES,
  AURORA_VIGNETTE_FLOOR,
  auroraFragment,
  type AuroraTheme,
  type Lch,
} from "../src/host/aurora";

const css = readFileSync(join(__dirname, "../src/style.css"), "utf8");

/** A colour token from style.css's @theme, as OKLCH. */
function token(name: string): Lch {
  const match = new RegExp(
    `--color-${name}: oklch\\(([\\d.]+)% ([\\d.]+) ([\\d.]+)\\)`,
  ).exec(css);
  if (!match) throw new Error(`no --color-${name} in style.css`);
  return [Number(match[1]) / 100, Number(match[2]), Number(match[3])];
}

function toSrgb([L, C, h]: Lch): [number, number, number] {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((c) => {
    const v = Math.min(1, Math.max(0, c));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  }) as [number, number, number];
}

function luminance(rgb: readonly number[]): number {
  const [r, g, b] = rgb.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: readonly number[], b: readonly number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Every pixel the aurora can paint is a mix of its four colours, lifted by
 * the pointer halo or dimmed by the vignette, with grain on top. The worst
 * pixel for a text colour is one of those extremes.
 */
function worstContrast(palette: AuroraTheme, text: Lch): number {
  const ink = toSrgb(text);
  let worst = Infinity;
  for (const colour of [
    palette.base,
    palette.accent,
    palette.copper,
    palette.gold,
  ]) {
    for (const lift of [0, palette.halo]) {
      const rgb = toSrgb([Math.min(1, colour[0] + lift), colour[1], colour[2]]);
      for (const dim of [1, AURORA_VIGNETTE_FLOOR]) {
        for (const grain of [-AURORA_GRAIN, AURORA_GRAIN]) {
          const bg = rgb.map((v) => Math.min(1, Math.max(0, v * dim + grain)));
          worst = Math.min(worst, contrast(ink, bg));
        }
      }
    }
  }
  return worst;
}

describe("hero aurora", () => {
  it.each([
    ["light", "gray-900", "headline"],
    ["light", "gray-600", "lede, nav and the Playground label"],
    ["dark", "gray-100", "headline"],
    ["dark", "gray-300", "lede and nav"],
    ["dark", "gray-400", "the Playground label"],
  ] as const)(
    "keeps %s %s text (%s) at 4.5:1 over its worst pixel",
    (theme, name, _what) => {
      expect(
        worstContrast(AURORA_THEMES[theme], token(name)),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("would fail the lede with templatical.com's own accent", () => {
    // Why this copy is quieter, and proof the check can fail at all.
    const loud: AuroraTheme = {
      ...AURORA_THEMES.light,
      accent: [0.8, 0.16, 55],
    };
    expect(worstContrast(loud, token("gray-600"))).toBeLessThan(4.5);
  });

  it("fades into the page's own background", () => {
    expect(AURORA_THEMES.light.base).toEqual(token("white"));
    expect(AURORA_THEMES.dark.base).toEqual(token("gray-900"));
  });

  it("writes the tested palette into the shader", () => {
    const shader = auroraFragment();
    expect(shader).toContain("lch(0.915, 0.060, 55.0)");
    expect(shader).toContain("lch(0.255, 0.050, 55.0)");
    expect(shader).toContain(
      `mix(${AURORA_VIGNETTE_FLOOR.toFixed(3)}, 1.0, vig)`,
    );
  });
});
