import type { TemplatePatch } from "@templatical/types";
import type { RequestHandler } from "./$types";
import { readJson } from "#lib/server/read-json.ts";
import { getTemplate, templateInputError, updateTemplate } from "#lib/server/templatical/store.ts";

const notFound = () => Response.json({ message: "Template not found." }, { status: 404 });

export const GET: RequestHandler = async ({ params }) => {
  const template = await getTemplate(params.id);
  return template ? Response.json(template) : notFound();
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const body: unknown = await readJson(request);
  const problem = templateInputError(body, true);
  if (problem) return Response.json({ message: problem }, { status: 400 });
  const template = await updateTemplate(params.id, body as TemplatePatch);
  return template ? Response.json(template) : notFound();
};
