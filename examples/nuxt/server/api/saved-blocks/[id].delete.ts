import { deleteSavedBlock } from "../../utils/templatical/store";

export default defineEventHandler(async (event) => {
  if (await deleteSavedBlock(getRouterParam(event, "id") ?? "")) return sendNoContent(event, 204);
  setResponseStatus(event, 404);
  return { message: "Saved block not found." };
});
