import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import type { PlanConfig } from "@templatical/types";
import { useCloudSaveGate } from "../src/cloud/composables/useCloudSaveGate";
import type { LintIssue } from "../src/composables/useTemplateLint";

function makeIssue(
  severity: LintIssue["severity"],
  ruleId = `rule-${severity}`,
): LintIssue {
  return {
    blockId: "block-1",
    ruleId,
    severity,
    message: `${severity} issue`,
  };
}

/** Minimal PlanConfig — the gate only reads `accessibility.blockOnError`. */
function makePlanConfig(blockOnError: boolean | undefined): PlanConfig {
  return { accessibility: { blockOnError } } as unknown as PlanConfig;
}

function createGate(opts: {
  issues?: LintIssue[];
  blockOnError?: boolean | undefined;
  /** Pass `null` to simulate plan config not yet loaded. */
  planConfig?: PlanConfig | null;
}) {
  const issues = ref<LintIssue[]>(opts.issues ?? []);
  const planConfig = ref<PlanConfig | null>(
    opts.planConfig !== undefined
      ? opts.planConfig
      : makePlanConfig(opts.blockOnError),
  );
  const gate = useCloudSaveGate({ issues, planConfig });
  return { gate, issues, planConfig };
}

describe("useCloudSaveGate", () => {
  describe("blockingIssues / shouldBlock", () => {
    it("is empty and not blocking when planConfig is null", () => {
      const { gate } = createGate({
        issues: [makeIssue("error")],
        planConfig: null,
      });

      expect(gate.blockingIssues.value).toEqual([]);
      expect(gate.shouldBlock.value).toBe(false);
    });

    it("is empty and not blocking when blockOnError is false, even with errors", () => {
      const { gate } = createGate({
        issues: [makeIssue("error"), makeIssue("error", "rule-error-2")],
        blockOnError: false,
      });

      expect(gate.blockingIssues.value).toEqual([]);
      expect(gate.shouldBlock.value).toBe(false);
    });

    it("is empty and not blocking when blockOnError is undefined", () => {
      const { gate } = createGate({
        issues: [makeIssue("error")],
        blockOnError: undefined,
      });

      expect(gate.blockingIssues.value).toEqual([]);
      expect(gate.shouldBlock.value).toBe(false);
    });

    it("filters to error-severity issues only when blockOnError is true", () => {
      const error = makeIssue("error");
      const { gate } = createGate({
        issues: [makeIssue("warning"), error, makeIssue("info")],
        blockOnError: true,
      });

      expect(gate.blockingIssues.value).toEqual([error]);
      expect(gate.shouldBlock.value).toBe(true);
    });

    it("does not block when blockOnError is true but only warnings/info exist", () => {
      const { gate } = createGate({
        issues: [makeIssue("warning"), makeIssue("info")],
        blockOnError: true,
      });

      expect(gate.blockingIssues.value).toEqual([]);
      expect(gate.shouldBlock.value).toBe(false);
    });

    it("reacts when issues change after construction", () => {
      const { gate, issues } = createGate({
        issues: [],
        blockOnError: true,
      });

      expect(gate.shouldBlock.value).toBe(false);

      issues.value = [makeIssue("error")];

      expect(gate.shouldBlock.value).toBe(true);
      expect(gate.blockingIssues.value).toHaveLength(1);
    });
  });

  describe("tryRunSave", () => {
    it("runs the save immediately and returns true when not blocking", async () => {
      const { gate } = createGate({ issues: [], blockOnError: true });
      const run = vi.fn().mockResolvedValue(undefined);

      const result = await gate.tryRunSave(run);

      expect(result).toBe(true);
      expect(run).toHaveBeenCalledTimes(1);
      expect(gate.modalOpen.value).toBe(false);
    });

    it("defers the save, opens the modal, and returns false when blocking", async () => {
      const { gate } = createGate({
        issues: [makeIssue("error")],
        blockOnError: true,
      });
      const run = vi.fn().mockResolvedValue(undefined);

      const result = await gate.tryRunSave(run);

      expect(result).toBe(false);
      expect(run).not.toHaveBeenCalled();
      expect(gate.modalOpen.value).toBe(true);
    });

    it("awaits the underlying save before resolving when not blocking", async () => {
      const { gate } = createGate({ issues: [], blockOnError: true });
      const order: string[] = [];
      const run = vi.fn(async () => {
        await Promise.resolve();
        order.push("save-settled");
      });

      await gate.tryRunSave(run);
      order.push("tryRunSave-returned");

      expect(order).toEqual(["save-settled", "tryRunSave-returned"]);
    });
  });

  describe("confirmAndSave", () => {
    it("runs the pending save and closes the modal", async () => {
      const { gate } = createGate({
        issues: [makeIssue("error")],
        blockOnError: true,
      });
      const run = vi.fn().mockResolvedValue(undefined);

      await gate.tryRunSave(run);
      expect(run).not.toHaveBeenCalled();

      await gate.confirmAndSave();

      expect(run).toHaveBeenCalledTimes(1);
      expect(gate.modalOpen.value).toBe(false);
    });

    it("is a no-op when there is no pending save", async () => {
      const { gate } = createGate({ issues: [], blockOnError: true });

      await gate.confirmAndSave();

      expect(gate.modalOpen.value).toBe(false);
    });

    it("drains the pending save so a second confirm does not re-run it", async () => {
      const { gate } = createGate({
        issues: [makeIssue("error")],
        blockOnError: true,
      });
      const run = vi.fn().mockResolvedValue(undefined);

      await gate.tryRunSave(run);
      await gate.confirmAndSave();
      await gate.confirmAndSave();

      expect(run).toHaveBeenCalledTimes(1);
    });
  });

  describe("cancel", () => {
    it("closes the modal and discards the pending save", async () => {
      const { gate } = createGate({
        issues: [makeIssue("error")],
        blockOnError: true,
      });
      const run = vi.fn().mockResolvedValue(undefined);

      await gate.tryRunSave(run);
      expect(gate.modalOpen.value).toBe(true);

      gate.cancel();

      expect(gate.modalOpen.value).toBe(false);

      // Pending save was discarded — confirming afterwards must not run it.
      await gate.confirmAndSave();
      expect(run).not.toHaveBeenCalled();
    });
  });
});
