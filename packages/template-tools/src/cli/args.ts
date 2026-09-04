// Argv parsing for the CLI. Deliberately hand-rolled: the package has no
// runtime dependency for this, and the surface is a dozen flags.

/** Flags that consume the next argv entry as their value. */
const VALUE_FLAGS = new Set([
  "format",
  "out",
  "o",
  "op",
  "ops",
  "file",
  "port",
  "cwd",
]);

export interface ParsedArgs {
  command?: string;
  /** Everything that is not the command and not a flag — including subcommands. */
  positional: string[];
  json: boolean;
  flags: Record<string, string | true>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("-")) {
      positional.push(arg);
      continue;
    }

    const bare = arg.replace(/^--?/, "");
    const eq = bare.indexOf("=");
    if (eq !== -1) {
      flags[bare.slice(0, eq)] = bare.slice(eq + 1);
      continue;
    }
    if (bare === "json") {
      json = true;
      continue;
    }
    // A value flag at the end of argv has no value; record it as present so the
    // command reports a useful usage error rather than reading `undefined`.
    flags[bare] =
      VALUE_FLAGS.has(bare) && i + 1 < argv.length ? argv[++i] : true;
  }

  return { command: positional.shift(), positional, json, flags };
}

/** Read a value flag as a string, or undefined when absent or valueless. */
export function flagValue(
  args: ParsedArgs,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const v = args.flags[name];
    if (typeof v === "string") return v;
  }
  return undefined;
}
