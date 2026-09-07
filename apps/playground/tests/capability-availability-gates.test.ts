import { describe, expect, it } from "vitest";
import { createApp, defineComponent, effectScope, h, ref } from "vue";
import type { Template, TemplateContent } from "@templatical/types";
import {
  buildAllCapabilityConfig,
  capabilities,
  capabilityById,
} from "../src/config/capabilities";
import { PLAYGROUND_USER } from "../src/providers/identity";
import { type TemplateOption } from "../src/templates";
import { resolveFixture } from "../src/shell/useCapabilityFixture";
// These four composables are `@templatical/editor` internals with no public
// export — `packages/editor/src/index.ts` exposes only `init`/`initCloud`/
// `unmount` — so this reaches their source directly rather than through the
// package specifier, which this app's `vitest.config.ts` deliberately
// resolves to `dist/` for every other `@templatical/*` import. The
// `@templatical/core` and `@templatical/types` imports each of these files
// makes still resolve correctly under that: Vite's resolver walks node_modules
// up from the *importing file's own location*, and `packages/editor/node_modules`
// carries real symlinks for both — verified directly before writing this file.
import { useCommentsFeature } from "../../../packages/editor/src/composables/useCommentsFeature";
import { useTemplatesFeature } from "../../../packages/editor/src/composables/useTemplatesFeature";
import { useVersionHistoryFeature } from "../../../packages/editor/src/composables/useVersionHistoryFeature";
import { useSavedBlocksFeature } from "../../../packages/editor/src/composables/useSavedBlocksFeature";

const CONTENT = { blocks: [], settings: {} } as unknown as TemplateContent;
const ADOPTED: Template = {
  id: "adopted-1",
  name: "Adopted",
  content: CONTENT,
};

/**
 * The shell's own fixture resolution, imported rather than restated — a second
 * copy of the `?? templates[0]` fallback is free to drift from the one the
 * shell actually runs.
 */
function fixtureFor(capabilityId: string): TemplateOption {
  return resolveFixture(capabilityById(capabilityId)!.fixture);
}

/**
 * Run `setup` inside a real (if throwaway) component instance, so a
 * composable that calls `provide()` — `useSavedBlocksFeature` is the one
 * feature composable in this file that does — has somewhere to attach it.
 * The established pattern for this (CLAUDE.md → Mocking patterns), used
 * as-is by `useMergeTag`/`useMediaCategories`/`useMediaPicker`/`useI18n`'s
 * own tests; needs no `@vue/test-utils`, which this app doesn't have.
 */
function withProvide<T>(setup: () => T): T {
  let result!: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h("div");
      },
    }),
  );
  app.mount(document.createElement("div"));
  app.unmount();
  return result;
}

/**
 * Every capability id with a case below. Kept beside the cases so adding one
 * without the other is the thing that fails.
 */
const GATED_CAPABILITY_IDS = [
  "comments",
  "templates",
  "version-history",
  "saved-blocks",
];

/**
 * Capabilities that set a plain `init()` key from a control and wrap no
 * provider at all: there is no feature composable to construct and so no
 * `isAvailable`/`hasTemplate` gate to satisfy — the editor always mounts
 * whatever `shadowDom.mode` resolves to, the same way it always mounts
 * whatever `theme` or `locale` resolve to. Listed here, beside
 * `GATED_CAPABILITY_IDS`, so the registry-pairing case below still accounts
 * for every registered id rather than only the gated ones.
 */
const BACKEND_FREE_CAPABILITY_IDS = ["shadow-dom"];

/**
 * Every capability whose editor-side feature composable can be constructed
 * directly (no Vue mount needed) is fed the REAL config the shell would
 * build for its own fixture — `buildAllCapabilityConfig`'s output, exactly
 * as `CapabilityShell.vue` builds it — plus a hand-built editor-state stub
 * simulating a template already adopted. `isAvailable`/`hasTemplate` are
 * genuine UI gates (`EditorHeader.vue` reads both, e.g.
 * `comments?.isAvailable.value && comments.hasTemplate.value` for the
 * comments trigger), so this is what stands between "the config looks
 * right" and "the capability actually lights up" once the editor mounts it.
 *
 * This is the guard that would have caught the two bugs CLAUDE.md's BYO
 * templates/comments work already fixed in this shell: templates with no
 * template attached (Save permanently disabled) and comments with no
 * `user` (trigger absent, not disabled). Both are fixed; this is what stops
 * a third capability — or a regression in these two — from shipping the
 * same way.
 */
