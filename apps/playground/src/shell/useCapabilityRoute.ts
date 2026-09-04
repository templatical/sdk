import { ref, type Ref } from "vue";
import { useEventListener } from "@vueuse/core";
import { capabilities, capabilityById } from "@/config/capabilities";

/** The shell's route. The default route stays the template chooser until step 6. */
export const CAPABILITY_ROUTE = "#capabilities";

/**
 * The capability a hash names, or the first registered one.
 *
 * An unknown id falls back rather than rendering an empty shell: the hash is
 * shareable, so it outlives the capability it names.
 */
export function parseCapabilityHash(hash: string): string {
  const suffix = hash.startsWith(`${CAPABILITY_ROUTE}/`)
    ? hash.slice(CAPABILITY_ROUTE.length + 1)
    : "";
  return capabilityById(suffix) ? suffix : capabilities[0].id;
}

/** The shareable hash for a capability. */
export function formatCapabilityHash(id: string): string {
  return `${CAPABILITY_ROUTE}/${id}`;
}

/**
 * The active capability, kept in the URL so a link is shareable and a reload
 * keeps its place. Writing the hash is what drives the ref — the listener is
 * the single path, so a back button and a rail click behave identically.
 */
export function useCapabilityRoute(): {
  activeId: Ref<string>;
  select: (id: string) => void;
} {
  const activeId = ref(parseCapabilityHash(window.location.hash));

  useEventListener(window, "hashchange", () => {
    activeId.value = parseCapabilityHash(window.location.hash);
  });

  function select(id: string): void {
    window.location.hash = formatCapabilityHash(id);
  }

  return { activeId, select };
}
