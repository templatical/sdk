import type { SavedBlocksProvider } from "@templatical/types";
import { methodOr } from "../build";
import type { CapabilityDef } from "../types";

/**
 * `build()` reads the real provider off `state.__impl` rather than importing it.
 *
 * The provider is memoised per template inside App.vue and depends on runtime
 * state (which template is open), so the capability cannot construct it. Passing
 * it through state keeps this module pure and unit-testable with a stub.
 */
export const savedBlocksCapability: CapabilityDef = {
  id: "saved-blocks",
  group: "backend",
  title: "Saved blocks",
  blurb:
    "Users capture groups of blocks and re-insert them; you own the storage.",
  fixture: "product-launch",
  controls: [
    {
      kind: "method",
      path: "savedBlocks.create",
      label: "create",
      help: "Off removes the bookmark action, so no pick session can start.",
    },
    {
      kind: "method",
      path: "savedBlocks.update",
      label: "update",
      help: "Off removes rename and recategorise from every row.",
    },
    {
      kind: "method",
      path: "savedBlocks.delete",
      label: "delete",
      help: "Off removes the delete control from every row.",
    },
    {
      kind: "number",
      path: "savedBlocks.listDelayMs",
      label: "list() latency (ms)",
      help: "Stands in for a slow backend so the browser's first-open skeleton is reachable. localStorage answers instantly, which is the one latency profile that cannot reproduce it.",
      min: 0,
      max: 5000,
      default: 0,
    },
  ],
  build: (state) => {
    const impl = state["__impl"] as SavedBlocksProvider;
    return {
      savedBlocks: {
        list: impl.list,
        create: methodOr(state["savedBlocks.create"], impl.create),
        update: methodOr(state["savedBlocks.update"], impl.update),
        delete: methodOr(state["savedBlocks.delete"], impl.delete),
      },
    };
  },
};
