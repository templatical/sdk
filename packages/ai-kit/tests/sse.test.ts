import { describe, expect, it } from "vitest";
import { readSse } from "../src/client";

function body(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function all(stream: ReadableStream<Uint8Array>) {
  const events = [];
  for await (const event of readSse(stream)) events.push(event);
  return events;
}

describe("readSse", () => {
  it("reads events split anywhere, CRLF included, and skips pings and junk", async () => {
    expect(
      await all(
        body(
          ': ping\n\nda',
          'ta: {"type":"text","text":"Hi"}\r\n\r\n',
          "event: ignored\nretry: 10\n\n",
          'data: not json\n\ndata: {"type":"done","messageId":null}',
        ),
      ),
    ).toEqual([
      { type: "text", text: "Hi" },
      { type: "done", messageId: null },
    ]);
  });

  it("joins an event's data lines, as SSE does", async () => {
    expect(
      await all(body('data: {"type":"text",\ndata: "text":"a"}\n\n')),
    ).toEqual([{ type: "text", text: "a" }]);
  });

  it("drops an event without a known type", async () => {
    expect(await all(body('data: {"type":"thinking"}\n\ndata: {"x":1}\n\n'))).toEqual([]);
  });
});
