import { describe, expect, it } from "vitest";
import { effectScope, nextTick, ref, type Ref } from "vue";
import { createImageBlock } from "@templatical/types";
import type { ImageBlock } from "@templatical/types";
import { useImageAspectLock } from "../src/composables/useImageAspectLock";
import type { NaturalSize } from "../src/utils/imageNaturalSize";

// A 3:1 file, 1200 × 400, in a column with 580px of room.
function setup(
  partial: Partial<ImageBlock> = {},
  options: { room?: number | null; measured?: NaturalSize | null } = {},
) {
  const block: Ref<ImageBlock> = ref(
    createImageBlock({
      id: "img",
      src: "https://cdn.test/banner.png",
      width: 300,
      naturalWidth: 1200,
      naturalHeight: 400,
      ...partial,
    }),
  );
  const room = ref<number | null>(
    options.room === undefined ? 580 : options.room,
  );
  const measured = ref<NaturalSize | null>(options.measured ?? null);
  const scope = effectScope();
  const lock = scope.run(() =>
    useImageAspectLock({
      block: () => block.value,
      room: () => room.value,
      measured: () => measured.value,
    }),
  )!;
  return { lock, block, room, measured, scope };
}

describe("useImageAspectLock", () => {
  describe("availability and the derived lock", () => {
    it("is locked with a known ratio and the height on Auto", () => {
      const { lock } = setup();
      expect([lock.available.value, lock.locked.value]).toEqual([true, true]);
      expect(lock.derivedHeight.value).toBe(100);
    });

    it("is unavailable without a size, stored or measured", () => {
      const { lock } = setup({
        naturalWidth: undefined,
        naturalHeight: undefined,
      });
      expect([lock.available.value, lock.locked.value]).toEqual([false, false]);
      expect(lock.derivedHeight.value).toBeNull();
    });

    it("uses a measured size when the block stores none", () => {
      const { lock } = setup(
        { naturalWidth: undefined, naturalHeight: undefined },
        { measured: { width: 600, height: 300 } },
      );
      expect(lock.locked.value).toBe(true);
      expect(lock.derivedHeight.value).toBe(150);
    });

    it("prefers the stored size over a measured one", () => {
      const { lock } = setup({}, { measured: { width: 600, height: 600 } });
      expect(lock.derivedHeight.value).toBe(100);
    });

    it("opens locked for a legacy height within a pixel of the ratio", () => {
      expect(setup({ height: 101 }).lock.locked.value).toBe(true);
      expect(setup({ height: 99 }).lock.locked.value).toBe(true);
    });

    it("opens unlocked for a legacy height that stretches the image", () => {
      expect(setup({ height: 200 }).lock.locked.value).toBe(false);
    });

    it("reads a full width at the room", () => {
      const { lock } = setup({ width: "full" });
      expect(lock.derivedHeight.value).toBe(193);
      expect(setup({ width: "full", height: 193 }).lock.locked.value).toBe(
        true,
      );
    });

    it("can't judge a full width with a height when the room is unknown", () => {
      const { lock } = setup({ width: "full", height: 193 }, { room: null });
      expect(lock.locked.value).toBe(false);
    });
  });

  describe("edits under the lock", () => {
    it("turns a typed height into a width, leaving the height on Auto", () => {
      const { lock } = setup();
      expect(lock.heightUpdates(40)).toEqual({ width: 120, height: undefined });
      expect(lock.cappedHeight.value).toBeNull();
    });

    it("caps at the room: full width, height on Auto, and a hint", () => {
      const { lock } = setup();
      // 300 × 3 = 900 ≥ 580.
      expect(lock.heightUpdates(300)).toEqual({
        width: "full",
        height: undefined,
      });
      expect(lock.cappedHeight.value).toBe(193);
      // Exactly the room caps too; one pixel of width under it doesn't.
      expect(lock.heightUpdates(193.4)).toEqual({
        width: "full",
        height: undefined,
      });
      expect(lock.heightUpdates(193)).toEqual({
        width: 579,
        height: undefined,
      });
      expect(lock.cappedHeight.value).toBeNull();
    });

    it("doesn't cap when the room is unknown", () => {
      const { lock } = setup({}, { room: null });
      expect(lock.heightUpdates(300)).toEqual({
        width: 900,
        height: undefined,
      });
    });

    it("ignores an unusable height", () => {
      const { lock } = setup();
      for (const value of [0, -5, Number.NaN, 0.1]) {
        expect(lock.heightUpdates(value)).toBeNull();
      }
    });

    it("clears the height with every width edit", () => {
      const { lock } = setup({ height: 100 });
      expect(lock.widthUpdates(450)).toEqual({ width: 450, height: undefined });
      expect(lock.widthUpdates("full")).toEqual({
        width: "full",
        height: undefined,
      });
    });

    it("writes a measured size alongside the edit that uses it", () => {
      const { lock } = setup(
        { naturalWidth: undefined, naturalHeight: undefined },
        { measured: { width: 600, height: 300 } },
      );
      expect(lock.heightUpdates(50)).toEqual({
        width: 100,
        height: undefined,
        naturalWidth: 600,
        naturalHeight: 300,
      });
    });
  });

  describe("unlocked", () => {
    it("leaves a width edit alone and refuses a locked height edit", () => {
      const { lock } = setup({ height: 200 });
      expect(lock.widthUpdates(450)).toEqual({ width: 450 });
      expect(lock.heightUpdates(40)).toBeNull();
    });
  });

  describe("toggling", () => {
    it("turning it off changes no content and holds until another block", async () => {
      const { lock, block } = setup();
      expect(lock.setLocked(false)).toBeNull();
      expect(lock.locked.value).toBe(false);

      block.value = { ...block.value, width: 200 };
      expect(lock.locked.value).toBe(false);

      block.value = createImageBlock({
        id: "other",
        naturalWidth: 100,
        naturalHeight: 100,
      });
      await nextTick();
      expect(lock.locked.value).toBe(true);
    });

    it("turning it on drops a stretching height and keeps the width", () => {
      const { lock } = setup({ height: 200 });
      expect(lock.setLocked(true)).toEqual({ height: undefined });
    });

    it("turning it on with nothing to change returns no updates", () => {
      const { lock } = setup();
      lock.setLocked(false);
      expect(lock.setLocked(true)).toBeNull();
      expect(lock.locked.value).toBe(true);
    });

    it("turning it on writes a measured size", () => {
      const { lock } = setup(
        { naturalWidth: undefined, naturalHeight: undefined, height: 50 },
        { measured: { width: 600, height: 300 } },
      );
      expect(lock.setLocked(true)).toEqual({
        height: undefined,
        naturalWidth: 600,
        naturalHeight: 300,
      });
    });
  });
});
