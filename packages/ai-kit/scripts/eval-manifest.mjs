// Writes eval/MANIFEST.sha256: one `<sha256>  <file>` line per test-set file,
// sorted by file name. Templatical Cloud's `cloud:ai-eval` copies the folder
// and checks every file against this list, so run it after any edit:
//
//   pnpm --filter @templatical/ai-kit run eval:manifest
//
// `--check` exits 1 instead of writing when the committed manifest is stale.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const dir = join(import.meta.dirname, "../eval");
const manifestPath = join(dir, "MANIFEST.sha256");

export function buildManifest(folder = dir) {
  return (
    readdirSync(folder, { recursive: true, withFileTypes: true })
      .filter(
        (entry) => entry.isFile() && /\.(json|png|pdf|html)$/.test(entry.name),
      )
      .map((entry) =>
        relative(folder, join(entry.parentPath, entry.name))
          .split(sep)
          .join("/"),
      )
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
        "MANIFEST.sha256 is stale. Run: pnpm --filter @templatical/ai-kit run eval:manifest",
      );
      process.exit(1);
    }
  } else {
    writeFileSync(manifestPath, manifest);
    console.log(`MANIFEST.sha256: ${manifest.trim().split("\n").length} files`);
  }
}
