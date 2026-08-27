/**
 * Whether the editor saves automatically after the user stops editing.
 *
 * The cadence is `changeDebounce` at the config root rather than a member here,
 * because one `useAutoSave` instance drives both the save and the `onChange`
 * notification — and `onChange` works with no templates provider, so a
 * provider-less consumer still needs to set it. `autoSave: false` with a
 * `changeDebounce` is therefore a real setting, not a dead one: it means notify
 * at that cadence and persist nothing.
 */
export type AutoSaveConfig = boolean;

/**
 * Normalise an {@link AutoSaveConfig}.
 *
 * The one call site is `Editor.vue`'s `autoSaveEnabled`, which always passes
 * `false` as `defaultEnabled` — a consumer without a `templates` provider has
 * nothing to save to. `initCloud()` inlines its own default instead of
 * calling this (`config.templates?.autoSave ?? true`, in `index.ts`), since
 * Cloud always has a store to save to.
 */
export function resolveAutoSave(
  value: AutoSaveConfig | undefined,
  defaultEnabled: boolean,
): boolean {
  return value ?? defaultEnabled;
}
