import { isRenderableTemplateContent } from "@templatical/types";
import { renderTemplate } from "../../../lib/templatical/server/render";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  if (!isRenderableTemplateContent(body?.content)) {
    return Response.json({ message: "`content` must be a template with a `blocks` array." }, { status: 400 });
  }
  return Response.json(await renderTemplate(body.content));
}
