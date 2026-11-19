// Writes tests/fixtures/operations/MANIFEST.sha256: one `<sha256>  <file>`
// line per fixture, sorted by file name. Run it after any fixture edit so the
// manifest continues to check the exact fixture set:
//
//   pnpm --filter @templatical/types run fixtures:manifest
//
// `--check` exits 1 instead of writing when the committed manifest is stale.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "../tests/fixtures/operations");
const manifestPath = join(dir, "MANIFEST.sha256");

export function buildManifest(folder = dir) {
  return (
    readdirSync(folder)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => {
        const hash = createHash("sha256")
          .update(readFileSync(join(folder, file)))
          .digest("hex");
        return `${hash}  ${file}`;
      })
      .join("\n") + "\n"
  );
}

if (process.argv[1] === import.meta.filename) {
  const manifest = buildManifest();
  if (process.argv.includes("--check")) {
    const committed = readFileSync(manifestPath, "utf8");
    if (committed !== manifest) {
      console.error(
        "MANIFEST.sha256 is stale. Run: pnpm --filter @templatical/types run fixtures:manifest",
      );
      process.exit(1);
    }
  } else {
    writeFileSync(manifestPath, manifest);
    console.log(
      `MANIFEST.sha256: ${manifest.trim().split("\n").length} fixtures`,
    );
  }
}
