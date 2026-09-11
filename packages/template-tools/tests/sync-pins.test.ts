import { describe, expect, it } from "vitest";
// @ts-expect-error - plain .mjs script, no types
import {
  applyCliPin,
  applyEditorVersion,
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
      /skills\/templatical-email\/SKILL\.md/,
    );
  });

  it("names the given label in the not-found error instead, when one is passed", () => {
    // This is what lets job 3 (the docs pins) reuse applyCliPin verbatim: a
    // missing pin in the German docs page must not be reported as SKILL.md.
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
