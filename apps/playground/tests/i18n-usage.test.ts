import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../src/i18n/en";

const SRC = join(import.meta.dirname, "../src");

/**
 * Strings are read through `t` from `usePlaygroundI18n()`, so only files that
 * call it are scanned: elsewhere `t` names other things (a target box, Lezer's
 * `tags`), and reading those as translations would report nonsense.
 */
function holderFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "i18n" ? [] : holderFiles(path);
    }
    if (!/\.(vue|ts)$/.test(name)) return [];
    return readFileSync(path, "utf8").includes("usePlaygroundI18n()")
      ? [path]
      : [];
  });
}

const holders = holderFiles(SRC).map((path) => ({
  path: path.slice(SRC.length + 1),
  text: readFileSync(path, "utf8"),
}));

interface Reference {
  file: string;
  chain: string;
  /** Followed by `[`, so the key under it is chosen at runtime. */
  dynamic: boolean;
}

const references: Reference[] = holders.flatMap(({ path, text }) =>
  [
    ...text.matchAll(/\bt(?:\.value)?((?:\??\.[A-Za-z_$][\w$]*)+)(\s*\[)?/g),
  ].map((match) => ({
    file: path,
    chain: match[1].replace(/\?\./g, ".").slice(1),
    dynamic: match[2] !== undefined,
  })),
);

function leafPaths(node: unknown, prefix = ""): string[] {
  if (typeof node !== "object" || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) =>
    leafPaths(value, prefix ? `${prefix}.${key}` : key),
  );
}

function resolves(chain: string): boolean {
  let node: unknown = en;
  for (const part of chain.split(".")) {
    if (typeof node !== "object" || node === null || !(part in node)) {
      return false;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return true;
}

describe("playground strings", () => {
  it("reads every string through `t` from usePlaygroundI18n()", () => {
    // The scan assumes that name; another spelling would hide its readers.
    const spellings = holders.flatMap(({ path, text }) =>
      [
        ...text.matchAll(
          /(?:const|let)\s+([^=]+?)\s*=\s*usePlaygroundI18n\(\)/g,
        ),
      ]
        .map((match) => match[1].replace(/\s+/g, " "))
        .filter((binding) => !/^\{[^}]*\bt\b(?!\s*:)[^}]*\}$/.test(binding))
        .map((binding) => `${path}: ${binding}`),
    );
    expect(spellings).toEqual([]);
  });

  it("has no string that nothing reads", () => {
    // A reference that stops at an object, or indexes into one, hands over
    // its whole subtree.
    const dead = leafPaths(en).filter(
      (leaf) =>
        !references.some(
          ({ chain }) => leaf === chain || leaf.startsWith(`${chain}.`),
        ),
    );
    expect(dead).toEqual([]);
  });

  it("reads no string that does not exist", () => {
    const dangling = references
      .filter(({ chain }) => !resolves(chain))
      .map(({ file, chain }) => `${file}: t.${chain}`);
    expect(dangling).toEqual([]);
  });

  it("sees the strings the notes and theme menu pick at runtime", () => {
    // Dynamic lookups are the case a leaf-by-leaf scan gets wrong.
    const dynamic = references
      .filter((reference) => reference.dynamic)
      .map(({ chain }) => chain);
    expect(dynamic).toEqual(
      expect.arrayContaining([
        "host.notes.items",
        "host.notes.targets",
        "host.groups",
        "theme",
      ]),
    );
  });
});
