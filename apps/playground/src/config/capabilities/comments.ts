import type { CommentsProvider } from "@templatical/types";
import { commentsProviderFor } from "@/providers/comments";
import { methodOr } from "../build";
import type { CapabilityDef } from "../types";

/**
 * Review threads on the template. The provider arrives as `build`'s second
 * argument because it is memoised per template in `@/providers/comments`.
 */
export const commentsCapability: CapabilityDef<CommentsProvider> = {
  id: "comments",
  group: "backend",
  title: "Comments",
  blurb:
    "Threaded review comments anchored to blocks; you own the store, and an identity is what makes the feature available.",
  fixture: "product-launch",
  controls: [
    {
      kind: "method",
      path: "comments.create",
      label: "create",
      help: "Off removes the composer, so no new thread can be started.",
    },
    {
      kind: "method",
      path: "comments.update",
      label: "update",
      help: "Off removes the edit pencil from every comment.",
    },
    {
      kind: "method",
      path: "comments.delete",
      label: "delete",
      help: "Off removes the trash control from every comment.",
    },
    {
      kind: "method",
      path: "comments.setResolved",
      label: "setResolved",
      help: "Off removes the resolve toggle, so threads stay as they are.",
    },
  ],
  implFor: (template) => commentsProviderFor(template),
  build: (state, impl) => ({
    comments: {
      ...impl,
      create: methodOr(state["comments.create"], impl.create),
      update: methodOr(state["comments.update"], impl.update),
      delete: methodOr(state["comments.delete"], impl.delete),
      setResolved: methodOr(state["comments.setResolved"], impl.setResolved),
    },
  }),
};
