/**
 * How often the editor's single debounced tick fires, and whether it saves.
 *
 * `true` / `false` turn autosave on and off at the default cadence; the object
 * form turns it on and sets the cadence in one key. One key rather than a
 * `boolean` plus a separate `autoSaveDebounce`, so there is no combination —
 * `autoSave: false, autoSaveDebounce: 500` — that reads as configured but does
 * nothing.
 *
 * The debounce governs `onChange` too: both ride one `useAutoSave` instance so
 * the notification and the save cannot drift apart, and so both inherit the
 * pause-during-undo/redo behaviour `useEditorCore` wires around it.
 */
export type AutoSaveConfig = boolean | { debounce?: number };

/** {@link AutoSaveConfig} resolved into the two things call sites actually need. */
export interface ResolvedAutoSave {
  enabled: boolean;
  /** Undefined means "whatever `useAutoSave` defaults to". */
  debounce?: number;
}

/**
 * Normalise an {@link AutoSaveConfig}.
 *
 * `defaultEnabled` exists because the two entry points genuinely differ: `init()`
 * is off unless asked (a consumer without a `templates` provider has nothing to
 * save to), while `initCloud()` is on unless refused (Cloud always has a store).
 * Passing it explicitly keeps that difference at the call sites rather than
 * hiding it in here.
 */
export function resolveAutoSave(
  value: AutoSaveConfig | undefined,
  defaultEnabled: boolean,
): ResolvedAutoSave {
  if (value === undefined) return { enabled: defaultEnabled };
  if (typeof value === "boolean") return { enabled: value };
  return { enabled: true, debounce: value.debounce };
}
