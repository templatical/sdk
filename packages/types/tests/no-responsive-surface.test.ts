import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `ResponsiveStyles` / `BlockStyles.responsive` was a typed + documented
 * surface that nothing ever consumed — the renderer never read it and the
 * editor preview never applied it (issue #146). It was removed rather than
 * implemented, because per-breakpoint padding is low-value and fragile for
 * email (Outlook ignores media queries; MJML auto-stacks columns already).
 *
 * This guard fails if the dead surface is reintroduced. If a future change
 * deliberately implements responsive overrides end-to-end (types + renderer
 * + editor preview), delete this test in the same PR and add real coverage.
 */

const SRC = join(import.meta.dirname, "..", "src");

function read(relPath: string): string {
  return readFileSync(join(SRC, relPath), "utf8");
}

describe("no responsive style surface", () => {
  it("BlockStyles does not declare a `responsive` field", () => {
    const blocks = read("blocks.ts");
    expect(blocks).not.toMatch(/responsive\??\s*:/);
    expect(blocks).not.toContain("ResponsiveStyles");
  });

  it("the package barrel does not export `ResponsiveStyles`", () => {
    const index = read("index.ts");
    expect(index).not.toContain("ResponsiveStyles");
  });
});
