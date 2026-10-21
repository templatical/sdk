import { describe, expect, it } from "vitest";
import {
  CollaborationConflict,
  SdkError,
  type BlockLockHolder,
  type CollaborationConflictCode,
} from "../src";

const GRACE: BlockLockHolder = {
  sessionId: "s-grace",
  type: "user",
  id: "u-2",
  name: "Grace",
  color: "#ef4444",
};
const GUEST: BlockLockHolder = {
  sessionId: "s-guest",
  type: "guest",
  id: "guest:s-guest",
  name: "Guest",
  color: "#10b981",
};

describe("CollaborationConflict", () => {
  it("is an SdkError named CollaborationConflict, carrying its message and code", () => {
    const conflict = new CollaborationConflict("Someone holds this block.", {
      code: "lock_held",
    });

    expect(conflict).toBeInstanceOf(CollaborationConflict);
    expect(conflict).toBeInstanceOf(SdkError);
    expect(conflict).toBeInstanceOf(Error);
    expect(conflict.name).toBe("CollaborationConflict");
    expect(conflict.message).toBe("Someone holds this block.");
    expect(conflict.code).toBe("lock_held");
  });

  it.each<[CollaborationConflictCode, number]>([
    ["invalid_operation", 422],
    ["content_too_large", 413],
    ["block_exists", 409],
    ["block_missing", 409],
    ["anchor_missing", 409],
    ["precondition_failed", 409],
    ["lock_held", 409],
    ["locked_by_others", 409],
    ["lock_lost", 409],
  ])("defaults the status for %s to %i", (code, status) => {
    const conflict = new CollaborationConflict("Refused.", { code });

    expect(conflict.statusCode).toBe(status);
  });

  it("keeps a status the backend sent over the default", () => {
    const conflict = new CollaborationConflict("Refused.", {
      code: "precondition_failed",
      status: 412,
    });

    expect(conflict.statusCode).toBe(412);
    expect(conflict.code).toBe("precondition_failed");
  });

  it("carries the refused operation's index, the holder and the holders", () => {
    const refused = new CollaborationConflict("Op 2 failed.", {
      code: "block_missing",
      opIndex: 2,
    });
    const held = new CollaborationConflict("Held.", {
      code: "lock_held",
      holder: GRACE,
    });
    const locked = new CollaborationConflict("Locked.", {
      code: "locked_by_others",
      opIndex: 0,
      holders: [GRACE, GUEST],
    });

    expect(refused.opIndex).toBe(2);
    expect(held.holder).toEqual(GRACE);
    expect(locked.opIndex).toBe(0);
    expect(locked.holders).toEqual([GRACE, GUEST]);
  });

  it("has no index, holder or holders when it wasn't given them", () => {
    const conflict = new CollaborationConflict("Lost.", { code: "lock_lost" });

    expect(conflict.opIndex).toBeUndefined();
    expect(conflict.holder).toBeUndefined();
    expect(conflict.holders).toBeUndefined();
    const serialized = JSON.parse(JSON.stringify(conflict));
    expect(serialized).not.toHaveProperty("opIndex");
    expect(serialized).not.toHaveProperty("holder");
    expect(serialized).not.toHaveProperty("holders");
  });
});
