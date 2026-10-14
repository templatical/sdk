import type { TemplatePatch } from "@templatical/types";
import { templateInputError, updateTemplate } from "../../utils/templatical/store";

export default defineEventHandler(async (event) => {
  const body: unknown = await readBody(event).catch(() => null);
  const problem = templateInputError(body, true);
  if (problem) {
    setResponseStatus(event, 400);
    return { message: problem };
  }
  const template = await updateTemplate(getRouterParam(event, "id") ?? "", body as TemplatePatch);
  if (!template) {
    setResponseStatus(event, 404);
    return { message: "Template not found." };
  }
  return template;
});
