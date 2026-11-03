import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

let sessionId = "";
const lockUrl = (templateId: string, blockId: string, locale?: string | null) =>
  `/api/templates/${templateId}/locks/${blockId}` +
  (locale ? `?locale=${encodeURIComponent(locale)}` : "");

// A refused request rejects with its HTTP status as `statusCode` and the
// response's `code`, `holder` and `holders`.
async function api(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (response.ok) return body;
  throw Object.assign(new Error(body.message ?? `HTTP ${response.status}`), {
    statusCode: response.status,
    code: body.code,
    holder: body.holder,
    holders: body.holders,
  });
}

// Server-sent events carry the other sessions' changes, one subscription per
// template.
const subscriptions = new Map<string, EventSource>();

const editor = await init({
  container: "#editor",
  user: { id: "u_7", name: "Ada Lovelace" },
  templates: {
    // `load` returns the template's content and its `revision`.
    load: (id) => api(`/api/templates/${id}`),
    create: false,
    save: false,
  },
  collaboration: {
    join: async (templateId, session, handlers) => {
      sessionId = session.sessionId;
      subscriptions.get(templateId)?.close();
      const events = new EventSource(
        `/api/templates/${templateId}/events?sessionId=${sessionId}`,
      );
      subscriptions.set(templateId, events);
      const on = (name: string, handle: (data: any) => void) =>
        events.addEventListener(name, (event) =>
          handle(JSON.parse((event as MessageEvent<string>).data)),
        );
      on("batch", (batch) => handlers.onBatch(batch));
      on("resync", ({ revision, actor }) => handlers.onResync(revision, actor));
      on("lock", (lock) => handlers.onLock(lock));
      on("unlock", ({ blockId, sessionId, locale }) =>
        handlers.onUnlock(blockId, sessionId, locale),
      );
      on("members", (members) => handlers.onMembers(members));
      events.onopen = () => handlers.onConnectionChange("connected");
      events.onerror = () =>
        handlers.onConnectionChange(
          events.readyState === EventSource.CLOSED ? "offline" : "reconnecting",
        );
      const state = await api(`/api/templates/${templateId}/join`, {
        method: "POST",
        headers: { "X-Session-Id": sessionId },
      });
      return { ...state, leave: () => events.close() };
    },
    submit: (templateId, batch) =>
      api(`/api/templates/${templateId}/operations`, {
        method: "POST",
        headers: { "X-Session-Id": sessionId },
        body: JSON.stringify(batch),
      }),
    operationsAfter: (templateId, revision) =>
      api(`/api/templates/${templateId}/operations?after=${revision}`, {
        headers: { "X-Session-Id": sessionId },
      }),
    acquireLock: (templateId, blockId, locale) =>
      api(`/api/templates/${templateId}/locks`, {
        method: "POST",
        headers: { "X-Session-Id": sessionId },
        body: JSON.stringify({ blockId, locale: locale ?? null }),
      }),
    renewLock: (templateId, blockId, locale) =>
      api(lockUrl(templateId, blockId, locale), {
        method: "PUT",
        headers: { "X-Session-Id": sessionId },
      }),
    releaseLock: async (templateId, blockId, locale) => {
      await fetch(lockUrl(templateId, blockId, locale), {
        method: "DELETE",
        headers: { "X-Session-Id": sessionId },
        keepalive: true,
      });
    },
  },
});

await editor.load("tpl_123");
