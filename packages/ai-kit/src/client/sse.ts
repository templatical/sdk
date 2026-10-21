import type { AiWireEvent } from "../wire";

const TYPES = new Set(["text", "operations", "applied", "done", "error"]);

function parse(data: string): AiWireEvent | null {
  try {
    const event = JSON.parse(data) as { type?: unknown };
    return typeof event === "object" &&
      event !== null &&
      typeof event.type === "string" &&
      TYPES.has(event.type)
      ? (event as AiWireEvent)
      : null;
  } catch {
    return null;
  }
}

/**
 * The wire's events from an SSE body: `data:` lines, joined per event and
 * dispatched at a blank line or the end; comments (`: ping`), other fields,
 * unparseable data and unknown types are skipped. Cancelling the generator
 * cancels the body.
 */
export async function* readSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AiWireEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];

  function* dispatch(): Generator<AiWireEvent> {
    if (data.length === 0) return;
    const event = parse(data.join("\n"));
    data = [];
    if (event) yield event;
  }

  function* lines(text: string): Generator<AiWireEvent> {
    for (const raw of text.split("\n")) {
      const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      if (line === "") {
        yield* dispatch();
      } else if (line.startsWith("data:")) {
        data.push(line.slice(line.startsWith("data: ") ? 6 : 5));
      }
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const end = buffer.lastIndexOf("\n");
      if (end === -1) continue;
      const complete = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      yield* lines(complete);
    }
    buffer += decoder.decode();
    if (buffer !== "") yield* lines(buffer);
    yield* dispatch();
  } finally {
    reader.cancel().catch(() => {});
  }
}
