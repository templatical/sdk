import { isRenderableTemplateContent } from "@templatical/types";
import { deliver, isEmailAddress } from "../utils/templatical/outbox";
import { renderTemplate } from "../utils/templatical/render";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) as { recipient?: unknown; content?: unknown } | null;
  if (!isEmailAddress(body?.recipient)) {
    setResponseStatus(event, 400);
    return { message: "Enter a valid email address." };
  }
  if (!isRenderableTemplateContent(body.content)) {
    setResponseStatus(event, 400);
    return { message: "`content` must be a template with a `blocks` array." };
  }
  const { html } = await renderTemplate(body.content);
  await deliver({ to: body.recipient, subject: "Test email", html });
  return sendNoContent(event, 204);
});
