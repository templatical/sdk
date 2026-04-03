import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(__dirname, "../src/cloud/components/TplModal.vue"),
  "utf-8",
);

describe("TplModal.vue structure", () => {
  it("accepts visible boolean prop", () => {
    expect(src).toContain("visible: boolean");
  });

  it("emits close and keydown events", () => {
    expect(src).toMatch(/\(e: "close"\)/);
    expect(src).toMatch(/\(e: "keydown", event: KeyboardEvent\)/);
  });

  it("uses Teleport to body", () => {
    expect(src).toContain('<Teleport to="body">');
  });

  it("uses Transition with correct animation classes", () => {
    expect(src).toContain("tpl:transition tpl:duration-150");
    expect(src).toContain("tpl:opacity-0");
    expect(src).toContain("tpl:opacity-100");
    expect(src).toContain("tpl:transition tpl:duration-100");
  });

  it("renders backdrop with correct classes and styles", () => {
    expect(src).toContain(
      "tpl tpl:fixed tpl:inset-0 tpl:z-modal tpl:flex tpl:items-center tpl:justify-center",
    );
    expect(src).toContain("background-color: var(--tpl-overlay)");
    expect(src).toContain("backdrop-filter: blur(8px)");
  });

  it("uses v-if on visible prop for conditional rendering", () => {
    expect(src).toContain('v-if="visible"');
  });

  it("emits close on backdrop click.self", () => {
    expect(src).toContain("@click.self=\"emit('close')\"");
  });

  it("handles Escape key to emit close", () => {
    expect(src).toContain('event.key === "Escape"');
    expect(src).toContain('emit("close")');
  });

  it("forwards keydown event for consumer handling", () => {
    expect(src).toContain('emit("keydown", event)');
  });

  it("sets up useFocusTrap on dialogRef", () => {
    expect(src).toContain("useFocusTrap");
    expect(src).toContain("const dialogRef = ref<HTMLElement | null>(null)");
    expect(src).toContain("useFocusTrap(dialogRef, isVisible)");
  });

  it("injects tplUiTheme and applies it to backdrop", () => {
    expect(src).toContain('inject<Ref<"light" | "dark">>("tplUiTheme")');
    expect(src).toContain(':data-tpl-theme="tplUiTheme"');
  });

  it("uses default slot for modal content", () => {
    expect(src).toContain("<slot />");
  });
});

// ── Consumers use TplModal ────────────────────────────────────────────────────

describe("TplModal consumers", () => {
  const testEmailSrc = readFileSync(
    resolve(__dirname, "../src/cloud/components/TestEmailModal.vue"),
    "utf-8",
  );
  const saveModuleSrc = readFileSync(
    resolve(__dirname, "../src/cloud/components/SaveModuleDialog.vue"),
    "utf-8",
  );
  const moduleBrowserSrc = readFileSync(
    resolve(__dirname, "../src/cloud/components/ModuleBrowserModal.vue"),
    "utf-8",
  );

  it("TestEmailModal uses TplModal instead of raw Teleport", () => {
    expect(testEmailSrc).toContain("import TplModal from");
    expect(testEmailSrc).toContain("<TplModal");
    expect(testEmailSrc).not.toContain("<Teleport");
  });

  it("SaveModuleDialog uses TplModal instead of raw Teleport", () => {
    expect(saveModuleSrc).toContain("import TplModal from");
    expect(saveModuleSrc).toContain("<TplModal");
    expect(saveModuleSrc).not.toContain("<Teleport");
  });

  it("ModuleBrowserModal uses TplModal instead of raw Teleport", () => {
    expect(moduleBrowserSrc).toContain("import TplModal from");
    expect(moduleBrowserSrc).toContain("<TplModal");
    expect(moduleBrowserSrc).not.toContain("<Teleport");
  });

  it("consumers no longer import useFocusTrap directly", () => {
    expect(testEmailSrc).not.toContain("useFocusTrap");
    expect(saveModuleSrc).not.toContain("useFocusTrap");
    expect(moduleBrowserSrc).not.toContain("useFocusTrap");
  });

  it("consumers no longer inject tplUiTheme directly", () => {
    expect(testEmailSrc).not.toContain("tplUiTheme");
    expect(saveModuleSrc).not.toContain("tplUiTheme");
    expect(moduleBrowserSrc).not.toContain("tplUiTheme");
  });
});
