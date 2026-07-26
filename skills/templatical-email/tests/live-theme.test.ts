import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

/** Semantic tokens — the only ones both dark blocks redefine, so the only ones
 *  safe to pair with a themed `color`. */
const THEMED_SURFACES = ["--canvas", "--surface", "--raised", "--hover"];

describe("live-mode theming", () => {
  // The --n-* / --paper primitives are declared once, in the light :root. Both
  // dark blocks (@media prefers-color-scheme and [data-theme="dark"]) redefine
  // only the semantic layer. So a raw primitive background under a themed
  // `color: var(--text)` collapses to ~1:1 contrast in dark mode — which made
  // the export dialog look empty on all three tabs.
  it("paints the export textarea with a theme-flipping token, not a light-ramp primitive", () => {
    const html = read("../live/index.html");
    const rule = /dialog textarea \{([^}]*)\}/.exec(html)?.[1];
    expect(rule).toBeDefined();

    const background = /background:\s*var\((--[a-z0-9-]+)\)/.exec(rule!)?.[1];
    expect(background).toBeDefined();
    expect(background).not.toMatch(/^--(n-\d+|paper)$/);
    expect(THEMED_SURFACES).toContain(background);
  });

  it("keeps the primitives out of the dark token blocks (they are theme-invariant by design)", () => {
    const html = read("../live/index.html");
    // Guards the assumption the rule above rests on: nothing flips --n-*, so
    // reaching for one is always a theming bug. The .toast pairs two primitives
    // with each other on purpose, which stays readable in both themes.
    const darkBlocks = [
      /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([^}]*)\}/,
      /:root\[data-theme="dark"\] \{([^}]*)\}/,
    ].map((pattern) => pattern.exec(html)?.[1]);

    for (const block of darkBlocks) {
      expect(block).toBeDefined();
      expect(block).not.toMatch(/--(n-\d+|paper):/);
    }
  });
});
