// @vitest-environment happy-dom
import { describe, expect, it, vi, onTestFinished } from "vitest";
import { mountCrowdedHeader } from "../../../apps/playground/e2e/helpers/localization-header";

describe("crowded language header harness", () => {
  it.each([false, true])(
    "mounts without Vue warnings with shadowDom=%s",
    async (shadowDom) => {
      const warnings: string[] = [];
      const warn = vi.spyOn(console, "warn").mockImplementation((message) => {
        warnings.push(String(message));
      });
      onTestFinished(() => warn.mockRestore());
      const dispose = await mountCrowdedHeader(shadowDom);
      onTestFinished(dispose);
      await vi.dynamicImportSettled();
      expect(
        warnings.filter((message) => message.includes("[Vue warn]")),
      ).toEqual([]);
    },
  );
});
