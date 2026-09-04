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

async function main(argv: string[]): Promise<number> {
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
