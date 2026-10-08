import { getTemplate } from "../../utils/templatical/store";

export default defineEventHandler(async (event) => {
  const template = await getTemplate(getRouterParam(event, "id") ?? "");
  if (!template) {
    setResponseStatus(event, 404);
    return { message: "Template not found." };
  }
  return template;
});
