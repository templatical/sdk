// @vitest-environment happy-dom
//
// Editor.vue with a collaboration provider: who else is here, others' locks on
// any block (inside columns too), and a refused selection's notice.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import {
  CollaborationConflict,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createTitleBlock,
  type BlockLockHolder,
  type CollaborationMember,
  type CollaborationProvider,
  type Template,
  type TemplateContent,
} from "@templatical/types";
import Editor from "../src/Editor.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";

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

function member(holder: BlockLockHolder): CollaborationMember {
  return {
    sessionId: holder.sessionId,
    userId: holder.type === "guest" ? null : holder.id,
    name: holder.name,
    type: holder.type === "guest" ? "guest" : "user",
    color: holder.color,
  };
}

function setup() {
  const title = createTitleBlock({ content: "<p>Hello</p>" });
  const paragraph = createParagraphBlock({ content: "<p>Left</p>" });
  const section = createSectionBlock({
    columns: "2",
    children: [[paragraph], []],
  });
  const content: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks: [title, section],
  };
  const provider: CollaborationProvider = {
    join: vi.fn(async (_templateId, session) => ({
      revision: 0,
      locks: [
        {
          blockId: paragraph.id,
          holder: GRACE,
          expiresAt: "2026-10-19T12:00:30.000Z",
        },
      ],
      members: [
        {
          sessionId: session.sessionId,
          userId: "u-1",
          name: "Ada",
          type: "user" as const,
          color: "#3b82f6",
        },
        member(GRACE),
        member(GUEST),
      ],
      leave: () => {},
    })),
    submit: vi.fn(async () => ({ revision: 1 })),
    operationsAfter: vi.fn(async () => ({ revision: 0, batches: [] })),
    acquireLock: vi.fn(async () => {
      throw new CollaborationConflict("Someone else is editing this block.", {
        code: "lock_held",
        holder: GUEST,
      });
    }),
    renewLock: vi.fn(),
    releaseLock: vi.fn(async () => {}),
  };
  return { title, paragraph, content, provider };
}

async function mountEditor(config: Record<string, unknown> = {}) {
  const s = setup();
  const wrapper = mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content: s.content,
        user: { id: "u-1", name: "Ada" },
        templates: {
          load: async (id: string): Promise<Template> => ({
            id,
            revision: 0,
            content: s.content,
          }),
          create: false,
          save: false,
        },
        collaboration: s.provider,
        ...config,
      },
      translations: await loadTranslations("en"),
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
  await (
    wrapper.vm as unknown as { load: (id: string) => Promise<Template> }
  ).load("tpl-1");
  for (let i = 0; i < 5; i++) await flushPromises();
  return { ...s, wrapper };
}

describe("Editor.vue with a collaboration provider", () => {
  it("shows everyone else in the header", async () => {
    const { wrapper } = await mountEditor();

    // The bar is a lazy chunk: the first mount in a worker waits for it.
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="collaborator-bar"]').exists()).toBe(
        true,
      ),
    );
    const avatars = wrapper.findAll('[data-testid="collaborator-avatar"]');
    expect(avatars.map((avatar) => avatar.attributes("title"))).toEqual([
      "Grace",
      "Guest",
    ]);
  });

  it("outlines a block inside a column that someone else holds", async () => {
    const { wrapper, paragraph } = await mountEditor();

    const lock = wrapper
      .get(`[data-block-id="${paragraph.id}"]`)
      .get('[data-testid="block-lock"]');
    expect(lock.attributes("data-lock-holder")).toBe("s-grace");
    expect(lock.text()).toBe("Grace is editing");
  });

  it("refuses a block someone else took first, saying who", async () => {
    const { wrapper, title, provider } = await mountEditor();

    await wrapper.get(`[data-block-id="${title.id}"]`).trigger("click");
    // The notices are a lazy chunk too.
    await vi.waitFor(() =>
      expect(wrapper.find('[data-kind="selectionRefused"]').exists()).toBe(
        true,
      ),
    );

    expect(provider.acquireLock).toHaveBeenCalledWith("tpl-1", title.id, null);
    expect(wrapper.get('[data-kind="selectionRefused"]').text()).toContain(
      "Guest is editing this block.",
    );
    expect(
      wrapper
        .get(`[data-block-id="${title.id}"]`)
        .get('[data-testid="block-lock"]')
        .attributes("data-lock-holder"),
    ).toBe("s-guest");
  });

  it("turns collaboration off, and says so, without a templates provider", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { provider, content } = setup();

    const wrapper = mount(Editor, {
      props: {
        config: {
          container: document.createElement("div"),
          content,
          collaboration: provider,
        },
        translations: await loadTranslations("en"),
        fontsManager: useFonts(undefined),
      } as never,
      global: { stubs: { teleport: true } },
    });
    await flushPromises();

    expect(
      warn.mock.calls.some((call) =>
        call.join(" ").includes("config.collaboration needs config.templates"),
      ),
    ).toBe(true);
    expect(provider.join).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="collaborator-bar"]').exists()).toBe(
      false,
    );
    warn.mockRestore();
  });

  it("joins the loaded template with the editor's session", async () => {
    const { provider } = await mountEditor();

    expect(provider.join).toHaveBeenCalledWith(
      "tpl-1",
      { sessionId: expect.stringMatching(/^[0-9a-f-]{36}$/) },
      expect.any(Object),
    );
  });
});

