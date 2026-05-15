/**
 * Module-level registry of editor instances mounted on the page. When
 * two or more editors mount concurrently, the global `document` keydown
 * listener registered by each `useEditorCore` would otherwise fire on
 * every instance for a single keystroke (double undo, double save).
 * The tracker routes shortcuts to a single active instance based on the
 * user's most recent pointer interaction.
 *
 * Single-instance pages keep the original behavior (always active).
 */

const instances = new Set<number>();
let lastActiveId = 0;
let counter = 0;

export interface EditorInstanceHandle {
  id: number;
  /** True when this instance should handle global keyboard shortcuts. */
  isActive: () => boolean;
  /** Mark this instance as active (typically on user pointer interaction). */
  claim: () => void;
  /** Remove this instance from the registry on unmount. */
  dispose: () => void;
}

export function registerEditorInstance(): EditorInstanceHandle {
  const id = ++counter;
  instances.add(id);
  if (lastActiveId === 0) lastActiveId = id;
  return {
    id,
    isActive: () => instances.size <= 1 || lastActiveId === id,
    claim: () => {
      lastActiveId = id;
    },
    dispose: () => {
      instances.delete(id);
      if (lastActiveId === id) {
        const remaining = Array.from(instances);
        lastActiveId = remaining[remaining.length - 1] ?? 0;
      }
    },
  };
}

/** Test-only: reset module state between tests. */
export function _resetActiveEditorTrackerForTests(): void {
  instances.clear();
  lastActiveId = 0;
  counter = 0;
}
