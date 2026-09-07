import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The shell's editor lifecycle.
 *
 * The guarantee under test is that two `init()` calls never overlap on one
 * container. The SDK's teardown is container-keyed (`unmountOssContainer`),
 * so a second `init()` racing the first tears down whichever app currently
 * owns that node — and when the calls settle out of order the container is
 * left empty with a dead handle in `editor`.
 *
 * The mock reproduces exactly that: mounting evicts whoever holds the
 * container, and each call parks on a deferred the test releases by name.
 * Fake timers cannot express this — advancing them advances the mock's own
 * delay too, so the first call always settles first and the race never
 * occurs.
 */

const unmounts: string[] = [];
const mounted: string[] = [];
let pending: Array<{ name: string; resolve: () => void }> = [];
let failNext = false;

vi.mock("@templatical/editor", () => ({
  init: vi.fn(async (config: { name?: string }) => {
    const name = config.name ?? "anon";
    await new Promise<void>((resolve) => pending.push({ name, resolve }));
    if (failNext) {
      failNext = false;
      throw new Error(`init failed for ${name}`);
    }
    // Container-keyed teardown: mounting evicts whoever holds the container.
    if (mounted.length) unmounts.push(`${mounted.pop()}(evicted)`);
    mounted.push(name);
    return {
      unmount: () => {
        unmounts.push(name);
        mounted.pop();
      },
    };
  }),
}));

const { useCapabilityEditor } = await import("../src/shell/useCapabilityEditor");

function settle(name: string): void {
  const index = pending.findIndex((entry) => entry.name === name);
  if (index === -1) {
    throw new Error(
      `no in-flight init() named "${name}" — pending: [${pending
        .map((entry) => entry.name)
        .join(", ")}]`,
    );
  }
  const [entry] = pending.splice(index, 1);
  entry.resolve();
}

/**
 * Yield microtasks until `name`'s `init()` is actually in flight.
 *
 * `initEditor` hands the request to a promise chain, so the call reaches
 * `init()` a microtask later rather than synchronously. Draining microtasks
 * rather than advancing timers keeps the deferreds under the test's control.
 */
async function waitForInFlight(name: string): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    if (pending.some((entry) => entry.name === name)) return;
    await Promise.resolve();
  }
  throw new Error(`init() named "${name}" never started`);
}

