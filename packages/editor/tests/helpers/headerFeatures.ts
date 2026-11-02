import type EditorHeader from "../../src/components/EditorHeader.vue";
import { computed, ref } from "vue";

/** Provider state for the header's crowded-width regression, shared with e2e. */
type HeaderProps = InstanceType<typeof EditorHeader>["$props"];
type HeaderFeatures = Pick<
  HeaderProps,
  | "templates"
  | "versionHistory"
  | "comments"
  | "collaboration"
  | "ai"
  | "testEmail"
>;

export function headerFeatures(): HeaderFeatures {
  const available = {
    isAvailable: computed(() => true),
    hasTemplate: computed(() => true),
  };
  return {
    templates: {
      ...available,
      canSave: computed(() => true),
      name: computed(() => "Autumn product launch newsletter"),
      timestamp: computed(() => ({
        iso: "2026-10-25T12:00:00Z",
        kind: "updatedAt" as const,
      })),
      status: ref("saved" as const),
      errorMessage: ref(""),
      isSaving: computed(() => false),
      rename: () => {},
      requestSave: () => {},
    },
    versionHistory: {
      ...available,
      versions: computed(() => []),
      isLoading: computed(() => false),
      isRestoring: computed(() => false),
      previewingVersion: ref(null),
      refresh: () => {},
      navigate: async () => {},
    },
    comments: {
      ...available,
      unresolvedCount: computed(() => 3),
      isOpen: ref(false),
      toggle: () => {},
    },
    collaboration: {
      isLive: computed(() => true),
      connection: ref("connected" as const),
      people: computed(() => [
        {
          key: "translator",
          type: "user" as const,
          name: "Avery Lane",
          color: "#15803d",
        },
      ]),
    },
    ai: {
      isAvailable: computed(() => true),
      panel: ref(null),
      has: () => true,
      open: () => {},
      close: () => {},
    },
    testEmail: {
      isAvailable: computed(() => true),
      isSending: ref(false),
      open: () => {},
    },
  };
}
