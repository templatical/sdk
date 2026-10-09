import { isRenderableTemplateContent } from "@templatical/types";
import type { ActionFunctionArgs } from "react-router";
import { deliver, isEmailAddress } from "../lib/templatical/outbox.server";
import { renderTemplate } from "../lib/templatical/render.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return Response.json({ message: "Method not allowed." }, { status: 405 });
  const body = (await request.json().catch(() => null)) as { recipient?: unknown; content?: unknown } | null;
  if (!isEmailAddress(body?.recipient)) {
    return Response.json({ message: "Enter a valid email address." }, { status: 400 });
  }
  if (!isRenderableTemplateContent(body.content)) {
    return Response.json({ message: "`content` must be a template with a `blocks` array." }, { status: 400 });
  }
  const { html } = await renderTemplate(body.content);
  await deliver({ to: body.recipient, subject: "Test email", html });
  return new Response(null, { status: 204 });
}
