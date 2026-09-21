import { describe, expect, it } from "vitest";
import { createSerializedBoot } from "../src/host/bootQueue";

describe("createSerializedBoot", () => {
  it("runs jobs in order and skips a superseded generation", async () => {
    const boot = createSerializedBoot();
    const log: string[] = [];
    let releaseFirst!: () => void;
    const firstHold = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = boot.enqueue(async (isCurrent) => {
      await firstHold;
      log.push(isCurrent() ? "commit-first" : "stale-first");
    });
    const second = boot.enqueue(async (isCurrent) => {
      log.push(isCurrent() ? "commit-second" : "stale-second");
    });

    releaseFirst();
    await Promise.all([first, second]);
    expect(log).toEqual(["stale-first", "commit-second"]);
  });

  it("invalidate() makes an in-queue job stale before it starts", async () => {
    const boot = createSerializedBoot();
    const log: string[] = [];
    let releaseFirst!: () => void;
    const firstHold = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = boot.enqueue(async () => {
      await firstHold;
      log.push("first-done");
    });
    const second = boot.enqueue(async (isCurrent) => {
      log.push(isCurrent() ? "second-ran" : "second-skipped");
    });
    boot.invalidate();
    releaseFirst();
    await Promise.all([first, second]);
    expect(log).toEqual(["first-done", "second-skipped"]);
  });
});
