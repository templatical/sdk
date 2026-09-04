//
// Optional dependencies must resolve from the CONSUMER'S cwd, not from this
// module's location. When the CLI runs via npx it lives in npm's cache, so a
// package the user installs in their own project is invisible to the CLI's own
// resolution — and the remediation message ("npm install mjml") would be
// impossible to satisfy. Anchoring a createRequire at the cwd fixes that; the
// CLI's own resolution stays as a fallback so declared dependencies still work
// from any directory.
//
// Returning null instead of throwing lets callers distinguish "not installed"
// (exit 3, name the install command) from "installed but broken" (a real error
// worth surfacing). Same discipline as tryLoadRenderer() in
// packages/editor/src/utils/toMjml.ts.

import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export async function resolveOptional<T>(
  specifier: string,
  cwd: string = process.cwd(),
): Promise<T | null> {
  const candidates: Array<() => string> = [
    () =>
      createRequire(pathToFileURL(join(cwd, "package.json"))).resolve(
        specifier,
      ),
    () => createRequire(import.meta.url).resolve(specifier),
  ];

  for (const candidate of candidates) {
    let resolved: string;
    try {
      resolved = candidate();
    } catch {
      continue; // not resolvable from here — try the next anchor
    }
    return (await import(pathToFileURL(resolved).href)) as T;
  }
  return null;
}
