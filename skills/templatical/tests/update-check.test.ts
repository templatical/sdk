import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REFERENCE_DIR = resolve(import.meta.dirname, "../reference");
const read = (island: string) =>
  readFileSync(resolve(REFERENCE_DIR, `${island}.md`), "utf8");

// An installed skill never refreshes itself, so the staleness check is the
// only thing that tells a user a newer copy exists. Two properties decide
// whether it fires at all, and neither is visible from reading the prose:
// which island carries it, and which lock field it reads.
describe("the update check", () => {
  it("lives in talking.md, the island every session loads", () => {
    expect(read("talking")).toContain(".skill-lock.json");
  });

  it("is NOT in cli.md, which only loads before the first command", () => {
    // cli.md is reached via the router's "before the first command of a
    // session" instruction, so an SDK-only session — a docs question that
    // runs no CLI command — never sees it. Putting the check there silently
    // excludes exactly those users.
    expect(read("cli")).not.toContain(".skill-lock.json");
  });

  it("reads updatedAt rather than installedAt", () => {
    // installedAt never moves again after the first install, so a user who
    // has run `skills update` would be told they are stale forever.
    const src = read("talking");
    expect(src).toContain("`updatedAt`");
    expect(src).toMatch(/Use `updatedAt`, not `installedAt`/);
  });

  it("queries the skill's own folder path, scoped by date", () => {
    const src = read("talking");
    expect(src).toContain(
      "api.github.com/repos/templatical/sdk/commits?path=skills/templatical",
    );
    expect(src).toContain("since=<updatedAt>");
  });

  it("does not compare skillFolderHash", () => {
    // The skills CLI computes it; replicating that algorithm here would break
    // the moment it changes, and it is not documented.
    expect(read("talking")).toMatch(/Do not try\s+to compare `skillFolderHash`/);
  });

  it("states that every failure is silent and never blocks the work", () => {
    const src = read("talking");
    expect(src).toContain("Every failure here is silent");
    expect(src).toMatch(
      /must never delay, interrupt or replace the\s+work the user actually asked for/,
    );
  });

  it("dictates the wording, so the offer reads the same every time", () => {
    expect(read("talking")).toContain(
      "A newer Templatical skill is available. Update? It runs `npx skills update`.",
    );
  });
});
