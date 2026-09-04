import { flagValue, type ParsedArgs } from "../args";
import { emit, note } from "../output";
import { EXIT, writeTemplateFile } from "../io";
import { schema } from "../../index";

export function runSchema(args: ParsedArgs): number {
  const out = flagValue(args, "out", "o");
  if (out) {
    // writeTemplateFile JSON-stringifies with the same shape this command
    // wrote by hand, and creates the parent directory as a side effect.
    const path = writeTemplateFile(out, schema);
    // stdout stays empty: the caller asked for a file, and under --json a path
    // string would not be the document they are parsing for.
    note(`Wrote ${path}`);
    return EXIT.ok;
  }
  emit(schema, () => JSON.stringify(schema, null, 2));
  return EXIT.ok;
}
