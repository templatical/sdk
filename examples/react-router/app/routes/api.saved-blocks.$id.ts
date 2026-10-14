import type { SavedBlockPatch } from "@templatical/types";
import type { ActionFunctionArgs } from "react-router";
import { deleteSavedBlock, savedBlockInputError, updateSavedBlock } from "../lib/templatical/store.server";

const notFound = () => Response.json({ message: "Saved block not found." }, { status: 404 });

export async function action({ request, params }: ActionFunctionArgs) {
  const id = params.id ?? "";
  if (request.method === "DELETE") {
    return (await deleteSavedBlock(id)) ? new Response(null, { status: 204 }) : notFound();
  }
  if (request.method !== "PATCH") return Response.json({ message: "Method not allowed." }, { status: 405 });
  const body: unknown = await request.json().catch(() => null);
  const problem = savedBlockInputError(body, true);
  if (problem) return Response.json({ message: problem }, { status: 400 });
  const block = await updateSavedBlock(id, body as SavedBlockPatch);
  return block ? Response.json(block) : notFound();
}
