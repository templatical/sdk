import type { TemplatePatch } from "@templatical/types";
import { getTemplate, templateInputError, updateTemplate } from "../../../../lib/templatical/server/store";

type Context = { params: Promise<{ id: string }> };

const notFound = () => Response.json({ message: "Template not found." }, { status: 404 });

export async function GET(_request: Request, { params }: Context) {
  const template = await getTemplate((await params).id);
  return template ? Response.json(template) : notFound();
}

export async function PATCH(request: Request, { params }: Context) {
  const body: unknown = await request.json().catch(() => null);
  const problem = templateInputError(body, true);
  if (problem) return Response.json({ message: problem }, { status: 400 });
  const template = await updateTemplate((await params).id, body as TemplatePatch);
  return template ? Response.json(template) : notFound();
}
