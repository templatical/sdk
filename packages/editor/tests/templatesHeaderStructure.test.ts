import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import en from "../src/i18n/locales/en";

/**
 * Structural assertions on the templates surface in the shared `EditorHeader`.
 *
 * The markup lives in its own component now — one header for both entry points,
 * with Cloud's controls arriving through slots. These are the header decisions
 * from the BYO templates design that a component test can't see, plus the two
 * gates whose failure mode is a control that renders and does nothing:
 *
 *  - the name field and Save button appear only when a provider is configured;
 *  - `save: false` hides the Save button **and** the status indicator, and makes
 *    the name read-only — there is nowhere for a change to go;
 *  - Save is last in the right column, because it is the primary action;
 *  - the left column carries `min-w-[200px]`, or the centre controls aren't
 *    actually centred against the right column's matching width.
 */
const SRC = join(import.meta.dirname, "..", "src");
const editorSource = readFileSync(join(SRC, "Editor.vue"), "utf8");
const headerComponent = readFileSync(
  join(SRC, "components", "EditorHeader.vue"),
  "utf8",
);

function headerSource(): string {
  const start = headerComponent.indexOf("<header");
  const end = headerComponent.indexOf("</header>");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return headerComponent.slice(start, end);
}

describe("EditorHeader templates surface", () => {
  describe("left column — the template name", () => {
    it("renders the inline name field", () => {
      expect(headerSource()).toContain("<TemplateNameField");
    });

    it("carries min-w-[200px] so the centre column is centred", () => {
      const left = headerSource().slice(
        headerSource().indexOf("tpl-header-left"),
        headerSource().indexOf("tpl-header-center") + 1 ||
          headerSource().indexOf("<TemplateNameField"),
      );
      expect(left).toContain("tpl:min-w-[200px]");
    });

    it("renders only with an available provider and a loaded template", () => {
      // Nothing to name before `create()` / `load()` resolves, and `save()`
      // patches an id — so the field would have nowhere to send a rename.
      expect(headerSource()).toContain(
        'v-if="templates?.isAvailable.value && templates.hasTemplate.value"',
      );
    });

    it("is editable only when the provider can save", () => {
      expect(headerSource()).toContain(':editable="templates.canSave.value"');
    });

    it("commits a rename through the feature rather than the editor directly", () => {
      expect(headerSource()).toContain('@commit="templates.rename"');
    });
  });

  describe("one header, not two", () => {
    // `CloudHeader.vue` was a second copy of this layout kept in step by hand,
    // and it had already drifted (only it carried `min-w-[200px]`). Cloud now
    // fills three slots in this component instead.
    it("Editor.vue renders the shared header rather than inline markup", () => {
      expect(editorSource).toContain("<EditorHeader");
      expect(editorSource).not.toContain("<header");
    });

    it("offers a slot in each of the three columns", () => {
      for (const name of ["left-extras", "center-extras", "right-extras"]) {
        expect(headerSource()).toContain(`<slot name="${name}" />`);
      }
    });

    it("puts the cloud extras between the status indicator and the test email", () => {
      const header = headerSource();
      const status = header.indexOf("<TemplateSaveStatus");
      const extras = header.indexOf('<slot name="right-extras" />');
      const testEmail = header.indexOf('data-testid="test-email-trigger"');
      expect(status).toBeLessThan(extras);
      expect(extras).toBeLessThan(testEmail);
    });
  });

  describe("right column — status and save", () => {
    it("gates the status indicator on a provider that can save", () => {
      // Without one the editor never learns that a save completed, so the badge
      // could only ever read "unsaved".
      const status = headerSource().slice(
        headerSource().indexOf("<TemplateSaveStatus"),
      );
      expect(status).toContain(
        'v-if="templates?.isAvailable.value && templates.canSave.value"',
      );
    });

    it("gates the save button on the same condition", () => {
      const header = headerSource();
      const testid = header.indexOf('data-testid="template-save"');
      // The `v-if` sits on the opening tag, above the testid.
      const button = header.slice(
        header.lastIndexOf("<button", testid),
        testid,
      );
      expect(button).toContain(
        'v-if="templates?.isAvailable.value && templates.canSave.value"',
      );
    });

    it("puts Save last, after the status indicator and the test-email trigger", () => {
      const header = headerSource();
      const status = header.indexOf("<TemplateSaveStatus");
      const testEmail = header.indexOf('data-testid="test-email-trigger"');
      const save = header.indexOf('data-testid="template-save"');

      expect(status).toBeGreaterThan(-1);
      expect(testEmail).toBeGreaterThan(-1);
      expect(save).toBeGreaterThan(-1);
      expect(status).toBeLessThan(testEmail);
      expect(testEmail).toBeLessThan(save);
    });

    it("disables Save while saving and before a template exists", () => {
      expect(headerSource()).toContain(
        ':disabled="templates.isSaving.value || !templates.hasTemplate.value"',
      );
    });

    it("explains the disabled state rather than leaving it bare", () => {
      expect(headerSource()).toContain("core.t.header.saveNoTemplate");
      expect(en.header.saveNoTemplate.length).toBeGreaterThan(0);
    });
  });

  describe("wiring", () => {
    it("builds the feature only when a provider is configured", () => {
      expect(editorSource).toMatch(
        /const templates =\s*props\.config\.templates\s*\?\s*useTemplatesFeature\(/,
      );
      expect(editorSource).toMatch(/useTemplatesFeature\([\s\S]*?\)\s*:\s*null;/);
    });

    it("routes saves through a gate when one is configured", () => {
      // Cloud's lint save-gate. Without this, a shared header would silently drop
      // the server's `accessibility.blockOnError` policy, because the save reaches
      // the provider through the capability rather than through Cloud's own chrome.
      expect(editorSource).toContain(
        "getSaveGate: props.cloud ? () => props.cloud!.getSaveGate() : undefined",
      );
      expect(editorSource).toContain("templates!.requestAutoSave()");
    });

    it("passes the templates capability into useEditorCore", () => {
      expect(editorSource).toContain(
        "...(templates ? { templates: templates.capability } : {})",
      );
    });

    it("only autosaves when a provider exists to save to", () => {
      // `autoSave` is `boolean | { debounce }`, so the enabled test goes through
      // `resolveAutoSave` rather than comparing to `true` — an object form would
      // otherwise read as "off" and silently disable autosave for anyone who set
      // a cadence.
      expect(editorSource).toContain(
        "resolveAutoSave(props.config.autoSave, false)",
      );
      expect(editorSource).toContain(
        "autoSaveConfig.enabled && templates !== null",
      );
    });

    it("warns instead of silently ignoring autoSave without a provider", () => {
      expect(editorSource).toContain("config.autoSave is on but no `templates`");
    });

    it("exposes the lifecycle trio and isDirty on the instance", () => {
      expect(editorSource).toContain("create: templateLifecycle.create");
      expect(editorSource).toContain("load: templateLifecycle.load");
      expect(editorSource).toContain("save: templateLifecycle.save");
      expect(editorSource).toContain("isDirty: () => editor.state.isDirty");
    });

    it("reports dirtiness regardless of whether a provider is configured", () => {
      // A `beforeunload` guard can't cover SPA route changes, so a consumer
      // persisting via `onChange` needs this callback just as much.
      const block = editorSource.slice(
        editorSource.indexOf("if (props.config.onDirtyChange)"),
      );
      expect(block).toContain("() => editor.state.isDirty");
      expect(block.slice(0, 200)).not.toContain("templates");
    });
  });

  describe("i18n", () => {
    it("keeps every header string the OSS chunk needs", () => {
      expect(Object.keys(en.header).sort()).toEqual([
        "rename",
        "save",
        "saveFailed",
        "saveNoTemplate",
        "saved",
        "saving",
        "templateName",
        "unsaved",
        "untitled",
      ]);
    });

    it("does not pull the plan-limit readout into the OSS chunk", () => {
      // `header.templatesUsed` is a Cloud plan concern, not a templates one.
      expect("templatesUsed" in en.header).toBe(false);
    });
  });
});
