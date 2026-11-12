// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  safeClone,
  type MergeTag,
  type TemplateContent,
} from "@templatical/types";
import Editor from "../src/Editor.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";

/**
 * Preview mode showing what `resolvePreview` returned.
 *
 * A host usually resolves tags in place: it renders each string through its own
 * engine, which evaluates the token inside `data-merge-tag` too, so the span
 * survives with the value where the token was. The preview must show that value
 * as ordinary text, like a sample in Sample view, and drop the logic badges the
 * host evaluated. Before this, every resolved value ("Cruz", "Rau") rendered as
 * a highlighted merge-tag chip.
 *
 * Unresolved previews (no hook, or the fallback after a failure) keep labels,
 * badges and the Sample/Label switch exactly as before.
 */

const TAGS: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}", sample: "Ada" },
  { label: "Last Name", value: "{{last_name}}", sample: "Lovelace" },
];

/** Stored as TipTap writes it: the attribute holds the token, the text the label. */
const STORED_HTML =
  '<p><span data-logic-merge-tag="{% if vip %}" data-keyword="IF">IF</span>Welcome back<span data-logic-merge-tag="{% endif %}" data-keyword="ENDIF">ENDIF</span>, ' +
  '<span data-merge-tag="{{first_name}}" data-label="First Name">First Name</span> ' +
  '<span data-merge-tag="{{last_name}}" data-label="Last Name">Last Name</span></p>';

/**
 * The same paragraph after a host rendered the whole string through its engine
 * for a VIP guest called Cruz Rau: every token, including the ones in the
 * attributes, was evaluated; the labels inside the spans were left alone.
 */
const RESOLVED_HTML =
  '<p><span data-logic-merge-tag="" data-keyword="IF">IF</span>Welcome back<span data-logic-merge-tag="" data-keyword="ENDIF">ENDIF</span>, ' +
  '<span data-merge-tag="Cruz" data-label="First Name">First Name</span> ' +
  '<span data-merge-tag="Rau" data-label="Last Name">Last Name</span></p>';

function template(html = STORED_HTML): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = [createParagraphBlock({ id: "greeting", content: html })];
  return content;
}

function resolvedFrom(content: TemplateContent, html: string): TemplateContent {
  const resolved = safeClone(content);
  (resolved.blocks[0] as { content: string }).content = html;
  return resolved;
}

const wrappers: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  document.body.innerHTML = "";
});

async function openPreview(config: Record<string, unknown>) {
  const wrapper = mount(Editor, {
    attachTo: document.body,
    props: {
      config: {
        container: document.createElement("div"),
        content: template(),
        mergeTags: { tags: TAGS },
        ...config,
      },
      translations: await loadTranslations("en"),
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
  wrappers.push(wrapper);
  await wrapper.find(".tpl-preview-toggle").trigger("click");
  await flushPromises();
  return wrapper;
}

function paragraph(wrapper: VueWrapper): HTMLElement {
  return wrapper.get('[data-block-id="greeting"] .tpl-text-content')
    .element as HTMLElement;
}

describe("preview mode showing a resolved template", () => {
  it("renders values the host resolved in place as plain text, with no chip", async () => {
    const resolver = vi.fn(async ({ content }: { content: TemplateContent }) =>
      resolvedFrom(content, RESOLVED_HTML),
    );
    const wrapper = await openPreview({ resolvePreview: resolver });
    const el = paragraph(wrapper);

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(el.textContent).toBe("Welcome back, Cruz Rau");
    // The highlight is CSS on these spans; none may survive.
    expect(el.querySelectorAll("[data-merge-tag]")).toHaveLength(0);
    expect(el.querySelectorAll("[data-logic-merge-tag]")).toHaveLength(0);
  });

  it("keeps a tag the host left unresolved as a highlighted label", async () => {
    const wrapper = await openPreview({
      resolvePreview: async ({ content }: { content: TemplateContent }) =>
        resolvedFrom(
          content,
          '<p>Hi <span data-merge-tag="Cruz">First Name</span> ' +
            '<span data-merge-tag="{{last_name}}">Last Name</span></p>',
        ),
    });
    const el = paragraph(wrapper);

    expect(el.textContent).toBe("Hi Cruz Last Name");
    const chips = el.querySelectorAll("[data-merge-tag]");
    expect(chips).toHaveLength(1);
    expect(chips[0]!.getAttribute("data-merge-tag")).toBe("{{last_name}}");
  });

  it("shows the unresolved template unchanged when the resolver returns it as-is", async () => {
    // The documented "no choice made yet" pattern returns `content` untouched.
    const wrapper = await openPreview({
      resolvePreview: async ({ content }: { content: TemplateContent }) =>
        content,
    });
    const el = paragraph(wrapper);

    expect(el.textContent).toBe("IFWelcome backENDIF, First Name Last Name");
    expect(el.querySelectorAll("[data-merge-tag]")).toHaveLength(2);
    expect(el.querySelectorAll("[data-logic-merge-tag]")).toHaveLength(2);
  });

  it("never touches the stored content", async () => {
    const wrapper = await openPreview({
      resolvePreview: async ({ content }: { content: TemplateContent }) =>
        resolvedFrom(content, RESOLVED_HTML),
    });

    const exposed = wrapper.vm as unknown as {
      getContent: () => TemplateContent;
    };
    expect((exposed.getContent().blocks[0] as { content: string }).content)
      .toContain('data-merge-tag="{{first_name}}"');
  });
});

describe("unresolved previews keep labels and badges", () => {
  it("highlights labels and logic badges on the fallback after a failure", async () => {
    const wrapper = await openPreview({
      resolvePreview: async () => {
        throw new Error("backend down");
      },
    });
    const el = paragraph(wrapper);

    expect(wrapper.find('[data-testid="preview-resolution-failed"]').exists())
      .toBe(true);
    expect(el.textContent).toBe("IFWelcome backENDIF, First Name Last Name");
    expect(el.querySelectorAll("[data-merge-tag]")).toHaveLength(2);
    expect(el.querySelectorAll("[data-logic-merge-tag]")).toHaveLength(2);
  });

  it("leaves the Sample/Label switch working when no resolver is set", async () => {
    const wrapper = await openPreview({});
    const toggle = wrapper.get('[data-testid="merge-tag-mode-toggle"]');

    // Sample view by default: samples as plain text, badges still shown.
    expect(paragraph(wrapper).textContent).toBe(
      "IFWelcome backENDIF, Ada Lovelace",
    );
    expect(paragraph(wrapper).querySelectorAll("[data-merge-tag]")).toHaveLength(0);
    expect(paragraph(wrapper).querySelectorAll("[data-logic-merge-tag]"))
      .toHaveLength(2);

    await toggle.get('[aria-label="Label"]').trigger("click");

    expect(paragraph(wrapper).textContent).toBe(
      "IFWelcome backENDIF, First Name Last Name",
    );
    expect(paragraph(wrapper).querySelectorAll("[data-merge-tag]")).toHaveLength(2);
  });
});
