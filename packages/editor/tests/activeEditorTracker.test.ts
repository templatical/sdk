import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetActiveEditorTrackerForTests,
  registerEditorInstance,
} from "../src/utils/activeEditorTracker";

describe("activeEditorTracker", () => {
  beforeEach(() => {
    _resetActiveEditorTrackerForTests();
  });

  it("single instance is always active", () => {
    const instance = registerEditorInstance();
    expect(instance.isActive()).toBe(true);
  });

  it("first-registered instance is active before any claim", () => {
    const first = registerEditorInstance();
    const second = registerEditorInstance();
    expect(first.isActive()).toBe(true);
    expect(second.isActive()).toBe(false);
  });

  it("claim swaps active instance", () => {
    const first = registerEditorInstance();
    const second = registerEditorInstance();
    second.claim();
    expect(first.isActive()).toBe(false);
    expect(second.isActive()).toBe(true);
  });

  it("disposing the active instance falls back to remaining instance", () => {
    const first = registerEditorInstance();
    const second = registerEditorInstance();
    second.claim();
    second.dispose();
    expect(first.isActive()).toBe(true);
  });

  it("disposing a non-active instance does not change active", () => {
    const first = registerEditorInstance();
    const second = registerEditorInstance();
    second.dispose();
    expect(first.isActive()).toBe(true);
  });

  it("returns to single-instance always-active behavior after one disposes", () => {
    const first = registerEditorInstance();
    const second = registerEditorInstance();
    second.dispose();
    expect(first.isActive()).toBe(true);
    // No second instance remains — first is sole owner.
    expect(first.id).toBe(1);
  });

  it("instances get unique sequential IDs", () => {
    const a = registerEditorInstance();
    const b = registerEditorInstance();
    const c = registerEditorInstance();
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    expect(c.id).toBe(3);
  });
});
