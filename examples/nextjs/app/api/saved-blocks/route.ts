import type { SavedBlockInput } from "@templatical/types";
import { createSavedBlock, listSavedBlocks, savedBlockInputError } from "../../../lib/templatical/server/store";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  return Response.json(
    await listSavedBlocks({
      search: query.get("search") ?? undefined,
      category: query.get("category") ?? undefined,
    }),
  );
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const problem = savedBlockInputError(body, false);
  if (problem) return Response.json({ message: problem }, { status: 400 });
  return Response.json(await createSavedBlock(body as SavedBlockInput), { status: 201 });
}
