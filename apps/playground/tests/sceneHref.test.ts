import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MORPHING_CLASS,
  SCENE_STAGE_TRANSITION,
  navigatePlayground,
  sceneHref,
} from "../src/host/sceneHref";

type Update = () => void;

function stubBrowser(options: {
  reducedMotion?: boolean;
  startViewTransition?: (update: Update) => {
    ready: Promise<unknown>;
    finished: Promise<unknown>;
  };
}) {
  const pushState = vi.fn();
  const dispatchEvent = vi.fn();
  const rootClasses = new Set<string>();
  vi.stubGlobal("history", { pushState });
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: options.reducedMotion ?? false }),
    dispatchEvent,
  });
  vi.stubGlobal(
    "PopStateEvent",
    class {
      constructor(public type: string) {}
    },
  );
  const documentElement = {
    classList: {
      add: (name: string) => rootClasses.add(name),
      remove: (name: string) => rootClasses.delete(name),
    },
  };
  vi.stubGlobal(
    "document",
    options.startViewTransition
      ? { startViewTransition: options.startViewTransition, documentElement }
      : { documentElement },
  );
  return { pushState, dispatchEvent, rootClasses };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("sceneHref", () => {
  it("keeps the shadowDom pin and drops everything else", () => {
    expect(sceneHref("theming", "?shadowDom=1&locale=de")).toBe(
      "/scenes/theming?shadowDom=1",
    );
    expect(sceneHref("theming", "?locale=de")).toBe("/scenes/theming");
  });
});

describe("navigatePlayground", () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);

  beforeEach(() => {
    unhandled.length = 0;
    process.on("unhandledRejection", onUnhandled);
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
    vi.unstubAllGlobals();
  });

  it("navigates directly when view transitions are unavailable", () => {
    const { pushState, dispatchEvent } = stubBrowser({});
    navigatePlayground("/scenes/fonts");
    expect(pushState).toHaveBeenCalledWith({}, "", "/scenes/fonts");
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("navigates directly under reduced motion", () => {
    const startViewTransition = vi.fn();
    const { pushState } = stubBrowser({
      reducedMotion: true,
      startViewTransition,
    });
    navigatePlayground("/scenes/fonts");
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(pushState).toHaveBeenCalledWith({}, "", "/scenes/fonts");
  });

  it("observes a skipped transition so it never surfaces as unhandled", async () => {
    const { pushState } = stubBrowser({
      startViewTransition: (update) => {
        update();
        return {
          ready: Promise.reject(new Error("InvalidStateError")),
          finished: Promise.resolve(),
        };
      },
    });
    navigatePlayground("/scenes/fonts");
    await flush();
    expect(pushState).toHaveBeenCalledWith({}, "", "/scenes/fonts");
    expect(unhandled).toEqual([]);
  });

  it("names the morph source for one transition, then clears it", async () => {
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => (finish = resolve));
    const namesDuringUpdate: string[] = [];
    const proof = { style: { viewTransitionName: "" } } as HTMLElement;
    const { rootClasses } = stubBrowser({
      startViewTransition: (update) => {
        namesDuringUpdate.push(proof.style.viewTransitionName);
        update();
        return { ready: Promise.resolve(), finished };
      },
    });
    navigatePlayground("/scenes/example-sable-friday", { morphFrom: proof });
    expect(namesDuringUpdate).toEqual([SCENE_STAGE_TRANSITION]);
    expect(proof.style.viewTransitionName).toBe(SCENE_STAGE_TRANSITION);
    expect([...rootClasses]).toEqual([MORPHING_CLASS]);
    finish();
    await flush();
    expect(proof.style.viewTransitionName).toBe("");
    // The stage's name makes it a stacking context; it must not outlive the
    // transition or the host header paints over the editor's dialogs.
    expect([...rootClasses]).toEqual([]);
  });

  it("leaves the stage unnamed for a navigation with nothing to morph", () => {
    const { rootClasses } = stubBrowser({
      startViewTransition: (update) => {
        update();
        return { ready: Promise.resolve(), finished: Promise.resolve() };
      },
    });
    navigatePlayground("/scenes/fonts");
    expect([...rootClasses]).toEqual([]);
  });
});
