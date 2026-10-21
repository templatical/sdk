import type { Operation, TemplateContent } from "@templatical/types";
import { applyOperations, OperationError } from "@templatical/types";
import { flagValue, type ParsedArgs } from "../args";
import { emit } from "../output";
import {
  EXIT,
  InvalidTemplateError,
  readTemplateFile,
  UsageError,
  writeTemplateFile,
} from "../io";
import { validateTemplate } from "../../index";

function parseOperations(args: ParsedArgs, cwd: string): unknown[] {
  const inline = flagValue(args, "op");
  const batchFile = flagValue(args, "ops");
  // !== undefined, not truthy: flagValue returns "" for an explicitly-empty
  // flag, and a truthy check would let --op "" --ops <file> silently run the
  // batch instead of reporting that both were passed.
  if (inline !== undefined && batchFile !== undefined) {
    throw new UsageError("Pass either --op or --ops, not both.");
  }
  if (inline) {
    try {
      return [JSON.parse(inline) as unknown];
    } catch (err) {
      throw new UsageError(`--op is not valid JSON: ${(err as Error).message}`);
    }
  }
  if (batchFile) {
    const parsed = readTemplateFile(batchFile, cwd);
    if (!Array.isArray(parsed)) {
      throw new UsageError("--ops must point at a JSON array of operations.");
    }
    return parsed;
  }
  throw new UsageError(
    "edit needs --op '<json>' for one operation or --ops <file> for a batch.",
  );
}

/** An object written in the old vocabulary: `{"operation": …, "data": …}`. */
function isOldVocabulary(input: unknown): boolean {
  return (
    typeof input === "object" &&
    input !== null &&
    "operation" in input &&
    !("op" in input)
  );
}

export function runEdit(args: ParsedArgs): number {
  const file = args.positional[0];
  if (!file) throw new UsageError("edit needs a template file.");
  const cwd = flagValue(args, "cwd") ?? process.cwd();

  const operations = parseOperations(args, cwd);
  const oldIndex = operations.findIndex(isOldVocabulary);
  if (oldIndex !== -1) {
    throw new UsageError(
      `Operation ${oldIndex + 1} uses the old {"operation", "data"} form. ` +
        'Write {"op": "updateBlock", "blockId": …, "set": {…}} and the like: ' +
        "see the operations reference.",
    );
  }
  const before = readTemplateFile(file, cwd) as TemplateContent;

  // All or nothing: the engine throws at the first refused operation and
  // nothing is written. A working file has one writer, so there are no locks.
  let content: TemplateContent;
  try {
    content = applyOperations(before, operations as Operation[]);
  } catch (error) {
    if (!(error instanceof OperationError)) throw error;
    const refused = operations[error.opIndex] as { op?: unknown } | undefined;
    throw new UsageError(
      `Operation ${error.opIndex + 1} (${String(refused?.op)}) was refused: ${error.code} — ${error.message}`,
    );
  }

  // An operation can produce a structurally invalid document, so validate
  // before writing: the working file must always be valid.
  const { valid, errors } = validateTemplate(content);
  if (!valid) {
    throw new InvalidTemplateError(
      `The edited template is not structurally valid (${errors.length} error(s)); ${file} was not written.`,
      errors,
    );
  }

  const path = writeTemplateFile(file, content, cwd);
  emit(
    { applied: operations.length, file: path },
    () => `Applied ${operations.length} operation(s) to ${path}`,
  );
  return EXIT.ok;
}
