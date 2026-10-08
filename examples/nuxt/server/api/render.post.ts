import { isRenderableTemplateContent } from "@templatical/types";
import { renderTemplate } from "../utils/templatical/render";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) as { content?: unknown } | null;
  if (!isRenderableTemplateContent(body?.content)) {
    setResponseStatus(event, 400);
    return { message: "`content` must be a template with a `blocks` array." };
  }
  return renderTemplate(body.content);
});
