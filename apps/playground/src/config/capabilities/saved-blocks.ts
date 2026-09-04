import type { SavedBlocksProvider } from "@templatical/types";
import { savedBlocksProviderFor } from "@/providers/saved-blocks";
import { methodOr } from "../build";
import type { CapabilityDef } from "../types";

/**
 * `implFor` reaches `@/providers/saved-blocks` to construct the live backend,
 * memoised per template; `build` only ever receives it as a parameter, so it
 * stays a pure function of `(state, impl)` and its own unit tests keep
 * passing a stub with no localStorage involved.
 */
export const savedBlocksCapability: CapabilityDef<SavedBlocksProvider> = {
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
  implFor: (template) => savedBlocksProviderFor(template),
  build: (state, impl) => {
    const delayMs = Number(state["savedBlocks.listDelayMs"] ?? 0);
    // Stands in for a slow backend so the browser's first-open skeleton is
    // reachable — localStorage answers instantly, which is the one latency
    // profile that cannot reproduce it.
    const list: SavedBlocksProvider["list"] =
      delayMs > 0
        ? async (params) => {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return impl.list(params);
          }
        : impl.list;
    return {
      savedBlocks: {
        ...impl,
        list,
        create: methodOr(state["savedBlocks.create"], impl.create),
        update: methodOr(state["savedBlocks.update"], impl.update),
        delete: methodOr(state["savedBlocks.delete"], impl.delete),
      },
    };
  },
};
