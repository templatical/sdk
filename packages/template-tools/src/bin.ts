#!/usr/bin/env node
// The CLI entry point.
//
// Every command is a thin shell over this package's library functions; the
// dispatch below owns argument handling, the error→exit-code mapping, and
// nothing else. Human-facing output goes through cli/output.ts.

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

const USAGE = `templatical <command> [options]

  validate <file>                       structural + quality lint
  schema   [--out <file>]               print the block JSON Schema

Options:
  --json                                machine-readable output on stdout
`;

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  setJsonMode(args.json);

  switch (args.command) {
    case "validate":
      return runValidate(args);
    case "schema":
      return runSchema(args);
    case undefined:
    case "help":
    case "--help":
      note(USAGE);
      return args.command === undefined ? EXIT.usage : EXIT.ok;
    default:
      note(`Unknown command "${args.command}".\n\n${USAGE}`);
      return EXIT.usage;
  }
}

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
