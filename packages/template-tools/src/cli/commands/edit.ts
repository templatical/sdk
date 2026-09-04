import type {
  TemplateContent,
  TemplateOperationPayload,
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
import { applyOperation, validateTemplate } from "../../index";

/** What a caller supplies; `timestamp` is ours to fill. */
interface OperationInput {
  operation: TemplateOperationPayload["operation"];
  data?: Record<string, unknown>;
}

function parseOperations(args: ParsedArgs, cwd: string): OperationInput[] {
  const inline = flagValue(args, "op");
  const batchFile = flagValue(args, "ops");
  if (inline && batchFile) {
    throw new UsageError("Pass either --op or --ops, not both.");
  }
  if (inline) {
    try {
      return [JSON.parse(inline) as OperationInput];
    } catch (err) {
      throw new UsageError(`--op is not valid JSON: ${(err as Error).message}`);
    }
  }
  if (batchFile) {
    const parsed = readTemplateFile(batchFile, cwd);
    if (!Array.isArray(parsed)) {
      throw new UsageError("--ops must point at a JSON array of operations.");
    }
    return parsed as OperationInput[];
  }
  throw new UsageError(
    "edit needs --op '<json>' for one operation or --ops <file> for a batch.",
  );
}

export function runEdit(args: ParsedArgs): number {
  const file = args.positional[0];
  if (!file) throw new UsageError("edit needs a template file.");
  const cwd = flagValue(args, "cwd") ?? process.cwd();

  const operations = parseOperations(args, cwd);
  let content = readTemplateFile(file, cwd) as TemplateContent;

  // All-or-nothing: applyOperation returns the unchanged input on rejection, so
  // stopping at the first failure and discarding needs no rollback. Nothing is
  // written until every operation has succeeded.
  for (const [index, input] of operations.entries()) {
    const result = applyOperation(content, {
      operation: input.operation,
      data: input.data ?? {},
      timestamp: Date.now(),
    });
    if (!result.ok) {
      throw new UsageError(
        `Operation ${index + 1} (${String(input.operation)}) was rejected: ${result.error}`,
      );
    }
    content = result.content;
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
