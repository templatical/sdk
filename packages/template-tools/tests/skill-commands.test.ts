import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

// A pure-content skill's one remaining failure mode is instructing an agent
// to run a command that doesn't exist — there's no validator left in the
// skill itself to catch that at generation time, only this test. The pin now
// lives in many files instead of one (see skill-pin.test.ts), and so does
// every command invocation, so this scans the router plus every reference
// island rather than a single SKILL.md.
const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SKILL_DIR = resolve(REPO_ROOT, "skills/templatical");
const REFERENCE_DIR = resolve(SKILL_DIR, "reference");
const BIN_TS = resolve(REPO_ROOT, "packages/template-tools/src/bin.ts");
const LIVE_TS = resolve(
  REPO_ROOT,
  "packages/template-tools/src/cli/commands/live.ts",
);

/**
 * The router plus every reference island, repo-relative label paired with its
 * absolute path. Deliberately not a generic recursive walk of
 * `skills/templatical/`: `node_modules` and `coverage` sit alongside
 * `reference/` in that directory and carry `.md` files of their own (vendor
 * READMEs, `node_modules/typescript` and `node_modules/vitest` are symlinks
 * into the pnpm store) that document no CLI commands at all — scanning them
 * would either false-negative silently or need the same symlink-avoidance
 * sync-pins.mjs's tree walk carries.
 *
 * Inside `reference/` the walk *is* recursive, and that matters: sync-pins.mjs
 * rewrites the pin in every `.md` under the skill at any depth, so a flat scan
 * here would leave a nested island's invocations documented but unchecked.
 * Nothing installs into `reference/`, so recursing there needs no skip list.
 */
function skillMarkdownFiles(): { label: string; path: string }[] {
  const files = [
    { label: "skills/templatical/SKILL.md", path: resolve(SKILL_DIR, "SKILL.md") },
  ];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;
      files.push({
        label: `skills/templatical/${relative(SKILL_DIR, abs).split(sep).join("/")}`,
        path: abs,
      });
    }
  };
  walk(REFERENCE_DIR);
  return files;
}

/**
 * The valid top-level command set, derived from src/bin.ts's own
 * `switch (args.command)` — not from its USAGE string. USAGE is prose meant
 * for a human running `--help`; it could in principle list a command that
 * isn't wired, or omit one that is, without anything else noticing. The
 * switch can't drift that way: every `case "…":` here is a command that
 * actually dispatches, and anything else falls to `default` (unknown
 * command). Reading the runtime dispatch surface, not its description of
 * itself, is what makes this a real regression test rather than a second
 * copy of the docs.
 */
function validTopLevelCommands(): Set<string> {
  const src = readFileSync(BIN_TS, "utf8");
  const commands = [...src.matchAll(/case "([a-z]+)":/g)].map(
    (match) => match[1],
  );
  return new Set(commands);
}

/**
 * `live`'s valid subcommands, derived from src/cli/commands/live.ts's own
 * dispatch guard (`if (sub === "reload" || sub === "stop")`). This lives in
 * a second file because the grammar itself is two levels: bin.ts's switch
 * only sees the top-level `live` command, and everything after it is parsed
 * inside runLive. Anything else there throws a UsageError (see the
 * `if (sub !== undefined) throw …` immediately below that guard), which is
 * exactly the runtime behaviour this set has to mirror.
 */
function validLiveSubcommands(): Set<string> {
  const src = readFileSync(LIVE_TS, "utf8");
  const subcommands = [...src.matchAll(/sub === "([a-z]+)"/g)].map(
    (match) => match[1],
  );
  return new Set(subcommands);
}

interface Invocation {
  raw: string;
  /** Repo-relative label of the file this invocation was found in. */
  file: string;
  command: string;
  /** The token right after the command, only when it isn't a flag. */
  next?: string;
}

