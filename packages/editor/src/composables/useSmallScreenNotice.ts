import {
  computed,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import { useMediaQuery } from "@vueuse/core";

/**
 * Viewport width below which the editor chrome can't lay out usably and we
 * show `SmallScreenNotice` instead (issue #235). The three-pane layout needs
 * the 48px palette rail + 320px properties panel + a canvas with padding —
 * roughly 768px before the canvas gets workable room. A typical phone
 * (~360–410px CSS) leaves the canvas at zero width.
 *
 * Deliberately viewport-based (not container/element width): it targets
 * actual small *devices*, so embedding the editor in a narrow desktop pane
 * doesn't trip the notice.
 */
export const SMALL_SCREEN_QUERY = "(max-width: 767px)";

export interface UseSmallScreenNoticeReturn {
  /** True while the viewport matches `SMALL_SCREEN_QUERY`. */
  isSmallScreen: Ref<boolean>;
  /** True when the notice should replace the editor chrome. */
  showNotice: ComputedRef<boolean>;
}

/**
 * Reactive gate for the small-screen notice.
 *
 * @param enabled - The consumer's `smallScreenNotice` config flag. Defaults to
 *   `true` when `undefined`, so the notice is opt-out, not opt-in. Pass `false`
 *   (or a getter returning `false`) to let the editor render its chrome at any
 *   width — for consumers handling small screens themselves.
 */
export function useSmallScreenNotice(
  enabled?: MaybeRefOrGetter<boolean | undefined>,
): UseSmallScreenNoticeReturn {
  const isSmallScreen = useMediaQuery(SMALL_SCREEN_QUERY);
  const showNotice = computed(
    () => (toValue(enabled) ?? true) && isSmallScreen.value,
  );
  return { isSmallScreen, showNotice };
}
