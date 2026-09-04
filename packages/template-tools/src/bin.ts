#!/usr/bin/env node
// The CLI entry point.
//
// Every command is a thin shell over this package's library functions; the
// dispatch below owns argument handling, the error→exit-code mapping, and
// nothing else. Human-facing output goes through cli/output.ts.

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./cli/args";
import { note, setJsonMode } from "./cli/output";
import {
  EXIT,
  InvalidTemplateError,
  MissingDependencyError,
  UsageError,
} from "./cli/io";
import { runSchema } from "./cli/commands/schema";
import { runValidate } from "./cli/commands/validate";
import { runRender } from "./cli/commands/render";
import { runEdit } from "./cli/commands/edit";
import { runImport } from "./cli/commands/import";
import { runList, runLive } from "./cli/commands/live";

const USAGE = `templatical <command> [options]

  validate <file>                       structural + quality lint
  schema   [--out <file>]               print the block JSON Schema
  render   <file> [--format mjml|html] [-o <file>]  render to MJML or HTML
  edit     <file> --op '<json>' | --ops <file>  apply operations, write the result
  import   <file> [--format <fmt>] | --list-formats  convert a design to Templatical JSON
  live     [--file <f>] [--port <n>] [--cwd <d>] [--no-open]
  live reload | live stop
  list                                           working files in .templatical/

Options:
  --json                                machine-readable output on stdout
`;

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  setJsonMode(args.json);

  switch (args.command) {
    case "validate":
      return runValidate(args);
    case "schema":
      return runSchema(args);
    case "render":
      return await runRender(args);
    case "edit":
      return runEdit(args);
    case "import":
      return await runImport(args);
    case "live":
      return await runLive(args);
    case "list":
      return runList(args);
    case "help":
      note(USAGE);
      return EXIT.ok;
    case undefined:
      // parseArgs strips leading dashes into flags, so `--help`/`-h` never
      // reach args.command — they land here, not on a (dead) case "--help".
      // Asking for help is not a usage error; a bare invocation still is.
      if (args.flags.help === true || args.flags.h === true) {
        note(USAGE);
        return EXIT.ok;
      }
      note(USAGE);
      return EXIT.usage;
    default:
      note(`Unknown command "${args.command}".\n\n${USAGE}`);
      return EXIT.usage;
  }
}

// Only self-invoke when run as the CLI entry point, not when imported — this
// package's own tests import `main` directly to exercise the dispatch above
// without spawning a subprocess.
//
// import.meta.url is always a realpath, but process.argv[1] is not: npm's
// `bin` field links a real symlink into the consumer's node_modules/.bin
// (e.g. node_modules/.bin/templatical -> ../@templatical/template-tools/dist/bin.js),
// and Node leaves argv[1] as that symlink path instead of resolving it.
// Comparing them directly is false for every consumer who runs the published
// binary, so main() would silently never run. realpathSync(argv[1]) resolves
// the symlink so both sides name the same file.
export function isEntryPoint(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    return pathToFileURL(realpathSync(argv1)).href === import.meta.url;
  } catch {
    // realpathSync throws (e.g. ENOENT) if argv[1] doesn't exist or can't be
    // read. This guard runs at module load, so failing open into a crash
    // would be worse than just not self-invoking.
    return false;
  }
}

if (isEntryPoint()) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      if (err instanceof InvalidTemplateError) {
        note(err.message);
        for (const e of err.errors) note(`  - ${e}`);
        process.exit(EXIT.invalid);
      }
      if (err instanceof MissingDependencyError) {
        note(err.message);
        process.exit(EXIT.missingDep);
      }
      if (err instanceof UsageError) {
        note(err.message);
        process.exit(EXIT.usage);
      }
      note(`Unexpected error: ${(err as Error)?.message ?? String(err)}`);
      process.exit(EXIT.usage);
    });
}
