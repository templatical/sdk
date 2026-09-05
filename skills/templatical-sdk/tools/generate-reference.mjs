// Stub for skills/templatical-sdk's reference-tree generator.
//
// Not implemented yet. A later task fills this in: importing
// `collectPages` (and `groupOf`) from
// ../../../apps/docs/scripts/build-agent-surface.mjs, copying each English
// docs page verbatim into reference/, writing reference/manifest.json (a
// sha256 per copied file plus the source SDK version), and rewriting
// SKILL.md's generated index between its markers. See
// design-notes/sdk-skill-plan.md, Task 2, for the full spec.
//
// This file exists now only so the root `lint` script can list
// `skills/*/tools` again — ESLint hard-errors on an explicit path matching
// no files, and this package's tools/ directory was otherwise empty.
// Running it fails loudly rather than silently doing nothing, so it can
// never be mistaken for a working generator.
import { pathToFileURL } from "node:url";

/** Not implemented yet — see the module comment above. */
export function generateReference() {
  throw new Error(
    "generate-reference.mjs is a stub and does not generate anything yet " +
      "(design-notes/sdk-skill-plan.md, Task 2).",
  );
}

function main() {
  try {
    generateReference();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
