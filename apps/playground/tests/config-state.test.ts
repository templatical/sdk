import { beforeEach, describe, expect, it } from "vitest";
import {
  CONTROL_STATE_KEY,
  readControlState,
  setControlValue,
  writeControlState,
} from "../src/config/state";

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

describe("writeControlState", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips through readControlState", () => {
    writeControlState({ "templates.save": false });
    expect(readControlState()).toEqual({ "templates.save": false });
  });

  it("replaces rather than merging, so a cleared control really clears", () => {
    writeControlState({ "templates.save": false, "comments.create": false });
    writeControlState({ "templates.save": false });
    expect(readControlState()).toEqual({ "templates.save": false });
  });
});

describe("setControlValue", () => {
  beforeEach(() => localStorage.clear());

  it("merges one path into the stored state and returns the result", () => {
    writeControlState({ "templates.save": false });
    expect(setControlValue("comments.create", false)).toEqual({
      "templates.save": false,
      "comments.create": false,
    });
    expect(readControlState()).toEqual({
      "templates.save": false,
      "comments.create": false,
    });
  });

  it("overwrites a path already set", () => {
    writeControlState({ "templates.save": false });
    expect(setControlValue("templates.save", true)).toEqual({
      "templates.save": true,
    });
  });
});
