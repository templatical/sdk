import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const read = (p: string) => readFileSync(resolve(REPO_ROOT, p), "utf8");

/** Commands-table rows in the router: `| `mode` | … | [reference/x.md](…) |`. */
function routerModes(): string[] {
  const src = read("skills/templatical/SKILL.md");
  return [...src.matchAll(/^\|\s*`([a-z0-9-]+)`\s*\|/gm)].map(([, mode]) => mode);
}

/** Bold-led bullets in a docs page's mode list. */
function pageModes(page: string): string[] {
  return [...read(page).matchAll(/^- \*\*([^*]+)\*\*/gm)].map(([, label]) => label);
}

/**
 * Counted rather than matched by name: the page uses prose labels ("Preview it
 * live") where the router uses mode names ("live"), so a name-for-name check
 * would need a hand-maintained mapping that is itself a drift surface. A count
 * catches the realistic failure — a mode added to or removed from the router
 * without the public page following.
 *
 * The router's count is asserted non-zero in each case, and that is what keeps
 * the page assertions honest: a page regex that silently matched nothing would
 * otherwise agree with a router regex that silently matched nothing. With the
 * router pinned above zero, an empty page list fails.
 *
 * One case per locale, because a shared case stops at the first failure and the
 * German mirror is the likelier drift site — docs have no CI parity check, so it
 * must be named in the report rather than hidden behind English passing.
 */
describe("the docs page tracks the router's mode list", () => {
  it("lists one English bullet per Commands-table row", () => {
    const expected = routerModes().length;
    expect(expected).toBeGreaterThan(0);
    expect(pageModes("apps/docs/guide/agent-skill.md")).toHaveLength(expected);
  });

  it("lists one German bullet per Commands-table row", () => {
    const expected = routerModes().length;
    expect(expected).toBeGreaterThan(0);
    expect(pageModes("apps/docs/de/guide/agent-skill.md")).toHaveLength(expected);
  });
});
