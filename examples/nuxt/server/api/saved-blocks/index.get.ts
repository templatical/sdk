import { listSavedBlocks } from "../../utils/templatical/store";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  return listSavedBlocks({
    search: typeof query.search === "string" ? query.search : undefined,
    category: typeof query.category === "string" ? query.category : undefined,
  });
});
