import { isRenderableTemplateContent } from "@templatical/types";
import type { ActionFunctionArgs } from "react-router";
import { renderTemplate } from "../lib/templatical/render.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return Response.json({ message: "Method not allowed." }, { status: 405 });
  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  if (!isRenderableTemplateContent(body?.content)) {
    return Response.json({ message: "`content` must be a template with a `blocks` array." }, { status: 400 });
  }
  return Response.json(await renderTemplate(body.content));
}
