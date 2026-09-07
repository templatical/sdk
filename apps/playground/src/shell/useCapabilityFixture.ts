import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import type { TemplaticalEditor } from "@templatical/editor";
import { slugFor } from "@/providers/template-name";
import { templates, type TemplateOption } from "@/templates";

/**
 * Which demo template a capability is showing, and the stored template the
 * editor saves into.
 *
 * Those are one concern rather than two: `adoptTemplate` resolves the very
 * fixture this module computes — it is "attach the current fixture's template"
 * — and its memo is keyed by the same slug the picker sets. Splitting them
 * would put the key and the thing it keys in different files.
 *
 * `activeId` and `initEditor` arrive as arguments so this module never reaches
 * for the route or the editor lifecycle itself; the shell wires all three.
 */
export interface CapabilityFixture {
  /** The resolved template: the picker's choice, else the capability's own. */
  fixture: ComputedRef<TemplateOption>;
  /** That template's slug — the picker's value. */
  fixtureSlug: ComputedRef<string>;
  /** Swap the fixture for this visit and re-init onto it. */
  setFixture: (slug: string) => void;
  /** Give a freshly mounted editor a template to save into. */
  adoptTemplate: (instance: TemplaticalEditor) => Promise<void>;
}

/**
 * Resolve `wanted` against the registered demo templates.
 *
 * Exported because the shell is a `.vue` file this app's tests cannot import,
 * so a test needing the shell's fixture resolution would otherwise copy this
 * line — and a copy is free to drift from what the shell actually does.
 */
export function resolveFixture(wanted: string): TemplateOption {
  // Every registered capability names "product-launch" today; a future one
  // naming a fixture no template carries falls back to the first template
  // rather than mounting an editor with no content at all.
  return templates.find((t) => slugFor(t.name) === wanted) ?? templates[0];
}

export function useCapabilityFixture(
  activeId: Ref<string>,
  capabilityFixture: ComputedRef<string>,
  initEditor: () => Promise<void>,
): CapabilityFixture {
  // The drawer's picker swaps the fixture for the current visit; `null` means
  // "whatever this capability curated". Cleared on a capability change, so
  // each one opens on its own fixture rather than inheriting the last pick.
  const fixtureOverride = ref<string | null>(null);

  const fixture = computed(() =>
    resolveFixture(fixtureOverride.value ?? capabilityFixture.value),
  );

  // The picker's value. Derived from the template that actually resolved, not
  // from `fixtureOverride`, so the fallback above can never leave the select
  // showing a slug it has no option for.
  const fixtureSlug = computed(() => slugFor(fixture.value.name));

  /**
   * Template ids already attached, keyed by fixture slug.
   *
   * The editor has no create affordance of its own — creation is programmatic
   * — so without this the Save button sits disabled at "Load or create a
   * template first" and the whole templates capability is dead UI: no save
   * status, no autosave to observe, and no saves for version history to
   * record.
   *
   * Keyed by fixture because each one is a different template, and remembered
   * because a re-init fires on every control toggle: creating each time would
   * spawn a template per click and leave version history reading from a store
   * that just changed underneath it.
   */
  const adoptedTemplateIds = new Map<string, string>();

  /**
   * Give the editor a template to save into: load the one this fixture
   * already has, or create it the first time.
   *
   * A read-only store (`templates.create: false`) has nothing to attach to,
   * so this gives up quietly — the editor still edits, it just cannot
   * persist, which is exactly what that control is there to demonstrate.
   */
  async function adoptTemplate(instance: TemplaticalEditor): Promise<void> {
    const slug = fixtureSlug.value;
    const known = adoptedTemplateIds.get(slug);
    try {
      if (known) {
        await instance.load(known);
      } else {
        const created = await instance.create({ name: fixture.value.name });
        adoptedTemplateIds.set(slug, created.id);
      }
    } catch (err) {
      console.info(
        "[playground] no template attached:",
        (err as Error).message,
      );
    }
  }

  /**
   * Swap the fixture for this visit.
   *
   * Re-inits by calling `initEditor` rather than through a `watch(fixture)`:
   * a capability change clears the override, which moves `fixture` too, so a
   * watcher there would fire beside the `activeId` one and start a second
   * `init()` for a single click.
   */
  function setFixture(slug: string): void {
    fixtureOverride.value = slug;
    void initEditor();
  }

  // The picker's choice belongs to the capability it was made in, so each
  // capability opens on the fixture it curated (spec decision 9).
  watch(activeId, () => {
    fixtureOverride.value = null;
  });

  return { fixture, fixtureSlug, setFixture, adoptTemplate };
}
