import type { TemplatePatch } from "@templatical/types";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getTemplate, templateInputError, updateTemplate } from "../lib/templatical/store.server";

const notFound = () => Response.json({ message: "Template not found." }, { status: 404 });

export async function loader({ params }: LoaderFunctionArgs) {
  const template = await getTemplate(params.id ?? "");
  return template ? Response.json(template) : notFound();
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "PATCH") return Response.json({ message: "Method not allowed." }, { status: 405 });
  const body: unknown = await request.json().catch(() => null);
  const problem = templateInputError(body, true);
  if (problem) return Response.json({ message: problem }, { status: 400 });
  const template = await updateTemplate(params.id ?? "", body as TemplatePatch);
  return template ? Response.json(template) : notFound();
}
