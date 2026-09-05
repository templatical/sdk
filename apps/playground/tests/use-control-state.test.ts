import { beforeEach, describe, expect, it } from "vitest";
import { effectScope } from "vue";
import { useControlState } from "../src/shell/useControlState";
import { readControlState, writeControlState } from "../src/config/state";

/** Run `fn` inside a disposed-after effect scope, as a component would. */
function inScope<T>(fn: () => T): T {
  const scope = effectScope();
  const result = scope.run(fn)!;
  scope.stop();
  return result;
}

describe("useControlState", () => {
  beforeEach(() => localStorage.clear());

  it("seeds from what is already stored", () => {
    writeControlState({ "templates.save": false });
    const { state } = inScope(() => useControlState());
    expect(state.value).toEqual({ "templates.save": false });
  });

  it("set() updates the ref and persists", () => {
    const { state, set } = inScope(() => useControlState());
    set("comments.create", false);
    expect(state.value).toEqual({ "comments.create": false });
    expect(readControlState()).toEqual({ "comments.create": false });
  });

  it("set() replaces the ref rather than mutating it, so a watcher fires", () => {
    const { state, set } = inScope(() => useControlState());
    const before = state.value;
    set("comments.create", false);
    expect(state.value).not.toBe(before);
  });

  it("reset() clears both the ref and storage", () => {
    writeControlState({ "templates.save": false });
    const { state, reset } = inScope(() => useControlState());
    reset();
    expect(state.value).toEqual({});
    expect(readControlState()).toEqual({});
  });
});