// Matches the same fixed prefix as scripts/sync-pins.mjs's CLI_PIN_RE and
// tests/skill-pin.test.ts's CLI_PIN_RE, built from parts for the same reason
// they are: so this file's own source never self-matches the scan. The
// version itself is intentionally not captured — tests/skill-pin.test.ts
// already owns whether it's correct, so this file can validate commands
// independent of whatever the current pin happens to be.
//
// The command/next tokens exclude a literal backtick, not just whitespace:
// an island may reference a no-argument command as inline code mid-sentence
// (reference/blocks.md: "`npx -y @templatical/template-tools@0.36.0 schema`
// prints the same schema for…"), where the closing backtick sits flush
// against the command with no space. `\S+` there would capture "schema`" and
// fail every command it names, since nothing dispatches on the literal
// string with a trailing backtick.
const INVOCATION_RE = new RegExp(
  [
    "npx -y @templatical",
    "/template-tools@\\S+\\s+([^\\s`]+)(?:\\s+([^\\s`]+))?",
  ].join(""),
);

function parseInvocations(file: string, content: string): Invocation[] {
  const lines = content.split("\n");
  const invocations: Invocation[] = [];
  for (const line of lines) {
    const match = INVOCATION_RE.exec(line);
    if (!match) continue;
    const [, command, maybeNext] = match;
    invocations.push({
      raw: line.trim(),
      file,
      command,
      next: maybeNext && !maybeNext.startsWith("-") ? maybeNext : undefined,
    });
  }
  return invocations;
}

function isValidInvocation(
  invocation: Pick<Invocation, "command" | "next">,
  commands: Set<string>,
  liveSubcommands: Set<string>,
): boolean {
  if (!commands.has(invocation.command)) return false;
  // Only `live` takes a subcommand-shaped second token; every other command's
  // next token is a file path or placeholder, which this function has no
  // opinion on — that's the CLI's own argument parsing to reject at runtime,
  // not something SKILL.md-command-validity can check statically.
  if (invocation.command === "live" && invocation.next !== undefined) {
    return liveSubcommands.has(invocation.next);
  }
  return true;
}

describe("documented commands across the skill", () => {
  const commands = validTopLevelCommands();
  const liveSubcommands = validLiveSubcommands();

  it("derived the command sets from source, not an empty/stale scan", () => {
    // Guards the derivation itself: if either regex above stops matching
    // (e.g. bin.ts's switch changes shape), every check below would pass
    // vacuously rather than catching the drift.
    expect([...commands].sort()).toEqual(
      ["edit", "help", "import", "list", "live", "render", "schema", "validate"].sort(),
    );
    expect([...liveSubcommands].sort()).toEqual(["reload", "stop"]);
  });

  it("every `npx …` invocation across the skill dispatches to a real command", () => {
    const invocations = skillMarkdownFiles().flatMap(({ label, path }) =>
      parseInvocations(label, readFileSync(path, "utf8")),
    );

    // Non-vacuous: the skill must actually document some commands, or every
    // check below passes on an empty list for the wrong reason.
    expect(invocations.length).toBeGreaterThan(0);

    const invalid = invocations.filter(
      (invocation) => !isValidInvocation(invocation, commands, liveSubcommands),
    );
    expect(
      // Name the file with each offending line — a tree-wide scan that only
      // ever says "SKILL.md" is worse than the single-file check it replaces.
      invalid.map((invocation) => `${invocation.file}: ${invocation.raw}`),
      "a reference island (or SKILL.md) documents a command (or `live` subcommand) the CLI does not dispatch.",
    ).toEqual([]);
  });

  it("rejects a bad `live` subcommand rather than passing because `live` exists", () => {
    // Regression coverage for the parser itself, independent of SKILL.md's
    // current content: `live` alone is a valid top-level command, but that
    // must not be enough to wave through anything typed after it.
    expect(
      isValidInvocation({ command: "live", next: "frobnicate" }, commands, liveSubcommands),
    ).toBe(false);
    expect(
      isValidInvocation({ command: "live", next: "reload" }, commands, liveSubcommands),
    ).toBe(true);
    expect(
      isValidInvocation({ command: "live", next: "stop" }, commands, liveSubcommands),
    ).toBe(true);
    // A flag right after `live` (e.g. `live --file x.json`) is a bare `live`
    // invocation, not a subcommand attempt — parseInvocations already turns
    // this into `next: undefined`, so this checks isValidInvocation directly
    // for the case where it doesn't.
    expect(
      isValidInvocation({ command: "live", next: undefined }, commands, liveSubcommands),
    ).toBe(true);
  });

  it("rejects an unknown top-level command", () => {
    expect(
      isValidInvocation({ command: "frobnicate" }, commands, liveSubcommands),
    ).toBe(false);
  });
});
