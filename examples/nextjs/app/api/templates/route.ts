import { createTemplate, templateInputError, type TemplateInput } from "../../../lib/templatical/server/store";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const problem = templateInputError(body, false);
  if (problem) return Response.json({ message: problem }, { status: 400 });
  return Response.json(await createTemplate(body as TemplateInput), { status: 201 });
}
