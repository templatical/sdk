import type { SavedBlockPatch } from "@templatical/types";
import type { RequestHandler } from "./$types";
import { readJson } from "#lib/server/read-json.ts";
import { deleteSavedBlock, savedBlockInputError, updateSavedBlock } from "#lib/server/templatical/store.ts";

const notFound = () => Response.json({ message: "Saved block not found." }, { status: 404 });

export const PATCH: RequestHandler = async ({ params, request }) => {
  const body: unknown = await readJson(request);
  const problem = savedBlockInputError(body, true);
  if (problem) return Response.json({ message: problem }, { status: 400 });
  const block = await updateSavedBlock(params.id, body as SavedBlockPatch);
  return block ? Response.json(block) : notFound();
};

export const DELETE: RequestHandler = async ({ params }) =>
  (await deleteSavedBlock(params.id)) ? new Response(null, { status: 204 }) : notFound();
