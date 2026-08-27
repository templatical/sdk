import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  /**
   * The autosave path. Routing autosave *around* the gate (the shape this
   * replaced) avoided a modal on a debounce timer but demoted `blockOnError`
   * from a server policy to a manual-save-only speed bump — the whole point of
   * the flag is that it applies to what reaches the server.
   */
  describe("runUnlessBlocked", () => {
    it("runs the save and returns true when the gate would not block", async () => {
      const { gate } = createGate({
        issues: [makeIssue("warning")],
        blockOnError: true,
      });
      const run = vi.fn().mockResolvedValue(undefined);

      expect(await gate.runUnlessBlocked(run)).toBe(true);
      expect(run).toHaveBeenCalledTimes(1);
      expect(gate.modalOpen.value).toBe(false);
    });

    it("does not save, and does not open the modal, when the gate would block", async () => {
      const { gate } = createGate({
        issues: [makeIssue("error")],
        blockOnError: true,
      });
      const run = vi.fn().mockResolvedValue(undefined);

      expect(await gate.runUnlessBlocked(run)).toBe(false);
      expect(run).not.toHaveBeenCalled();
      expect(gate.modalOpen.value).toBe(false);
    });

    it("leaves nothing pending, so a later confirm cannot flush a skipped save", async () => {
      const { gate } = createGate({
        issues: [makeIssue("error")],
        blockOnError: true,
      });
      const run = vi.fn().mockResolvedValue(undefined);

      await gate.runUnlessBlocked(run);
      await gate.confirmAndSave();

      expect(run).not.toHaveBeenCalled();
    });

    it("lets the save through again once the blocking issues are fixed", async () => {
      const { gate, issues } = createGate({
        issues: [makeIssue("error")],
        blockOnError: true,
      });
      const run = vi.fn().mockResolvedValue(undefined);

      await gate.runUnlessBlocked(run);
      issues.value = [];
      expect(await gate.runUnlessBlocked(run)).toBe(true);

      expect(run).toHaveBeenCalledTimes(1);
    });

    it("awaits the underlying save before resolving", async () => {
      const { gate } = createGate({ issues: [], blockOnError: true });
      const order: string[] = [];
      const run = vi.fn(async () => {
        await Promise.resolve();
        order.push("save-settled");
      });

      await gate.runUnlessBlocked(run);
      order.push("returned");

      expect(order).toEqual(["save-settled", "returned"]);
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

  /**
   * The composable can only guarantee the *rule*; which save path uses which
   * method is a wiring decision, and the failure mode — autosave quietly
   * writing past a server policy — is invisible to a unit test of either piece
   * on its own.
   *
   * There is one header, so the gate is handed to `useTemplatesFeature` and every
   * save path — the button, Cmd+S, autosave, the restore confirmation — goes
   * through it. That is the whole reason `SaveGate` exists as a named contract
   * rather than as Cloud internals: a shared header reaching the provider directly
   * would silently drop `accessibility.blockOnError`.
   */
  describe("wiring into the shared templates feature", () => {
    const src = (...parts: string[]) =>
      readFileSync(join(import.meta.dirname, "..", "src", ...parts), "utf8");

    const feature = src("composables", "useTemplatesFeature.ts");
    const editor = src("Editor.vue");
    const runtime = src("cloud", "createCloudRuntime.ts");

    function body(source: string, name: string): string {
      const start = source.indexOf(`function ${name}(`);
      expect(start).toBeGreaterThan(-1);
      const open = source.indexOf("{", start);
      return source.slice(open, source.indexOf("\n  }", open));
    }

    it("routes the manual save through the gate's modal", () => {
      expect(body(feature, "requestSave")).toContain(
        "gate.tryRunSave(() => runSave(trigger))",
      );
    });

    it("routes autosave through runUnlessBlocked, not around the gate", () => {
      const autoSave = body(feature, "requestAutoSave");
      expect(autoSave).toContain(
        'gate.runUnlessBlocked(() => runSave("autosave"))',
      );
      expect(autoSave).not.toContain("tryRunSave");
    });

    it("hands the gate to the feature only when Cloud supplies one", () => {
      expect(editor).toContain(
        "getSaveGate: props.cloud ? () => props.cloud!.getSaveGate() : undefined",
      );
      // Read through a getter, because the gate needs `core.templateLint` and so
      // cannot exist when the feature is constructed.
      expect(runtime).toContain("getSaveGate: () => saveGate");
    });

    it("drives the modal from the panels wrapper rather than a second header", () => {
      const panels = src("cloud", "components", "CloudPanels.vue");
      expect(panels).toContain("ready.saveGate.modalOpen.value");
      expect(panels).toContain("ready.saveGate.confirmAndSave");
    });

    it("withdraws the restore confirmation's save offer while the gate blocks", () => {
      // Same rule as autosave rather than a second modal stacked on the
      // confirmation: while the gate blocks there is effectively nowhere to put
      // the work, and the confirmation says so.
      expect(editor).toContain(
        "!(props.cloud?.getSaveGate()?.shouldBlock.value ?? false)",
      );
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
