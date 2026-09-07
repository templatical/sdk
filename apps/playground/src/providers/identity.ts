import type { EditorUser } from "@templatical/types";

/**
 * Who the playground says you are.
 *
 * Lives in its own module rather than beside the comments provider: the
 * capability shell passes it on every page, because `useCommentsFeature`
 * refuses to render without an identity and the shell builds one config for
 * the whole registry regardless of which capability is active.
 */
export const PLAYGROUND_USER: EditorUser = {
  id: "playground-user",
  name: "Playground User",
};
