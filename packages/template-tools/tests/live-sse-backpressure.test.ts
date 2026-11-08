import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { createSseClient } from "../src/live/index";

class Response extends EventEmitter {
  writes: string[] = [];
  blocked = false;
  write(payload: string): boolean {
    this.writes.push(payload);
    return !this.blocked;
  }
}

describe("SSE client backpressure", () => {
  it("keeps only the latest pending payload per event in queue order", () => {
    const response = new Response();
    response.blocked = true;
    const client = createSseClient(response as never);
    client.send("template", "template 1");
    for (let i = 2; i <= 20; i++) client.send("template", `template ${i}`);
    client.send("custom-block", "custom 1");
    client.send("custom-block", "custom 2");
    expect(response.writes).toEqual(["template 1"]);
    response.emit("drain");
    expect(response.writes).toEqual(["template 1", "template 20"]);
    client.send("template", "template 21");
    expect(response.writes).toEqual(["template 1", "template 20"]);
    response.blocked = false;
    response.emit("drain");
    expect(response.writes).toEqual(["template 1", "template 20", "custom 2", "template 21"]);
    client.close();
    expect(response.listenerCount("drain")).toBe(0);
  });

  it("sends every broadcast to a reading client", () => {
    const response = new Response();
    const client = createSseClient(response as never);
    client.send("template", "template 1");
    client.send("template", "template 2");
    expect(response.writes).toEqual(["template 1", "template 2"]);
    client.close();
  });
});
