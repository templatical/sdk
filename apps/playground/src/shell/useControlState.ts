import { ref, type Ref } from "vue";
import {
  readControlState,
  setControlValue,
  writeControlState,
} from "@/config/state";
import type { ControlState } from "@/config/types";

/**
 * The drawer's control state, shared with the shell that re-initialises the
 * editor from it.
 *
 * `set` assigns a **new object** rather than mutating the ref in place — a
 * deep watch is not used, so an in-place mutation would leave the shell's
 * watcher silent and the editor stale.
 */
export function useControlState(): {
  state: Ref<ControlState>;
  set: (path: string, value: unknown) => void;
  reset: () => void;
} {
  const state = ref<ControlState>(readControlState());

  function set(path: string, value: unknown): void {
    state.value = setControlValue(path, value);
  }

  function reset(): void {
    writeControlState({});
    state.value = {};
  }

  return { state, set, reset };
}
