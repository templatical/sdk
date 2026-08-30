import { beforeEach, describe, expect, it } from "vitest";
import { CONTROL_STATE_KEY, readControlState } from "../src/config/state";

describe("readControlState", () => {
  beforeEach(() => localStorage.clear());

  it("returns an empty object when nothing is seeded", () => {
    expect(readControlState()).toEqual({});
  });

  it("reads seeded control state", () => {
    localStorage.setItem(
      CONTROL_STATE_KEY,
      JSON.stringify({ "savedBlocks.update": false }),
    );
    expect(readControlState()).toEqual({ "savedBlocks.update": false });
  });

  it("returns an empty object for malformed JSON rather than throwing", () => {
    localStorage.setItem(CONTROL_STATE_KEY, "{not json");
    expect(readControlState()).toEqual({});
  });
});
