import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderConfig } from "../src/config/render";

// `import.meta.url` is not a usable `file:` base in this environment, so
// paths resolve through `import.meta.dirname` instead — the same pattern
// `e2e-import-boundary.test.ts` and this package's `vitest.config.ts` use.
const SHELL_SOURCE = readFileSync(
  join(import.meta.dirname, "../src/shell/CapabilityShell.vue"),
  "utf8",
);
const PANE_SOURCE = readFileSync(
  join(import.meta.dirname, "../src/shell/ConfigPane.vue"),
  "utf8",
);
const EDITOR_SOURCE = readFileSync(
  join(import.meta.dirname, "../src/shell/useCapabilityEditor.ts"),
  "utf8",
);

describe("the Config pane's rendered source", () => {
  /**
   * The composite shape the pane actually receives: the shell's `container`
   * element, a provider carrying both a literal `false` and a live function,
   * and the template content. Each of the three prints through a different
   * branch of `renderConfig`, and the panel is only trustworthy if all three
   * survive together.
   */
  it("renders the shell's real init() argument shape", () => {
    const out = renderConfig({
      container: document.createElement("div"),
      content: { blocks: [], settings: { width: 600 } },
      savedBlocks: {
        create: false,
        list: async () => [],
      },
    });

    expect(out).toContain("container: /* HTMLDivElement */");
    expect(out).not.toContain("container: {}");
    expect(out).toContain("create: false");
    expect(out).toContain("list: async () =>");
    expect(out).toContain("width: 600");
    expect(out).not.toContain("[object");
  });

  it("prints a container that is not a div by its own constructor name", () => {
    const out = renderConfig({ container: document.createElement("section") });
    expect(out).toBe("{\n  container: /* HTMLElement */\n}");
  });
});

describe("ConfigPane renders through renderConfig", () => {
  it("takes the config object the shell captured", () => {
    expect(PANE_SOURCE).toContain("config: object | null");
  });

  it("renders renderConfig's output into the config-source testid", () => {
    expect(PANE_SOURCE).toContain("renderConfig(");
    expect(PANE_SOURCE).toContain('data-testid="capability-config-source"');
  });

  it("carries an empty state for the window before the first init() resolves", () => {
    expect(PANE_SOURCE).toContain('data-testid="capability-config-empty"');
  });
});

/**
 * The guard the Config tab exists for: the panel must render the object the
 * editor was handed, not a second one built to look like it. A rebuilt copy
 * is free to drift — a key added at the `init()` call site and forgotten at
 * the display site would leave the panel confidently wrong.
 *
 * The `init()` call and the capture live in `useCapabilityEditor.ts`; the
 * shell supplies the builder and routes the captured object to the pane, so
 * the guarantee spans both files and is asserted against both.
 */
describe("the shell hands init() and the panel the same object", () => {
  it("passes the built local to init() rather than an inline literal", () => {
    expect(EDITOR_SOURCE).toContain("await init(config)");
    expect(EDITOR_SOURCE).not.toContain("await init({");
  });

  it("keeps that same local in lastInitConfig", () => {
    expect(EDITOR_SOURCE).toContain("lastInitConfig.value = config;");
  });

  it("writes lastInitConfig only after the staleness guard, so a superseded init never reaches the panel", () => {
    const guard = EDITOR_SOURCE.indexOf("token !== requestToken");
    const write = EDITOR_SOURCE.indexOf("lastInitConfig.value = config;");
    expect(guard).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(guard);
  });

  it("builds that object in the shell, from the capability registry", () => {
    // The builder is a callback so the composable knows nothing about
    // capabilities; the shell is where the config's keys are decided.
    expect(SHELL_SOURCE).toContain("useCapabilityEditor((container) => ({");
    expect(SHELL_SOURCE).toContain("...buildAllCapabilityConfig(");
  });

  it("hands lastInitConfig to the pane", () => {
    // Through `paneProps`, which every tab's component is bound with — the
    // pane is `<component :is>` off the tab table rather than a `v-if` chain.
    expect(SHELL_SOURCE).toContain("config: lastInitConfig.value,");
    expect(SHELL_SOURCE).toContain('v-bind="paneProps"');
  });
});
