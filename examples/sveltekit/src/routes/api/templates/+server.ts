import type { RequestHandler } from "./$types";
import { createTemplate, templateInputError, type TemplateInput } from "#lib/server/templatical/store.ts";

export const POST: RequestHandler = async ({ request }) => {
  const body: unknown = await request.json().catch(() => null);
  const problem = templateInputError(body, false);
  if (problem) return Response.json({ message: problem }, { status: 400 });
  return Response.json(await createTemplate(body as TemplateInput), { status: 201 });
};
