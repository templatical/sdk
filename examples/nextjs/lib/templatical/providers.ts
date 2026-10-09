// The editor reaches the backend only through these four objects. Each method
// is one fetch to an /api route of this app; point them at any backend that
// implements the same routes, in any language.
import type {
  RenderProvider,
  SavedBlocksListParams,
  SavedBlocksProvider,
  TemplatesProvider,
  TestEmailProvider,
} from "@templatical/types";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    // Every write declares JSON, the bodyless DELETE included: a framework's
    // CSRF check (SvelteKit's, for one) treats a write without a content type
    // as a form post and can reject it as cross-site.
    headers: method === "GET" ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? `${method} ${path} failed (${response.status})`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

function listQuery(params: SavedBlocksListParams = {}): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.category) query.set("category", params.category);
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const templatesProvider: TemplatesProvider = {
  load: (id) => request("GET", `/api/templates/${encodeURIComponent(id)}`),
  create: (input) => request("POST", "/api/templates", input),
  save: (id, patch) => request("PATCH", `/api/templates/${encodeURIComponent(id)}`, patch),
  autoSave: true,
};

export const savedBlocksProvider: SavedBlocksProvider = {
  list: (params) => request("GET", `/api/saved-blocks${listQuery(params)}`),
  create: (input) => request("POST", "/api/saved-blocks", input),
  update: (id, patch) => request("PATCH", `/api/saved-blocks/${encodeURIComponent(id)}`, patch),
  delete: (id) => request("DELETE", `/api/saved-blocks/${encodeURIComponent(id)}`),
};

export const testEmailProvider: TestEmailProvider = {
  defaultRecipient: "you@example.com",
  send: ({ recipient, content }) => request("POST", "/api/test-email", { recipient, content }),
};

export const renderProvider: RenderProvider = {
  toMjml: async ({ content }) =>
    (await request<{ mjml: string }>("POST", "/api/render", { content })).mjml,
  toHtml: async ({ content }) =>
    (await request<{ html: string }>("POST", "/api/render", { content })).html,
};
