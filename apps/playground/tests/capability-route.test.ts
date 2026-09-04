import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { effectScope, type EffectScope } from "vue";
import {
  CAPABILITY_ROUTE,
  parseCapabilityHash,
  formatCapabilityHash,
  useCapabilityRoute,
} from "../src/shell/useCapabilityRoute";

describe("capability hash", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("uses the route decision 13 specifies", () => {
    expect(CAPABILITY_ROUTE).toBe("#capabilities");
  });

  it("reads the capability id out of the hash", () => {
    expect(parseCapabilityHash("#capabilities/templates")).toBe("templates");
  });

  it("falls back to the first registered capability for a bare route", () => {
    expect(parseCapabilityHash("#capabilities")).toBe("saved-blocks");
  });

  it("falls back for an unregistered id rather than rendering nothing", () => {
    expect(parseCapabilityHash("#capabilities/not-a-capability")).toBe(
      "saved-blocks",
    );
  });

  it("round-trips an id through format and parse", () => {
    expect(parseCapabilityHash(formatCapabilityHash("comments"))).toBe(
      "comments",
    );
  });

  it("formats a shareable hash", () => {
    expect(formatCapabilityHash("comments")).toBe("#capabilities/comments");
  });
});

/**
 * happy-dom queues `hashchange` off a real macrotask — a `window.setTimeout`
 * inside its `Location` setter — never a microtask, so `nextTick()` alone
 * observes the hash already updated but `activeId` still stale. Waiting out
 * a real timer matches how the browser itself schedules the event.
 */
function flushHashChange(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("useCapabilityRoute", () => {
  const scopes: EffectScope[] = [];

  /**
   * `useEventListener` (`@vueuse/core`) registers its cleanup against the
   * active effect scope, so the composable needs one even outside a
   * component. Stopping every scope after each test detaches the listener it
   * added to `window` — otherwise a later test's hash write would still
   * update a ref belonging to an already-finished test.
   */
  function run() {
    const scope = effectScope();
    scopes.push(scope);
    return scope.run(() => useCapabilityRoute())!;
  }

  beforeEach(() => {
    window.location.hash = "";
  });

  afterEach(() => {
    scopes.forEach((scope) => scope.stop());
    scopes.length = 0;
  });

  it("seeds activeId from the hash already in the URL", () => {
    window.location.hash = "#capabilities/comments";
    const { activeId } = run();
    expect(activeId.value).toBe("comments");
  });

  it("falls back to the first registered capability when the hash names none", () => {
    window.location.hash = "#capabilities/not-a-capability";
    const { activeId } = run();
    expect(activeId.value).toBe("saved-blocks");
  });

  it("select writes the hash and the ref follows", async () => {
    const { activeId, select } = run();
    select("templates");
    await flushHashChange();
    expect(window.location.hash).toBe("#capabilities/templates");
    expect(activeId.value).toBe("templates");
  });

  it("follows an external hash change via the hashchange listener", async () => {
    const { activeId } = run();
    window.location.hash = "#capabilities/version-history";
    await flushHashChange();
    expect(activeId.value).toBe("version-history");
  });
});
