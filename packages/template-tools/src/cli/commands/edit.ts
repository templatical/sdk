import type { Operation, TemplateContent } from "@templatical/types";
import {
  applyOperationsInPlace,
  createSetDefaultLocaleOperation,
  OperationError,
  safeClone,
} from "@templatical/types";
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
import { readDefinitions } from "../definitions";

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

/** Whether an engine message already names the block, as `Block "<id>"`, `block with id "<id>"` or `section "<id>"`. */
function namesBlock(message: string, blockId: string): boolean {
  const id = blockId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b(?:[Bb]lock(?: with id)?|[Ss]ection) "${id}"`).test(
    message,
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
  const definitions = readDefinitions(args, cwd);

  // All or nothing: the engine throws at the first refused operation and
  // nothing is written. A working file has one writer, so there are no locks.
  const content = safeClone(before);
  let opIndex = 0;
  try {
    for (const raw of operations as Operation[]) {
      const op =
        raw?.op === "setDefaultLocale" && raw.customTextFields === undefined
          ? createSetDefaultLocaleOperation(content, raw.locale, definitions)
          : raw;
      applyOperationsInPlace(content, [op]);
      opIndex++;
    }
  } catch (error) {
    if (!(error instanceof OperationError)) throw error;
    const refused = operations[opIndex] as { op?: unknown } | undefined;
    // `blockId` is the block the refusal concerns, for example the first one
    // hidden in a language that can't become the default.
    throw new UsageError(
      `Operation ${opIndex + 1} (${String(refused?.op)}) was refused: ${error.code} — ${error.message}` +
        (error.blockId === undefined || namesBlock(error.message, error.blockId)
          ? ""
          : ` Block: "${error.blockId}".`),
    );
  }

  // An operation can produce a structurally invalid document, so validate
  // before writing: the working file must always be valid.
  const { valid, errors } = validateTemplate(content, definitions);
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
