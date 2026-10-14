import type { SavedBlockPatch } from "@templatical/types";
import { deleteSavedBlock, savedBlockInputError, updateSavedBlock } from "../../../../lib/templatical/server/store";

type Context = { params: Promise<{ id: string }> };

const notFound = () => Response.json({ message: "Saved block not found." }, { status: 404 });

export async function PATCH(request: Request, { params }: Context) {
  const body: unknown = await request.json().catch(() => null);
  const problem = savedBlockInputError(body, true);
  if (problem) return Response.json({ message: problem }, { status: 400 });
  const block = await updateSavedBlock((await params).id, body as SavedBlockPatch);
  return block ? Response.json(block) : notFound();
}

export async function DELETE(_request: Request, { params }: Context) {
  return (await deleteSavedBlock((await params).id)) ? new Response(null, { status: 204 }) : notFound();
}
