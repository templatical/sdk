import { afterEach, expect, it, vi } from "vitest";
import type {
  CollaborationHandlers,
  TemplateContent,
} from "@templatical/types";
import { createSharedCollaboration } from "../src/host/collaboration/client";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("carries locale locks through the client, worker and server, including unlock events", async () => {
  vi.useFakeTimers();
  const workerScope = { onconnect: (_event: unknown) => {} };
  vi.stubGlobal("self", workerScope);
  vi.stubGlobal("window", { addEventListener() {} });
  await import("../src/host/collaboration/shared.worker");
  vi.stubGlobal(
    "SharedWorker",
    class {
      port: {
        onmessage?: (event: { data: unknown }) => void;
        postMessage: (data: unknown) => void;
        start: () => void;
      };
      constructor() {
        const workerPort = {
          onmessage: undefined as
            undefined | ((event: { data: unknown }) => void),
          postMessage: (data: unknown) =>
            queueMicrotask(() => this.port.onmessage?.({ data })),
          start() {},
        };
        this.port = {
          postMessage: (data: unknown) =>
            queueMicrotask(() => workerPort.onmessage?.({ data })),
          start() {},
        };
        workerScope.onconnect({ ports: [workerPort] });
      }
    },
  );
  const seed = () =>
    ({
      blocks: [{ id: "t1", type: "title", content: "Hi" }],
      settings: { width: 600 },
    }) as unknown as TemplateContent;
  const a = createSharedCollaboration({
    user: { id: "ada", name: "Ada" },
    seed,
  });
  const b = createSharedCollaboration({
    user: { id: "grace", name: "Grace" },
    seed,
  });
  const handlers = (): CollaborationHandlers => ({
    onBatch() {},
    onResync() {},
    onLock() {},
    onUnlock: vi.fn(),
    onMembers() {},
    onConnectionChange() {},
  });
  const observer = handlers();
  await a.templates.load("tpl");
  const joinedA = await a.collaboration.join(
    "tpl",
    { sessionId: "a" },
    handlers(),
  );
  const joinedB = await b.collaboration.join(
    "tpl",
    { sessionId: "b" },
    observer,
  );
  expect((await a.collaboration.acquireLock!("tpl", "t1", "de")).locale).toBe(
    "de",
  );
  expect((await b.collaboration.acquireLock!("tpl", "t1", "fr")).locale).toBe(
    "fr",
  );
  expect((await a.collaboration.renewLock!("tpl", "t1", "de")).locale).toBe(
    "de",
  );
  await a.collaboration.releaseLock!("tpl", "t1", "de");
  expect(observer.onUnlock).toHaveBeenCalledWith("t1", "a", "de");
  expect(
    (await b.templates.load("tpl")).locks?.map((lock) => lock.locale),
  ).toEqual(["fr"]);
  joinedA.leave();
  joinedB.leave();
});
