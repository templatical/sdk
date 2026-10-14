import type { SavedBlockPatch } from "@templatical/types";
import { savedBlockInputError, updateSavedBlock } from "../../utils/templatical/store";

export default defineEventHandler(async (event) => {
  const body: unknown = await readBody(event).catch(() => null);
  const problem = savedBlockInputError(body, true);
  if (problem) {
    setResponseStatus(event, 400);
    return { message: problem };
  }
  const block = await updateSavedBlock(getRouterParam(event, "id") ?? "", body as SavedBlockPatch);
  if (!block) {
    setResponseStatus(event, 404);
    return { message: "Saved block not found." };
  }
  return block;
});
