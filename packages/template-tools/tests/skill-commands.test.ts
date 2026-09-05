import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// A pure-content skill's one remaining failure mode is instructing an agent
// to run a command that doesn't exist — there's no validator left in the
// skill itself to catch that at generation time, only this test.
const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SKILL_MD = resolve(REPO_ROOT, "skills/templatical-email/SKILL.md");
const BIN_TS = resolve(REPO_ROOT, "packages/template-tools/src/bin.ts");
const LIVE_TS = resolve(
  REPO_ROOT,
  "packages/template-tools/src/cli/commands/live.ts",
);

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
const INVOCATION_RE = new RegExp(
  [
    "npx -y @templatical",
    "/template-tools@\\S+\\s+(\\S+)(?:\\s+(\\S+))?",
  ].join(""),
);

function parseInvocations(skillMd: string): Invocation[] {
  const lines = skillMd.split("\n");
  const invocations: Invocation[] = [];
  for (const line of lines) {
    const match = INVOCATION_RE.exec(line);
    if (!match) continue;
    const [, command, maybeNext] = match;
    invocations.push({
      raw: line.trim(),
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

describe("SKILL.md documented commands", () => {
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

  it("every `npx …` invocation in SKILL.md dispatches to a real command", () => {
    const skill = readFileSync(SKILL_MD, "utf8");
    const invocations = parseInvocations(skill);

    // Non-vacuous: SKILL.md must actually document some commands, or every
    // check below passes on an empty list for the wrong reason.
    expect(invocations.length).toBeGreaterThan(0);

    const invalid = invocations.filter(
      (invocation) => !isValidInvocation(invocation, commands, liveSubcommands),
    );
    expect(
      invalid.map((invocation) => invocation.raw),
      "SKILL.md documents a command (or `live` subcommand) the CLI does not dispatch.",
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
