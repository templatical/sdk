import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A worker killed mid-test (pnpm stops the other packages with SIGTERM when
// one fails) never reaches `afterEach`, so a temp dir made next to the test
// file stays in the source tree, where `git add -A` picks it up. Temp dirs go
// under `tmpdir()` (or the gitignored `node_modules/.cache`).
describe("test temp directories", () => {
  it("are never created inside the source tree", () => {
    const offenders = readdirSync(import.meta.dirname)
      .filter((name) => name.endsWith(".ts"))
      .flatMap((name) => {
        const source = readFileSync(join(import.meta.dirname, name), "utf8");
        return [...source.matchAll(/mkdtemp(?:Sync)?\(([^;]*?)\);/g)]
          .filter(([, arg]) => /import\.meta\.dirname|__dirname/.test(arg))
          .map(([call]) => `${name}: ${call.replace(/\s+/g, " ")}`);
      });
    expect(offenders).toEqual([]);
  });
});
