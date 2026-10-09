import type { ActionFunctionArgs } from "react-router";
import { createTemplate, templateInputError, type TemplateInput } from "../lib/templatical/store.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return Response.json({ message: "Method not allowed." }, { status: 405 });
  const body: unknown = await request.json().catch(() => null);
  const problem = templateInputError(body, false);
  if (problem) return Response.json({ message: problem }, { status: 400 });
  return Response.json(await createTemplate(body as TemplateInput), { status: 201 });
}
