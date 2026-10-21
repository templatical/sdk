import type {
  Template,
  TemplatePatch,
  TemplatesProvider,
} from "@templatical/types";

/** What the save needs from collaboration: a way to wait for the batches. */
export interface SettlingCollaboration {
  settle: () => Promise<void>;
}

/**
 * A templates provider whose `save` persists content through collaboration.
 *
 * With a collaboration provider, every edit already reaches the backend as an
 * operation, and the backend's copy is the shared one. Saving the whole
 * content as well would write over other people's edits, so `save` waits for
 * this editor's batches to be confirmed and passes on only a rename. A save
 * with nothing to rename makes no call and answers with what is open.
 *
 * @param getTemplate What is open: the loaded template with the content on
 * the canvas.
 */
export function withCollaborativeSave(
  provider: TemplatesProvider,
  collaboration: SettlingCollaboration,
  getTemplate: () => Template | null,
): TemplatesProvider {
  const { save, create } = provider;
  if (typeof save !== "function") return provider;

  // The name the store last confirmed, per template id.
  const storedNames = new Map<string, string | undefined>();
  const remember = (template: Template): Template => {
    storedNames.set(template.id, template.name);
    return template;
  };

  return {
    ...provider,
    load: async (id) => remember(await provider.load(id)),
    create:
      typeof create === "function"
        ? async (input) => remember(await create(input))
        : false,
    save: async (id: string, patch: TemplatePatch): Promise<Template> => {
      await collaboration.settle();
      const renamed =
        patch.name !== undefined && patch.name !== storedNames.get(id);
      if (renamed) return remember(await save(id, { name: patch.name }));
      const current = getTemplate();
      // Another template was opened while the batches settled: answer with
      // the stored one, which core then ignores as stale.
      return current && current.id === id
        ? current
        : remember(await provider.load(id));
    },
  };
}
