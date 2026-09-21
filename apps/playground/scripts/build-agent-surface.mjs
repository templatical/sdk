import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SCENES } from "../src/scenes/index.ts";
import { buildOutputs } from "./agent-surface-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(HERE, "..", "public");

function main() {
  const { index, pages } = buildOutputs(SCENES);
  mkdirSync(join(PUBLIC_DIR, "scenes"), { recursive: true });
  writeFileSync(join(PUBLIC_DIR, "llms.txt"), index);
  for (const [rel, body] of Object.entries(pages)) {
    writeFileSync(join(PUBLIC_DIR, rel), body);
  }
  process.stdout.write(
    `Wrote public/llms.txt and ${Object.keys(pages).length} scene markdown page(s)\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
