// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import "./dom-stubs";

import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { computed, createApp, defineComponent, h, ref } from "vue";
import MediaLibraryModal from "../src/components/MediaLibraryModal.vue";
import { PLAN_CONFIG_KEY } from "../src/keys";
import { useMediaCategories } from "../src/composables/useMediaCategories";

/**
 * Guards how `MediaLibraryModal` reaches its host's `authManager`, `projectId`
 * and `planConfig`.
 *
 * Vue matches injection keys by **identity**, so a bare-string
 * `inject("authManager")` never resolves the `AUTH_MANAGER_KEY = Symbol(...)`
 * that `@templatical/editor` provides — it yields `undefined`, and the library
 * opens and does nothing with no error to trace. The three therefore travel as
 * props, which makes `vue-tsc` fail the editor's typecheck when a binding is
 * dropped.
 *
 * These cases cover the half a type cannot: that nobody reintroduces a
 * string-keyed injection, and that the one remaining intra-package hop goes
 * through the single exported key.
 */

const SRC = join(import.meta.dirname, "..", "src");

function listSourceFiles(): string[] {
  const entries = readdirSync(SRC, { recursive: true, withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".ts") || entry.name.endsWith(".vue")) &&
        !entry.name.endsWith(".d.ts"),
    )
    .map((entry) =>
      relative(SRC, join(entry.parentPath ?? SRC, entry.name))
        .split(sep)
        .join("/"),
    )
    .sort();
}

/**
 * Comments are stripped before matching. Both surviving mentions of the old
 * string keys are prose explaining why they are gone — an audit that counted
 * those would be unable to describe its own subject.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\/.*$/gm, "");
}

function filesMatching(pattern: RegExp): string[] {
  return FILES.filter((relPath) =>
    pattern.test(stripComments(readFileSync(join(SRC, relPath), "utf8"))),
  ).sort();
}

const FILES = listSourceFiles();

function createPlanConfig(mediaConfig: unknown = null) {
  return {
    config: ref({ media: mediaConfig, storage: {} }),
    isLoading: ref(false),
    hasFeature: vi.fn(() => false),
    features: computed(() => null),
    fetchConfig: vi.fn(),
  };
}

describe("cross-package injection audit", () => {
  it("source tree was discovered (sanity check)", () => {
    expect(FILES.length).toBeGreaterThan(15);
  });

  it.each(["authManager", "projectId", "planConfig"])(
    'no source file injects "%s" as a string key',
    (name) => {
      expect(filesMatching(new RegExp(`inject[^\\n]*\\(["']${name}["']`))).toEqual(
        [],
      );
    },
  );

  it("only the two host components provide PLAN_CONFIG_KEY", () => {
    expect(filesMatching(/provide\(\s*PLAN_CONFIG_KEY/)).toEqual([
      "components/MediaLibraryModal.vue",
      "standalone/MediaLibrary.vue",
    ]);
  });

  it("MediaLibraryModal declares the three as required props", () => {
    const props = MediaLibraryModal.props as Record<
      string,
      { required?: boolean }
    >;
    expect(Object.keys(props).sort()).toEqual([
      "accept",
      "authManager",
      "planConfig",
      "popoverTarget",
      "projectId",
      "visible",
    ]);
    expect(props.authManager.required).toBe(true);
    expect(props.projectId.required).toBe(true);
    expect(props.planConfig.required).toBe(true);
  });
});

describe("useMediaCategories plan-config resolution", () => {
  function run<T>(setup: () => T, planConfig?: unknown): T {
    let result: T;
    const app = createApp(
      defineComponent({
        setup() {
          result = setup();
          return () => h("div");
        },
      }),
    );
    if (planConfig !== undefined) {
      app.provide(PLAN_CONFIG_KEY, planConfig as never);
    }
    app.mount(document.createElement("div"));
    app.unmount();
    return result!;
  }

  it("resolves the plan config through PLAN_CONFIG_KEY", () => {
    const { maxFileSize } = run(
      () => useMediaCategories(),
      createPlanConfig({ max_file_size: 4242, categories: {} }),
    );
    expect(maxFileSize.value).toBe(4242);
  });

  it("throws a named error when no host provided one", () => {
    expect(() => run(() => useMediaCategories())).toThrow(
      /needs a plan config in scope/,
    );
  });

  it("a string-keyed provide does NOT satisfy it", () => {
    // The positive control for the whole bug: providing under the old string key
    // must leave the composable unsatisfied, or this audit proves nothing.
    let error: unknown = null;
    const app = createApp(
      defineComponent({
        setup() {
          try {
            useMediaCategories();
          } catch (caught) {
            error = caught;
          }
          return () => h("div");
        },
      }),
    );
    app.provide("planConfig", createPlanConfig({ max_file_size: 1 }));
    app.mount(document.createElement("div"));
    app.unmount();
    expect((error as Error | null)?.message).toMatch(
      /needs a plan config in scope/,
    );
  });
});
