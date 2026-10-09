import type { SavedBlockInput } from "@templatical/types";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { createSavedBlock, listSavedBlocks, savedBlockInputError } from "../lib/templatical/store.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const query = new URL(request.url).searchParams;
  return Response.json(
    await listSavedBlocks({
      search: query.get("search") ?? undefined,
      category: query.get("category") ?? undefined,
    }),
  );
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return Response.json({ message: "Method not allowed." }, { status: 405 });
  const body: unknown = await request.json().catch(() => null);
  const problem = savedBlockInputError(body, false);
  if (problem) return Response.json({ message: problem }, { status: 400 });
  return Response.json(await createSavedBlock(body as SavedBlockInput), { status: 201 });
}