describe("Editor.vue with an agent's batch", () => {
  const AGENT = {
    type: "mcp" as const,
    id: "u-1",
    name: "Ada",
    sessionId: null,
    client: "Claude",
  };
  const MERGE_TAGS = {
    tags: [{ label: "First name", value: "{{first_name}}" }],
  };

  /** Mount, then deliver an agent's batch that adds a paragraph with a raw tag. */
  async function agentAddsParagraph() {
    const mounted = await mountEditor({ mergeTags: MERGE_TAGS });
    const handlers = vi.mocked(mounted.provider.join).mock.calls[0][2];
    const block = {
      ...createParagraphBlock({ content: "<p>Hi {{first_name}}</p>" }),
      id: "p-agent",
    };

    handlers.onBatch({
      revision: 1,
      batchId: "agent-1",
      actor: AGENT,
      ops: [{ op: "addBlock", block, parent: null, after: mounted.title.id }],
    });
    for (let i = 0; i < 5; i++) await flushPromises();
    return mounted;
  }

  it("shows the agent's raw merge tag as a tag at once, and sends nothing back", async () => {
    const { wrapper, provider } = await agentAddsParagraph();

    const tag = wrapper
      .get('[data-block-id="p-agent"]')
      .get('[data-merge-tag="{{first_name}}"]');
    expect(tag.text()).toBe("First name");
    expect(provider.submit).not.toHaveBeenCalled();
  });

  it("says which agent changed what, and outlines the block it added", async () => {
    const { wrapper } = await agentAddsParagraph();

    // The notices are a lazy chunk.
    await vi.waitFor(() =>
      expect(wrapper.find('[data-kind="agentEdited"]').exists()).toBe(true),
    );
    expect(wrapper.get('[data-kind="agentEdited"]').text()).toBe(
      "Claude for Ada changed a block.",
    );
    expect(
      wrapper
        .get('[data-block-id="p-agent"]')
        .find('[data-testid="block-agent-highlight"]')
        .exists(),
    ).toBe(true);
  });

  it("holds the highlight still under reduced motion", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../src/components/blocks/BlockWrapper.vue"),
      "utf8",
    );

    expect(source).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.tpl-block-agent-highlight \{\s*animation: none;/,
    );
  });

  it("says an agent updated the template when its re-sync arrives, outlining nothing", async () => {
    const { wrapper, provider } = await mountEditor({ mergeTags: MERGE_TAGS });
    const handlers = vi.mocked(provider.join).mock.calls[0][2];

    handlers.onResync(1, AGENT);
    for (let i = 0; i < 5; i++) await flushPromises();

    await vi.waitFor(() =>
      expect(wrapper.find('[data-kind="agentEdited"]').exists()).toBe(true),
    );
    expect(wrapper.get('[data-kind="agentEdited"]').text()).toBe(
      "Claude for Ada updated the template.",
    );
    expect(wrapper.find('[data-testid="block-agent-highlight"]').exists()).toBe(
      false,
    );
  });
});
