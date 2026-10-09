import { createTemplate, templateInputError, type TemplateInput } from "../../utils/templatical/store";

export default defineEventHandler(async (event) => {
  const body: unknown = await readBody(event).catch(() => null);
  const problem = templateInputError(body, false);
  if (problem) {
    setResponseStatus(event, 400);
    return { message: problem };
  }
  setResponseStatus(event, 201);
  return createTemplate(body as TemplateInput);
});
