import type { InjectionKey, Ref } from "vue";
import type { UsePlanConfigReturn } from "@templatical/core/cloud";

/**
 * The active plan's config, for the media limits every surface in this package
 * reads: accepted MIME types, `max_file_size`, the storage gauge.
 *
 * **Provided by whichever component roots the tree** — `MediaLibraryModal` from
 * its `planConfig` prop, `standalone/MediaLibrary.vue` from its own — and
 * consumed by `useMediaCategories`, which five descendants call. It is a
 * provide rather than prop-drilling *only* because of that depth; the values
 * themselves cross the package boundary as props.
 *
 * That distinction is the whole point of this key existing. Vue matches injection
 * keys by identity, so a bare-string `inject("planConfig")` never resolves the
 * `Symbol` a host provided — it yields `undefined` silently, and the browser is
 * inert with nothing to debug. Props make the cross-package boundary typed; a
 * single exported key makes the intra-package hop impossible to spell two
 * different ways.
 */
export const PLAN_CONFIG_KEY: InjectionKey<UsePlanConfigReturn> = Symbol(
  "templaticalMediaPlanConfig",
);

/**
 * Mount target for modal/overlay teleports inside `MediaLibraryModal` and
 * its nested sub-modals (replace, edit, import URL). Set via the
 * `popoverTarget` prop on `MediaLibraryModal` and provided here so the
 * sub-modals can teleport to the same element.
 *
 * When the ref resolves to `null` (or no provider is in scope, e.g. the
 * standalone visual SDK from `./standalone/visual.ts`), modals fall back
 * to `document.body` — preserving the original teleport behavior.
 *
 * Host integration: editors that mount `MediaLibraryModal` inside a
 * shadow-aware tree should pass their popover root element (e.g.
 * `core.popoverRoot.value`) through the prop so media-library modals land
 * inside the editor's shadow boundary rather than escaping to body.
 */
export const POPOVER_TARGET_KEY: InjectionKey<Ref<HTMLElement | null>> = Symbol(
  "templaticalMediaPopoverTarget",
);