describe("useCapabilityEditor", () => {
  beforeEach(() => {
    unmounts.length = 0;
    mounted.length = 0;
    pending = [];
    failNext = false;
  });

  it("never overlaps two init() calls on one container", async () => {
    let next = "a";
    const api = useCapabilityEditor(() => ({ name: next }) as never);
    api.host.value = document.createElement("div");

    const first = api.initEditor();
    await waitForInFlight("a");

    next = "b";
    const second = api.initEditor();

    // Only the first is in flight: the second is queued behind it. Without
    // the queue, "b" would call `init()` immediately and evict "a" mid-mount.
    expect(pending.map((entry) => entry.name)).toEqual(["a"]);

    settle("a");
    await first;
    await waitForInFlight("b");
    expect(pending.map((entry) => entry.name)).toEqual(["b"]);

    settle("b");
    await second;
    expect(mounted).toEqual(["b"]);
    // "a" was torn down by the shell, not evicted mid-mount by "b".
    expect(unmounts).toEqual(["a"]);
  });

  it("keeps the last requested config after the queue drains", async () => {
    let next = "a";
    const api = useCapabilityEditor(() => ({ name: next }) as never);
    api.host.value = document.createElement("div");

    const first = api.initEditor();
    await waitForInFlight("a");
    next = "b";
    const second = api.initEditor();
    settle("a");
    await first;
    await waitForInFlight("b");
    settle("b");
    await second;

    expect((api.lastInitConfig.value as unknown as { name: string }).name).toBe(
      "b",
    );
  });

  it("skips a request that was superseded before it reached the front", async () => {
    let next = "a";
    const api = useCapabilityEditor(() => ({ name: next }) as never);
    api.host.value = document.createElement("div");

    const first = api.initEditor();
    await waitForInFlight("a");
    next = "b";
    const second = api.initEditor();
    next = "c";
    const third = api.initEditor();

    settle("a");
    await first;
    await waitForInFlight("c");
    // "b" never calls `init()` at all: by the time the queue reaches it the
    // shell has already asked for "c", so building it would mount an editor
    // nobody asked for and immediately tear it down.
    expect(pending.map((entry) => entry.name)).toEqual(["c"]);

    settle("c");
    await Promise.all([second, third]);
    expect(mounted).toEqual(["c"]);
    expect(unmounts).toEqual(["a"]);
  });

  it("mounts nothing after destroy()", async () => {
    const api = useCapabilityEditor(() => ({ name: "a" }) as never);
    api.host.value = document.createElement("div");

    const run = api.initEditor();
    await waitForInFlight("a");
    api.destroy();
    settle("a");
    await run;

    expect(api.editor.value).toBeNull();
    expect(mounted).toEqual([]);
    expect(unmounts).toEqual(["a"]);
  });

  it("does nothing without a host element", async () => {
    const api = useCapabilityEditor(() => ({ name: "a" }) as never);
    await api.initEditor();
    expect(pending).toEqual([]);
    expect(api.lastInitConfig.value).toBeNull();
  });

  it("keeps serving requests after an init() rejects", async () => {
    let next = "a";
    const api = useCapabilityEditor(() => ({ name: next }) as never);
    api.host.value = document.createElement("div");

    failNext = true;
    const failing = api.initEditor();
    await waitForInFlight("a");
    settle("a");
    await expect(failing).rejects.toThrow("init failed for a");

    // A rejection left in the chain would make every later request a silent
    // no-op for the rest of the session, since they all wait on it.
    next = "b";
    const second = api.initEditor();
    await waitForInFlight("b");
    settle("b");
    await second;

    expect(mounted).toEqual(["b"]);
    expect((api.lastInitConfig.value as unknown as { name: string }).name).toBe(
      "b",
    );
  });

  /**
   * `afterInit` is where the shell attaches a template — a round trip through
   * the consumer's store, so a rail click can land during it. The instance is
   * already published to `editor` by then, so the recheck after that await is
   * what keeps a superseded instance from staying published.
   */
  it("unpublishes an instance superseded while afterInit was still running", async () => {
    let next = "a";
    let releaseAdopt: (() => void) | null = null;
    const adoptCalls: string[] = [];

    const api = useCapabilityEditor(
      () => ({ name: next }) as never,
      async () => {
        adoptCalls.push(next);
        // Only the first attach parks; later ones resolve straight away.
        if (releaseAdopt) return;
        await new Promise<void>((resolve) => {
          releaseAdopt = resolve;
        });
      },
    );
    api.host.value = document.createElement("div");

    const first = api.initEditor();
    await waitForInFlight("a");
    settle("a");
    // Drain up to the point where "a" is mounted, published, and parked
    // inside its own `afterInit`.
    for (let i = 0; i < 50 && !releaseAdopt; i += 1) await Promise.resolve();
    expect(adoptCalls).toEqual(["a"]);
    expect(mounted).toEqual(["a"]);

    // A rail click lands mid-attach. It queues, so nothing runs yet.
    next = "b";
    const second = api.initEditor();
    expect(pending.map((entry) => entry.name)).toEqual([]);

    releaseAdopt!();
    await first;

    // "a" lost the race: torn down rather than left published.
    expect(api.editor.value).toBeNull();

    await waitForInFlight("b");
    settle("b");
    await second;

    expect(mounted).toEqual(["b"]);
    expect(unmounts).toEqual(["a"]);
    expect((api.lastInitConfig.value as unknown as { name: string }).name).toBe(
      "b",
    );
  });
});
