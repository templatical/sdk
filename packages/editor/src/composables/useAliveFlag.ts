import { onBeforeUnmount } from "vue";

export interface AliveFlag {
  readonly alive: boolean;
}

/**
 * Returns a flag that flips to false on component unmount.
 * Use to guard post-`await` side effects that touch external state.
 *
 * ```ts
 * const aliveFlag = useAliveFlag();
 * async function load() {
 *   const data = await fetch();
 *   if (!aliveFlag.alive) return;
 *   applyData(data);
 * }
 * ```
 */
export function useAliveFlag(): AliveFlag {
  const flag = { alive: true };
  onBeforeUnmount(() => {
    flag.alive = false;
  });
  return flag;
}
