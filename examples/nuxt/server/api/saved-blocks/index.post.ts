import type { SavedBlockInput } from "@templatical/types";
import { createSavedBlock, savedBlockInputError } from "../../utils/templatical/store";

export default defineEventHandler(async (event) => {
  const body: unknown = await readBody(event).catch(() => null);
  const problem = savedBlockInputError(body, false);
  if (problem) {
    setResponseStatus(event, 400);
    return { message: problem };
  }
  setResponseStatus(event, 201);
  return createSavedBlock(body as SavedBlockInput);
});
