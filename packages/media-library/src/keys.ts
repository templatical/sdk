import type { InjectionKey, Ref } from "vue";

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
