import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("all CI Playwright images and the mirror match the lockfile resolution", () => {
  const read = (rel: string) =>
    readFileSync(join(import.meta.dirname, "../../..", rel), "utf8");
  const lock = read("pnpm-lock.yaml");
  const version = lock.match(
    /'@playwright\/test':\n\s+specifier: [^\n]+\n\s+version: (\d+\.\d+\.\d+)/,
  )?.[1];
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  const tags = [
    ...read(".github/workflows/ci.yml").matchAll(
      /image:\s*[^\s]+playwright:(v[^\s]+)/g,
    ),
  ].map((m) => m[1]);
  expect(tags).toHaveLength(3);
  const mirror = read(".github/workflows/mirror-playwright.yml").match(
    /TAG:\s*(v[^\s]+)/,
  )?.[1];
  expect([...tags, mirror]).toEqual(Array(4).fill(`v${version}-jammy`));
});