describe("every capability's editor-side availability gate is satisfied by the shell's real config", () => {
  it("comments: available with the shell's user, and has a template once one is adopted", () => {
    const fixture = fixtureFor("comments");
    const config = buildAllCapabilityConfig({}, fixture);
    const scope = effectScope();
    const feature = scope.run(() =>
      useCommentsFeature({
        provider: config.comments!,
        editor: { state: { template: { id: ADOPTED.id } } },
        // The shell's own key (`CapabilityShell.vue`'s `user: PLAYGROUND_USER`),
        // not a hand-typed identity — an absent `user` is exactly the bug this
        // guard exists to catch (comments' `isAvailable` requires one).
        user: PLAYGROUND_USER,
      }),
    )!;

    expect(feature.isAvailable.value).toBe(true);
    expect(feature.hasTemplate.value).toBe(true);
    scope.stop();
  });

  it("templates: available, and has a template once one is adopted", () => {
    const fixture = fixtureFor("templates");
    const config = buildAllCapabilityConfig({}, fixture);
    const scope = effectScope();
    const feature = scope.run(() =>
      useTemplatesFeature({
        provider: config.templates!,
        editor: {
          state: {
            template: { id: ADOPTED.id, name: ADOPTED.name },
            isDirty: false,
            isSaving: false,
          },
          setName: () => {},
          create: async () => ADOPTED,
          load: async () => ADOPTED,
          save: async () => ADOPTED,
          hasTemplate: () => true,
        },
      }),
    )!;

    expect(feature.isAvailable.value).toBe(true);
    expect(feature.hasTemplate.value).toBe(true);
    scope.stop();
  });

  it("versionHistory: available, and has a template once one is adopted", () => {
    const fixture = fixtureFor("version-history");
    const config = buildAllCapabilityConfig({}, fixture);
    const scope = effectScope();
    const feature = scope.run(() =>
      useVersionHistoryFeature({
        provider: config.versionHistory!,
        editor: {
          state: { template: { id: ADOPTED.id }, isDirty: false },
          content: ref(CONTENT),
          setContent: () => {},
        },
        // Untouched by availability/hasTemplate — restore and preview-step
        // are what read these, and neither runs in this test.
        history: { clear: () => {} } as never,
        conditionPreview: { reset: () => {} } as never,
        autoSave: { pause: () => {}, resume: () => {} } as never,
      }),
    )!;

    expect(feature.isAvailable.value).toBe(true);
    expect(feature.hasTemplate.value).toBe(true);
    scope.stop();
  });

  it("savedBlocks: available — the one capability with no hasTemplate gate, since insertion only touches the canvas", () => {
    const fixture = fixtureFor("saved-blocks");
    const config = buildAllCapabilityConfig({}, fixture);
    const feature = withProvide(() =>
      useSavedBlocksFeature({
        provider: config.savedBlocks!,
        editor: { addBlock: () => {}, state: { previewMode: false } },
      }),
    );

    expect(feature.isAvailable.value).toBe(true);
  });

  /**
   * The cases above are hand-written, one per capability, because each feature
   * composable takes a different structural stub. Nothing about that ties the
   * case count to the registry — so this asserts the pairing directly.
   *
   * It exists because this whole file was written after two capabilities
   * shipped silently dead in the shell: templates with no template attached
   * (Save permanently disabled) and comments with no `user` (the trigger
   * absent, not disabled). Both rendered normally while doing nothing. A new
   * capability registered without a case here would be the third, and every
   * assertion above would still pass.
   *
   * Failing loudly on registration forces a decision rather than granting
   * silence by omission — the same job as the `_SavedBlocksOptionsForwarded`
   * and `_TestEmailOptionsForwarded` compile-time exhaustiveness checks in
   * `createCloudRuntime.ts`.
   */
  it("has a case for every registered capability, gated or named backend-free", () => {
    expect(capabilities.map((c) => c.id).sort()).toEqual(
      [...GATED_CAPABILITY_IDS, ...BACKEND_FREE_CAPABILITY_IDS].sort(),
    );
  });

  it("shadow-dom has no editor-side availability gate: it wraps no provider", () => {
    const def = capabilityById("shadow-dom")!;
    expect(def.implFor).toBeUndefined();
  });
});
