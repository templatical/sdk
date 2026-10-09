import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `guide/theming.md` (and the German mirror) is the consumer's map of the
 * editor's theming surface, so it must match what the editor reads:
 *
 * - the `--tpl-user-*` table lists exactly the hooks `styles/index.css` reads.
 *   A hook that is read but unlisted can't be found, and one that is listed
 *   but never read does nothing when set;
 * - its Dark column marks exactly the hooks with a `--tpl-user-dark-*` twin.
 *   The rest (radius, base size, font, motion, the on-primary label) apply in
 *   both modes, so a dark twin the page promised for one of them would be
 *   silently ignored;
 * - the config-key table lists exactly the keys of `ThemeOverrides`.
 */

const REPO = join(import.meta.dirname, "../../..");

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

const PAGES = [
  "apps/docs/guide/theming.md",
  "apps/docs/de/guide/theming.md",
] as const;

/** Hooks `css` reads, by light name; `dark` holds the ones with a dark twin. */
function hooksRead(css: string): { light: string[]; dark: string[] } {
  const names = new Set(
    [
      ...css
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .matchAll(/var\(\s*--tpl-user-([a-z0-9-]+)/g),
    ].map((m) => m[1]),
  );
  return {
    light: [...names].filter((n) => !n.startsWith("dark-")).sort(),
    dark: [...names]
      .filter((n) => n.startsWith("dark-"))
      .map((n) => n.slice("dark-".length))
      .sort(),
  };
}

/** Hook-table rows: `| \`--tpl-user-<name>\` | purpose | ✓ or blank |`. */
function hookRows(page: string): { name: string; dark: boolean }[] {
  return [...page.matchAll(/^\|\s*`--tpl-user-([a-z0-9-]+)`\s*\|(.*)$/gm)].map(
    (m) => ({ name: m[1], dark: m[2].split("|")[1]?.trim() === "✓" }),
  );
}

/** Config-key table rows: `| \`bgElevated\` | purpose |`. */
function configKeyRows(page: string): string[] {
  return [...page.matchAll(/^\|\s*`([a-z][A-Za-z]*)`\s*\|/gm)].map((m) => m[1]);
}

function interfaceKeys(src: string, name: string): string[] {
  const body =
    new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`).exec(src)?.[1] ??
    "";
  return [...body.matchAll(/^\s*([A-Za-z]\w*)\??:/gm)].map((m) => m[1]);
}

describe("guide/theming.md stays aligned with the editor's theming surface", () => {
  const { light, dark } = hooksRead(read("packages/editor/src/styles/index.css"));
  const configKeys = interfaceKeys(
    read("packages/types/src/config.ts"),
    "ThemeOverrides",
  )
    .filter((key) => key !== "dark")
    .sort();

  it("reads a non-trivial theming surface (sanity check)", () => {
    // A pattern that stopped matching would make every case below compare
    // an empty list with an empty list.
    expect(light.length).toBeGreaterThan(30);
    expect(dark.length).toBeGreaterThan(20);
    expect(configKeys.length).toBeGreaterThan(20);
  });

  it.each(PAGES)("%s lists every hook index.css reads, and no other", (page) => {
    expect(
      hookRows(read(page))
        .map((row) => row.name)
        .sort(),
    ).toEqual(light);
  });

  it.each(PAGES)("%s marks exactly the hooks that have a dark twin", (page) => {
    expect(
      hookRows(read(page))
        .filter((row) => row.dark)
        .map((row) => row.name)
        .sort(),
    ).toEqual(dark);
  });

  it.each(PAGES)("%s lists every ThemeOverrides key, and no other", (page) => {
    expect(configKeyRows(read(page)).sort()).toEqual(configKeys);
  });
});
