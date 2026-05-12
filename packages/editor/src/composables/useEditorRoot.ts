import { inject } from "vue";
import { EDITOR_ROOT_KEY } from "../keys";

/**
 * Returns the editor's effective DOM root — `Document` when mounted in light
 * DOM, `ShadowRoot` when mounted with `shadowDom: true`.
 *
 * Use this instead of reaching for `document` directly when the code is
 * shadow-DOM-aware (focus trap, selection, popover mount, etc.). Both
 * `Document` and `ShadowRoot` expose the same subset of APIs the editor
 * needs (`activeElement`, `getSelection?`, `querySelector`, `appendChild`),
 * so call sites usually don't need to branch.
 *
 * Falls back to `document` if no provider is in scope — keeps headless /
 * test-utility usage working without explicit wiring.
 *
 * Internal — not exported from the package entry.
 */
export function useEditorRoot(): Document | ShadowRoot {
  // When called outside a Vue setup() context (e.g. direct composable
  // invocation in unit tests), Vue's inject() warns and returns undefined
  // regardless of the default arg. Coalesce explicitly so callers always
  // get a usable root — keeps test ergonomics simple and matches the
  // "headless fallback to document" semantics this composable promises.
  const root = inject(EDITOR_ROOT_KEY, document);
  return root ?? document;
}
