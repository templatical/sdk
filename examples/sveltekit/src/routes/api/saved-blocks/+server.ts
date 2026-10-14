import type { SavedBlockInput } from "@templatical/types";
import type { RequestHandler } from "./$types";
import { readJson } from "#lib/server/read-json.ts";
import { createSavedBlock, listSavedBlocks, savedBlockInputError } from "#lib/server/templatical/store.ts";

export const GET: RequestHandler = async ({ url }) =>
  Response.json(
    await listSavedBlocks({
      search: url.searchParams.get("search") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
    }),
  );

export const POST: RequestHandler = async ({ request }) => {
  const body: unknown = await readJson(request);
  const problem = savedBlockInputError(body, false);
  if (problem) return Response.json({ message: problem }, { status: 400 });
  return Response.json(await createSavedBlock(body as SavedBlockInput), { status: 201 });
};
