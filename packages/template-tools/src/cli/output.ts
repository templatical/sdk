// The ONLY module in this package that writes to stdout.
//
// `--json` promises callers exactly one parseable document on stdout, and a
// future stdio-based caller — an MCP server reserving stdout for JSON-RPC —
// would need that to hold just as strictly. Either way a second writer
// breaks the contract. tests/cli-output-discipline.test.ts asserts no other
// source file touches stdout.

let jsonMode = false;

export function setJsonMode(on: boolean): void {
  jsonMode = on;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

/**
 * Emit a command's result. Under `--json` the payload is serialized; otherwise
 * `human()` is called for the readable form — as a thunk, so building the
 * pretty output costs nothing in JSON mode.
 */
export function emit(payload: unknown, human: () => string): void {
  process.stdout.write(
    jsonMode ? `${JSON.stringify(payload)}\n` : `${human()}\n`,
  );
}

/** Diagnostics, progress and errors. Always stderr, in both modes. */
export function note(message: string): void {
  process.stderr.write(`${message}\n`);
}
