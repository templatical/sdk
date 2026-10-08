import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error - plain .mjs script, no types
import {
  applyCliPin,
  applyEditorVersion,
  skillMarkdownFiles,
  applyExampleRanges,
  exampleManifests,
} from "../scripts/sync-pins.mjs";

// Fixture strings below are built from parts, like tests/cdn-pin.test.ts's own
// DECLARATION_RE, so a fixture never self-matches that test's repo-wide scan
// for a second EDITOR_VERSION declaration — collapsing one back into a plain
// literal would make this file itself look like a duplicate declaration and
// fail CI. The runtime string value is unchanged either way.
describe("applyEditorVersion", () => {
  it("rewrites the declaration in place", () => {
    const src = ["export const EDITOR_VERSION", ' = "0.1.0";\n'].join("");
    expect(applyEditorVersion(src, "9.9.9")).toBe(
      ["export const EDITOR_VERSION", ' = "9.9.9";\n'].join(""),
    );
  });

  it("throws when the declaration is missing, rather than silently no-oping", () => {
    expect(() => applyEditorVersion("const x = 1;", "1.0.0")).toThrow(
      /EDITOR_VERSION/,
    );
  });

  it("leaves the rest of the file untouched", () => {
    const src = [
      "const a = 1;\nexport const EDITOR_VERSION",
      ' = "0.1.0";\nconst b = 2;\n',
    ].join("");
    const out = applyEditorVersion(src, "2.0.0");
    expect(out).toContain("const a = 1;");
    expect(out).toContain("const b = 2;");
  });
});

// Fixture strings here are likewise built from parts so this file's own
// source never self-matches sync-pins.mjs's own CLI_PIN_RE scan, nor
// tests/skill-pin.test.ts's or tests/skill-commands.test.ts's repo-wide scans
// for the pin.
const PIN_PREFIX = ["npx -y @templatical", "/template-tools@"].join("");

describe("applyCliPin", () => {
  it("rewrites a single occurrence", () => {
    const src = `Run \`${PIN_PREFIX}0.1.0 validate <file> --json\`.\n`;
    const { next, count } = applyCliPin(src, "9.9.9");
    expect(next).toBe(`Run \`${PIN_PREFIX}9.9.9 validate <file> --json\`.\n`);
    expect(count).toBe(1);
  });

  it("rewrites every occurrence, not just the first", () => {
    const src = [
      `${PIN_PREFIX}0.1.0 validate <file> --json`,
      `${PIN_PREFIX}0.1.0 list --json`,
      `${PIN_PREFIX}0.1.0 live reload --json`,
    ].join("\n");
    const { next, count } = applyCliPin(src, "2.0.0");
    expect(count).toBe(3);
    expect(next.match(/@2\.0\.0/g)).toHaveLength(3);
    expect(next).not.toContain("0.1.0");
  });

  it("throws when no pin is found, rather than silently no-oping", () => {
    expect(() => applyCliPin("no pin here", "1.0.0")).toThrow(
      /Could not find any/,
    );
  });

  it("names SKILL.md in the not-found error by default", () => {
    expect(() => applyCliPin("no pin here", "1.0.0")).toThrow(
      /skills\/templatical\/SKILL\.md/,
    );
  });

  it("names the given label in the not-found error instead, when one is passed", () => {
    // The label names the file that broke, so a missing pin in one file is
    // not reported as SKILL.md.
    expect(() =>
      applyCliPin("no pin here", "1.0.0", "apps/docs/de/guide/agent-skill.md"),
    ).toThrow(/apps\/docs\/de\/guide\/agent-skill\.md/);
  });

  it("leaves the rest of the text untouched", () => {
    const src = `before\n${PIN_PREFIX}0.1.0 validate <file>\nafter\n`;
    const out = applyCliPin(src, "2.0.0").next;
    expect(out).toContain("before");
    expect(out).toContain("after");
  });
});

