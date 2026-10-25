import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, it } from "vitest";

const PACKAGES = join(import.meta.dirname, "../..");

it("keeps internal tracker and slice ids out of package source and JSDoc", () => {
  const violations: string[] = [];
  let files = 0;
  function scan(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "tests" || entry.name === "__tests__") continue;
      if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) continue;
      const file = join(directory, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (entry.isFile()) {
        files++;
        readFileSync(file, "utf8")
          .split("\n")
          .forEach((line, index) => {
            if (/LOC[1-3]|OI-\d+/.test(line)) {
              violations.push(
                `${relative(PACKAGES, file)}:${index + 1}: ${line.trim()}`,
              );
            }
          });
      }
    }
  }
  for (const entry of readdirSync(PACKAGES, { withFileTypes: true })) {
    const source = join(PACKAGES, entry.name, "src");
    if (entry.isDirectory() && existsSync(source)) scan(source);
  }
  expect(files).toBeGreaterThan(0);
  expect(violations).toEqual([]);
});
