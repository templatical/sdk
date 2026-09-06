import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Block, CustomBlock } from "@templatical/types";
import {
  buildAllCapabilityConfig,
  capabilities,
} from "../src/config/capabilities";
import { fixtureCapabilityConfig } from "../src/shell/fixture-config";
import { slugFor } from "../src/providers/template-name";
import { templates, type TemplateOption } from "../src/templates";

// `import.meta.url` is not a usable `file:` base in this environment, so
// paths resolve through `import.meta.dirname` instead — the same pattern
// `config-pane-source.test.ts` and `e2e-import-boundary.test.ts` use.
const SHELL_SOURCE = readFileSync(
  join(import.meta.dirname, "../src/shell/CapabilityShell.vue"),
  "utf8",
);

/**
 * Every block in `blocks`, plus every block nested inside a section's
 * columns — the only place a block nests today. A block's own
 * `displayCondition` and a custom block's `customType` are both readable
 * straight off `BaseBlock`/`CustomBlock`, so no deeper recursion is needed.
 */
function walkBlocks(blocks: Block[]): Block[] {
  const all: Block[] = [];
  for (const block of blocks) {
    all.push(block);
    if (block.type === "section") {
      for (const column of block.children) all.push(...walkBlocks(column));
    }
  }
  return all;
}

/** The same fallback `CapabilityShell.vue`'s own `fixture` computed uses. */
function fixtureFor(fixtureSlug: string): TemplateOption {
  return (
    templates.find((t) => slugFor(t.name) === fixtureSlug) ?? templates[0]
  );
}

/**
 * The config keys that bear on whether a fixture's own content renders
 * correctly: the capability registry's config, plus the fixture-required
 * keys `CapabilityShell.vue` spreads alongside it. `container`/`user`/
 * `content` are left out on purpose — this is about whether a block
 * *renders*, not the editor's identity or its starting content.
 */
function fixtureRenderConfig(fixture: TemplateOption) {
  return {
    ...buildAllCapabilityConfig({}, fixture),
    ...fixtureCapabilityConfig(fixture),
  };
}

/**
 * Every registered capability's fixture must carry the `init()` keys its own
 * content requires, independent of which capability the drawer is
 * demonstrating. `CapabilityShell.vue` cannot be imported here — it is a
 * `.vue` file, and this app has no `@vue/test-utils` to mount one with — so
 * this asserts against `fixtureCapabilityConfig`, the plain module the shell
 * itself builds its config from. A value inlined in the shell's own config
 * builder instead of extracted here would be exactly this untestable, which
 * is how both defects shipped.
 */
describe("every registered capability's fixture gets the config its own content needs", () => {
  it("registers a CustomBlockDefinition for every custom block a fixture embeds", () => {
    const missing: string[] = [];
    for (const capability of capabilities) {
      const fixture = fixtureFor(capability.fixture);
      const config = fixtureRenderConfig(fixture);
      const customTypes = new Set(
        walkBlocks(fixture.create().blocks)
          .filter((b): b is CustomBlock => b.type === "custom")
          .map((b) => b.customType),
      );
      for (const customType of customTypes) {
        const registered =
          config.customBlocks?.some((def) => def.type === customType) ??
          false;
        if (!registered) missing.push(`${capability.id}: "${customType}"`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("supplies non-empty displayConditions config for every fixture that carries a displayCondition block", () => {
    const missing: string[] = [];
    for (const capability of capabilities) {
      const fixture = fixtureFor(capability.fixture);
      const config = fixtureRenderConfig(fixture);
      const hasCondition = walkBlocks(fixture.create().blocks).some(
        (b) => b.displayCondition !== undefined,
      );
      if (!hasCondition) continue;
      // Mirrors `CommonBlockSettings.vue`'s own `hasDisplayConditions` gate:
      // the section renders on either a non-empty catalog or `allowCustom`.
      const supplied =
        (config.displayConditions?.conditions.length ?? 0) > 0 ||
        config.displayConditions?.allowCustom === true;
      if (!supplied) missing.push(capability.id);
    }
    expect(missing).toEqual([]);
  });

  it("finds at least one custom block and one display condition across the registry, so neither assertion above is vacuous", () => {
    const anyCustomBlock = capabilities.some((capability) =>
      walkBlocks(fixtureFor(capability.fixture).create().blocks).some(
        (b) => b.type === "custom",
      ),
    );
    const anyDisplayCondition = capabilities.some((capability) =>
      walkBlocks(fixtureFor(capability.fixture).create().blocks).some(
        (b) => b.displayCondition !== undefined,
      ),
    );
    expect({ anyCustomBlock, anyDisplayCondition }).toEqual({
      anyCustomBlock: true,
      anyDisplayCondition: true,
    });
  });
});

/**
 * Belt-and-suspenders over the two describes above: those prove
 * `fixtureCapabilityConfig` itself returns the right values, but a config
 * builder that computes correctly and a shell that never spreads its result
 * into `init()` are two different bugs. `CapabilityShell.vue` can't be
 * imported to check the second — so this reads it as text, the same way
 * `config-pane-source.test.ts` pins `...buildAllCapabilityConfig(`.
 */
describe("the shell actually wires fixtureCapabilityConfig into its init() config", () => {
  it("spreads fixtureCapabilityConfig's result alongside the capability registry's", () => {
    expect(SHELL_SOURCE).toContain(
      "...fixtureCapabilityConfig(fixture.value)",
    );
  });
});