// node_modules is a real directory under every workspace member, not a
// symlink — lstatSync alone excludes today's vendor packages only because
// pnpm happens to symlink each one inside it. This locks the name-based skip
// that makes the exclusion structural instead of incidental to that
// installer detail.
describe("skillMarkdownFiles", () => {
  it("walks only the skill's own markdown, never its node_modules", () => {
    const files = skillMarkdownFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((f: string) => f.includes("node_modules"))).toEqual([]);
  });
});

describe("applyExampleRanges", () => {
  const manifest = (
    deps: Record<string, string>,
    devDeps: Record<string, string> = {},
  ) =>
    `${JSON.stringify(
      {
        name: "x",
        private: true,
        dependencies: deps,
        devDependencies: devDeps,
      },
      null,
      2,
    )}\n`;

  it("sets every @templatical range in dependencies and devDependencies", () => {
    const { next, count } = applyExampleRanges(
      manifest(
        { "@templatical/editor": "^0.1.0", next: "^16.0.0" },
        { "@templatical/types": "^0.1.0", typescript: "^5.9.0" },
      ),
      "9.9.9",
      "examples/x/package.json",
    );
    expect(count).toBe(2);
    expect(JSON.parse(next)).toEqual({
      name: "x",
      private: true,
      dependencies: { "@templatical/editor": "^9.9.9", next: "^16.0.0" },
      devDependencies: { "@templatical/types": "^9.9.9", typescript: "^5.9.0" },
    });
  });

  it("returns the text unchanged when every range is already current", () => {
    const text = manifest({ "@templatical/editor": "^9.9.9" });
    expect(
      applyExampleRanges(text, "9.9.9", "examples/x/package.json").next,
    ).toBe(text);
  });

  it("keeps two-space JSON with a trailing newline and the key order", () => {
    const { next } = applyExampleRanges(
      manifest({ react: "^19.0.0", "@templatical/editor": "^0.1.0" }),
      "1.0.0",
      "examples/x/package.json",
    );
    expect(next).toBe(
      manifest({ react: "^19.0.0", "@templatical/editor": "^1.0.0" }),
    );
  });

  it("throws, naming the file, when it finds no @templatical dependency", () => {
    expect(() =>
      applyExampleRanges(
        manifest({ react: "^19.0.0" }),
        "1.0.0",
        "examples/x/package.json",
      ),
    ).toThrow("No @templatical/* dependency in examples/x/package.json");
  });

  it("throws, naming the file, when the manifest is not JSON", () => {
    expect(() =>
      applyExampleRanges("{", "1.0.0", "examples/x/package.json"),
    ).toThrow("examples/x/package.json: not valid JSON");
  });
});

describe("exampleManifests", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sync-pins-examples-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("lists each example directory's package.json and nothing else", () => {
    for (const name of ["b", "a"]) {
      mkdirSync(join(dir, name));
      writeFileSync(join(dir, name, "package.json"), "{}\n");
    }
    mkdirSync(join(dir, "no-manifest"));
    writeFileSync(join(dir, "README.md"), "# Examples\n");
    mkdirSync(join(dir, "a", "node_modules", "dep"), { recursive: true });
    writeFileSync(
      join(dir, "a", "node_modules", "dep", "package.json"),
      "{}\n",
    );
    expect(exampleManifests(dir)).toEqual([
      "examples/a/package.json",
      "examples/b/package.json",
    ]);
  });

  it("finds the real examples", () => {
    expect(exampleManifests()).toContain("examples/nextjs/package.json");
  });
});

describe("main", () => {
  it("runs all three jobs", () => {
    // A job main() no longer calls passes every unit test above. It would
    // surface only as a stale pin after the next release.
    const source = readFileSync(
      join(import.meta.dirname, "../scripts/sync-pins.mjs"),
      "utf8",
    );
    const main = source.slice(source.indexOf("function main()"));
    for (const job of [
      "syncEditorVersion()",
      "syncCliPin()",
      "syncExampleRanges()",
    ]) {
      expect(main).toContain(job);
    }
  });
});
