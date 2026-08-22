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
      // Nothing to name or date before `create()` / `load()` resolves, and
      // `save()` patches an id — so the field would have nowhere to send a
      // rename.
      const header = headerSource();
      expect(header).toContain("templates?.isAvailable.value &&");
      expect(header).toContain("templates.hasTemplate.value &&");
    });

    it("hides the field on templateNameField: false, whatever the provider allows", () => {
      // A store with no name column, or a consumer whose own chrome owns the
      // name: the gate is the config, not `canSave`.
      expect(headerSource()).toContain('v-if="showTemplateName"');
    });

    it("takes that flag from config, defaulting to shown", () => {
      expect(editorSource).toContain(
        ':show-template-name="config.templateNameField !== false"',
      );
    });

    it("keeps the identity stack out of the row when nothing in it renders", () => {
      // The stack is a flex child of a `gap-2.5` row, so an empty one would
      // indent Cloud's left extras by a gap that has nothing before it.
      expect(headerSource()).toContain(
        "(showTemplateName || templates.timestamp.value)",
      );
    });

    it("is editable only when the provider can save", () => {
      expect(headerSource()).toContain(':editable="templates.canSave.value"');
    });

    it("commits a rename through the feature rather than the editor directly", () => {
      expect(headerSource()).toContain('@commit="templates.rename"');
    });
  });

  describe("left column — the write time", () => {
    it("stacks under the name rather than beside it", () => {
      const header = headerSource();
      const left = header.slice(
        header.indexOf("tpl-header-left"),
        header.indexOf('name="left-extras"'),
      );
      expect(left).toContain("<TemplateTimestamp");
      expect(left).toContain("tpl:flex-col");
      expect(left.indexOf("<TemplateNameField")).toBeLessThan(
        left.indexOf("<TemplateTimestamp"),
      );
    });

    it("gates on the value alone — not on canSave, not on the name flag", () => {
      // A `save: false` template hides the whole status indicator, so this line
      // is the only thing left that says how current the stored copy is. And it
      // has to survive `templateNameField: false`, which is the case where it
      // becomes the left column's only content.
      expect(headerSource()).toContain('v-if="templates.timestamp.value"');
    });

    it("offsets the stack for the name button's internal lead", () => {
      // The name is a button — border + `py-1` + half its leading sit above its
      // text, and the timestamp has nothing below its own. Centring the boxes
      // therefore banks all of that lead at the top: measured 11px above the
      // title against 6px below the timestamp. 6px of bottom padding brings it
      // to 8/9.
      expect(headerSource()).toContain("'tpl:pb-1.5':");
    });

    it("offsets only when both lines render", () => {
      // Either line alone is already centred on its own box, so an
      // unconditional offset would push a lone timestamp 3px off centre.
      const header = headerSource();
      const binding = header.slice(
        header.indexOf("'tpl:pb-1.5':"),
        header.indexOf("}\"\n      >"),
      );
      expect(binding).toContain("showTemplateName");
      expect(binding).toContain("templates.timestamp.value !== null");
    });

    it("passes the value and which field it came from", () => {
      // Without `kind` the label would have to guess, and would call a
      // never-updated template updated.
      const header = headerSource();
      expect(header).toContain(':iso="templates.timestamp.value.iso"');
      expect(header).toContain(':kind="templates.timestamp.value.kind"');
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

    it("offers a slot in each anchored column", () => {
      // Two, not three. The centre track carries no slot: its width must stay
      // constant or it re-centres and moves the Preview button (#574), and a
      // slot is the one thing a guard test cannot stop someone filling. See
      // `headerCenterStability.test.ts`.
      for (const name of ["left-extras", "right-extras"]) {
        expect(headerSource()).toContain(`<slot name="${name}" />`);
      }
      expect(headerSource()).not.toContain("center-extras");
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

  describe("right column — quiet at rest, amber on news", () => {
    /**
     * All three controls share one recipe, so nothing in the header competes with
     * the canvas and all three sit at one size and one height. Amber enters on a
     * single condition — Save's fill, while the template is dirty — because
     * amber announces intent or selection, and a control that wears it
     * unconditionally announces neither.
     */
    it("Save is primary only while dirty, secondary otherwise", () => {
      // Amber announces intent or selection, so a Save that looks the same dirty
      // or clean announces nothing. Gated on `hasTemplate` too, or a disabled
      // button would light up before there is anywhere to save to.
      const header = headerSource();
      const save = header.slice(header.indexOf('data-testid="template-save"'));
      expect(save).toContain(
        "editor.state.isDirty && templates.hasTemplate.value",
      );
      expect(save).toContain("? primaryBtnCompactClass");
      expect(save).toContain(": secondaryBtnCompactClass");
      // Never unconditionally primary — that is the version that read as loud.
      expect(save).not.toContain(':class="primaryBtnCompactClass"');
    });

    it("Save lifts on the same condition", () => {
      // Depth answers state: flat at rest, a light lift once there is unsaved
      // work. Inline rather than in the recipe, because the recipe is shared and
      // a primary button at rest elsewhere should still be flat.
      const save = headerSource().slice(
        headerSource().indexOf('data-testid="template-save"'),
      );
      expect(save).toContain("boxShadow: 'var(--tpl-shadow-sm)'");
    });

    it("Comments and Test are always secondary", () => {
      const header = headerSource();
      // Bounded per button: an unbounded slice runs to the end of the header, so
      // a `secondaryBtnCompactClass` assertion on Comments would be satisfied by Test.
      const region = (from: string, to: string) => {
        const start = header.indexOf(from);
        const end = header.indexOf(to);
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        return header.slice(start, end);
      };

      const comments = region('data-testid="comments-trigger"', 'name="right-extras"');
      const test = region('data-testid="test-email-trigger"', 'data-testid="template-save"');
      const save = header.slice(header.indexOf('data-testid="template-save"'));

      expect(comments).toContain(':class="secondaryBtnCompactClass"');
      expect(test).toContain(':class="secondaryBtnCompactClass"');
      // Save's resting state is the same recipe; it reaches it through the
      // ternary rather than a bare binding, which the primary test above covers.
      expect(save).toContain(": secondaryBtnCompactClass");
      // Only Comments tints its surface, and only while its panel is open.
      expect(test).not.toContain(":style");
    });

    it("no button is unconditionally amber", () => {
      // The dialect this replaced was a static `style` attribute — transparent
      // fill, amber border, amber label, on whether or not anything was
      // happening. Amber now appears only inside a `:style` ternary, so every
      // control is quiet at rest and the amber means something when it shows.
      const header = headerSource();
      expect(header).not.toContain("headerBtnClass");
      // Negative lookbehind: `:style="` contains `style="`, so an unanchored
      // pattern flags the very bindings this test means to allow.
      expect(header).not.toMatch(/(?<!:)style="[^"]*--tpl-primary/);

      const bindings = [...header.matchAll(/:style="([\s\S]*?)"/g)].map((m) => m[1]);
      const amber = bindings.filter((b) => b.includes("--tpl-primary"));
      // One: Comments' open tint. Save's amber travels in its class binding,
      // which the primary/secondary assertions above cover.
      expect(amber).toHaveLength(1);
      for (const binding of amber) {
        expect(binding).toMatch(/isOpen/);
        expect(binding).toContain("undefined");
      }
      // And the class binding is gated too, never a bare primary.
      expect(header).not.toContain(':class="primaryBtnCompactClass"');
    });

    it("Comments' open state is not Save's resting paint", () => {
      // An amber-filled open state is pixel-identical to the primary button, so
      // an open panel and the save action would read as the same thing.
      const header = headerSource();
      const comments = header.slice(
        header.indexOf('data-testid="comments-trigger"'),
        header.indexOf('name="right-extras"'),
      );
      expect(comments).toContain("backgroundColor: 'var(--tpl-primary-light)'");
      expect(comments).not.toContain("'var(--tpl-primary)'");
    });

    it("the header is opaque and carries no backdrop blur", () => {
      // `.tpl-body` begins at this header's own height, so there is never
      // anything behind it to blur or to show through.
      const header = headerSource();
      expect(header).toContain("tpl:bg-[var(--tpl-bg)]");
      expect(header).not.toContain("backdrop-filter");
      expect(header).not.toContain("color-mix");
    });

    it("sticky chrome uses the shadow step assigned to it", () => {
      expect(headerSource()).toContain("tpl:shadow-[var(--tpl-shadow-sm)]");
      expect(headerSource()).not.toContain("tpl:shadow-[var(--tpl-shadow-md)]");
    });
  });

  describe("wiring", () => {
    it("builds the feature only when a provider is configured", () => {
      // Gated on `templatesProvider`, which is defined exactly when
      // `config.templates` is — see the wrapper assertion below.
      expect(editorSource).toMatch(
        /const templates =\s*templatesProvider\s*\?\s*useTemplatesFeature\(/,
      );
      expect(editorSource).toMatch(/useTemplatesFeature\([\s\S]*?\)\s*:\s*null;/);
    });

    it("normalizes merge tags in whatever the provider loads", () => {
      // A template fetched from the store is the one content-in path that never
      // passes through the public API — core assigns it to state itself — so the
      // provider is wrapped before it gets there. Both consumers must read the
      // wrapper, or `load()` and the header's capability disagree about which
      // provider is in play.
      expect(editorSource).toMatch(
        /const templatesProvider = props\.config\.templates\s*\?\s*withNormalizedTemplateLoads\(/,
      );
      expect(editorSource).toContain("templates: templatesProvider,");
      expect(editorSource).toContain("provider: templatesProvider,");
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
        "createdAt",
        "createdJustNow",
        "rename",
        "save",
        "saveFailed",
        "saveNoTemplate",
        "saved",
        "saving",
        "templateName",
        "unsaved",
        "untitled",
        "updatedAt",
        "updatedJustNow",
      ]);
    });

    it("does not pull the plan-limit readout into the OSS chunk", () => {
      // `header.templatesUsed` is a Cloud plan concern, not a templates one.
      expect("templatesUsed" in en.header).toBe(false);
    });
  });
});
