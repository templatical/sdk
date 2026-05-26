const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// Rejection-sample upper bound. `256 % 62 = 8`, so bytes in [248, 256)
// would map to indices 0..7 more often than to 8..61 if we just took
// `bytes[i] % 62` directly. Discarding them and resampling restores a
// uniform distribution over the alphabet.
const REJECTION_BOUND = 248;

function generateId(size = 10) {
  let id = "";
  while (id.length < size) {
    // Draw a fresh batch each iteration. In practice ~3% of bytes are
    // rejected, so a single batch of `size` covers `size` characters
    // with overwhelming probability and the loop runs once.
    const bytes = crypto.getRandomValues(new Uint8Array(size));
    for (let i = 0; i < bytes.length && id.length < size; i++) {
      if (bytes[i] < REJECTION_BOUND) {
        id += ALPHABET[bytes[i] % 62];
      }
    }
  }
  return id;
}

const MAX_BODY_SIZE = 512 * 1024;
const TTL_SECONDS = 30 * 24 * 60 * 60;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // POST /api/shares — create a share
    if (url.pathname === "/api/shares" && request.method === "POST") {
      const contentLength = Number(request.headers.get("content-length"));
      if (contentLength > MAX_BODY_SIZE) {
        return Response.json({ error: "Payload too large" }, { status: 413 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }

      const content = body?.content;
      if (
        !content ||
        typeof content !== "object" ||
        !Array.isArray(content.blocks) ||
        typeof content.settings !== "object"
      ) {
        return Response.json(
          { error: "Invalid content: must have blocks array and settings object" },
          { status: 400 }
        );
      }

      const createdAt = new Date().toISOString();

      let id = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        id = generateId();
        const existing = await env.SHARES_KV.get(`share:${id}`);
        if (!existing) break;
        if (attempt === 2) {
          return Response.json(
            { error: "Failed to generate unique ID" },
            { status: 500 }
          );
        }
      }

      await env.SHARES_KV.put(
        `share:${id}`,
        JSON.stringify({ content, createdAt }),
        { expirationTtl: TTL_SECONDS }
      );

      const origin = url.origin;
      const shareUrl = `${origin}/?s=${id}`;

      return Response.json({ id, url: shareUrl }, { status: 201 });
    }

    // GET /api/shares/:id — fetch a share
    const shareMatch = url.pathname.match(/^\/api\/shares\/([^/]+)$/);
    if (shareMatch && request.method === "GET") {
      const id = shareMatch[1];

      if (!id || !/^[a-zA-Z0-9]{1,20}$/.test(id)) {
        return Response.json({ error: "Invalid share ID" }, { status: 400 });
      }

      const value = await env.SHARES_KV.get(`share:${id}`);
      if (!value) {
        return Response.json({ error: "Share not found" }, { status: 404 });
      }

      const data = JSON.parse(value);

      return Response.json({
        id,
        content: data.content,
        createdAt: data.createdAt,
      });
    }

    // Everything else — serve static assets
    return env.ASSETS.fetch(request);
  },
};
