interface Env {
  SHARES_KV: KVNamespace;
}

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function generateId(size = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let id = "";
  for (let i = 0; i < size; i++) {
    id += ALPHABET[bytes[i] % 62];
  }
  return id;
}

const MAX_BODY_SIZE = 512 * 1024; // 512KB
const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const contentLength = Number(context.request.headers.get("content-length"));
  if (contentLength > MAX_BODY_SIZE) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: { content?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = body?.content;
  if (
    !content ||
    typeof content !== "object" ||
    !Array.isArray((content as Record<string, unknown>).blocks) ||
    typeof (content as Record<string, unknown>).settings !== "object"
  ) {
    return Response.json(
      { error: "Invalid content: must have blocks array and settings object" },
      { status: 400 },
    );
  }

  const createdAt = new Date().toISOString();

  // Generate ID with collision check (up to 3 retries)
  let id = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    id = generateId();
    const existing = await context.env.SHARES_KV.get(`share:${id}`);
    if (!existing) break;
    if (attempt === 2) {
      return Response.json(
        { error: "Failed to generate unique ID" },
        { status: 500 },
      );
    }
  }

  await context.env.SHARES_KV.put(
    `share:${id}`,
    JSON.stringify({ content, createdAt }),
    { expirationTtl: TTL_SECONDS },
  );

  const origin = new URL(context.request.url).origin;
  const url = `${origin}/?s=${id}`;

  return Response.json({ id, url }, { status: 201 });
};
