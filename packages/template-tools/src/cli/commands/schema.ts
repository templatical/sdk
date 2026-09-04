import { writeFileSync } from "node:fs";
import { flagValue, type ParsedArgs } from "../args";
import { emit, note } from "../output";
import { EXIT, resolveFrom } from "../io";
import { schema } from "../../index";

export function runSchema(args: ParsedArgs): number {
  const out = flagValue(args, "out", "o");
  if (out) {
    const path = resolveFrom(out);
    writeFileSync(path, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
    // stdout stays empty: the caller asked for a file, and under --json a path
    // string would not be the document they are parsing for.
    note(`Wrote ${path}`);
    return EXIT.ok;
  }
  emit(schema, () => JSON.stringify(schema, null, 2));
  return EXIT.ok;
}
