import { describe, expect, it } from "vitest";
import { EVENT_LOG_LIMIT, useEventLog } from "../src/shell/useEventLog";

/**
 * The drawer's feed of provider lifecycle events.
 *
 * Every entry is something the editor really fired — there are no synthetic
 * events anywhere, which is why `origin` is carried rather than assumed and
 * why the log lives above the re-init cycle instead of inside a config that
 * is rebuilt on every control change.
 */
describe("useEventLog", () => {
  it("records newest first, with the capability that reported it", () => {
    const log = useEventLog();
    log.record("saved-blocks", { handler: "onCreated", summary: "Hero saved" });
    log.record("comments", { handler: "onDeleted", summary: "Thread removed" });

    expect(log.events.value.map((e) => e.handler)).toEqual([
      "onDeleted",
      "onCreated",
    ]);
    expect(log.events.value[0].capabilityId).toBe("comments");
    expect(log.events.value[1].capabilityId).toBe("saved-blocks");
  });

  it("keeps the summary and payload the reporter supplied", () => {
    const log = useEventLog();
    const block = { id: "b1", name: "Hero" };
    log.record("saved-blocks", {
      handler: "onCreated",
      summary: "Hero",
      payload: block,
    });

    expect(log.events.value[0].summary).toBe("Hero");
    // By identity: the feed holds what it was handed rather than a copy, so a
    // reader inspecting a row sees the object the SDK passed the handler.
    expect(log.events.value[0].payload).toBe(block);
  });

  it("defaults origin to local, and keeps an explicit remote", () => {
    const log = useEventLog();
    log.record("comments", { handler: "onCreated", summary: "a" });
    log.record("comments", {
      handler: "onUpdated",
      summary: "b",
      origin: "remote",
    });

    expect(log.events.value.map((e) => e.origin)).toEqual(["remote", "local"]);
  });

  it("gives every event a distinct monotonic id", () => {
    const log = useEventLog();
    for (let i = 0; i < 5; i += 1) {
      log.record("templates", { handler: "onSaved", summary: `s${i}` });
    }
    const ids = log.events.value.map((e) => e.id);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  it("stamps each event with the time it was recorded", () => {
    const before = Date.now();
    const log = useEventLog();
    log.record("templates", { handler: "onSaved", summary: "a" });

    const at = log.events.value[0].at;
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });

  it("caps the log, dropping the oldest", () => {
    const log = useEventLog();
    for (let i = 0; i < EVENT_LOG_LIMIT + 10; i += 1) {
      log.record("templates", { handler: "onSaved", summary: `s${i}` });
    }
    expect(log.events.value).toHaveLength(EVENT_LOG_LIMIT);
    expect(log.events.value[0].summary).toBe(`s${EVENT_LOG_LIMIT + 9}`);
    expect(log.events.value.at(-1)!.summary).toBe("s10");
  });

  it("clear() empties it", () => {
    const log = useEventLog();
    log.record("templates", { handler: "onSaved", summary: "a" });
    log.clear();
    expect(log.events.value).toEqual([]);
  });

  it("keeps two logs independent, so one shell's feed is its own", () => {
    const first = useEventLog();
    const second = useEventLog();
    first.record("templates", { handler: "onSaved", summary: "a" });

    expect(first.events.value).toHaveLength(1);
    expect(second.events.value).toEqual([]);
  });
});
