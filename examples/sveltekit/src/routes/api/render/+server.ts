import { isRenderableTemplateContent } from "@templatical/types";
import type { RequestHandler } from "./$types";
import { readJson } from "#lib/server/read-json.ts";
import { renderTemplate } from "#lib/server/templatical/render.ts";

export const POST: RequestHandler = async ({ request }) => {
  const body = (await readJson(request)) as { content?: unknown } | null;
  if (!isRenderableTemplateContent(body?.content)) {
    return Response.json({ message: "`content` must be a template with a `blocks` array." }, { status: 400 });
  }
  return Response.json(await renderTemplate(body.content));
};
