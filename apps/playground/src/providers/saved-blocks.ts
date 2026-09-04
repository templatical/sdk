import { createLocalStorageSavedBlocksProvider } from "@templatical/editor";
import type { SavedBlock, SavedBlocksProvider } from "@templatical/types";
import type { TemplateOption } from "@/templates";
import { SCRATCH_TEMPLATE_NAME, slugFor } from "./template-name";

/** Storage key per template, so each gets its own library and its own defaults. */
export function savedBlocksKeyFor(templateName: string): string {
  return `templatical:saved-blocks:${slugFor(templateName)}`;
}

/**
 * Seed a template's demo saved blocks the first time it is opened.
 *
 * Only when the key is absent — never a merge or a re-seed. Re-seeding would
 * resurrect entries the user deleted and overwrite their renames, which would
 * make delete and rename look broken in the very demo meant to show them off.
 * The fixtures each include one entry the store marks `canUpdate: false` /
 * `canDelete: false`, and that entry is what keeps a library from being emptied,
 * so nothing is lost by seeding exactly once.
 */
function seedSavedBlocks(
  key: string,
  defaults: SavedBlock[] | undefined,
): void {
  if (!defaults?.length) return;
  if (localStorage.getItem(key) !== null) return;
  localStorage.setItem(key, JSON.stringify(defaults));
}

/**
 * Providers are memoised per template, NOT per `init()` call. `init()` re-runs
 * whenever config or locale changes, and a fresh provider each time would be
 * harmless in itself — but recreating on template *name* keeps one instance per
 * library, so a locale switch can't reset what the user saved. Switching
 * template switches library.
 */
const savedBlocksProviders = new Map<string, SavedBlocksProvider>();

export function savedBlocksProviderFor(
  template?: TemplateOption,
): SavedBlocksProvider {
  const name = template?.name ?? SCRATCH_TEMPLATE_NAME;
  const cached = savedBlocksProviders.get(name);
  if (cached) return cached;

  const key = savedBlocksKeyFor(name);
  seedSavedBlocks(key, template?.savedBlocks);
  const provider = createLocalStorageSavedBlocksProvider({ key });

  savedBlocksProviders.set(name, provider);
  return provider;
}
