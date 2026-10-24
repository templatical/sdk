// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import type { CollaborationConnectionState } from "@templatical/types";
import CollaborationNotices from "../src/components/collaboration/CollaborationNotices.vue";
import type {
  CollaborationNoticeView,
  UseCollaborationFeatureReturn,
} from "../src/composables/useCollaborationFeature";
import { TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";

function mountNotices(
  notices: CollaborationNoticeView[],
  connection: CollaborationConnectionState | null = "connected",
) {
  const feature = {
    notices: ref(notices),
    connection: ref(connection),
    dismissNotice: vi.fn(),
  } as unknown as UseCollaborationFeatureReturn;
  const wrapper = mount(CollaborationNotices, {
    props: { feature },
    global: { provide: { [TRANSLATIONS_KEY as symbol]: en } },
  });
  return { wrapper, feature };
}

function shown(notice: CollaborationNoticeView): string {
  return mountNotices([notice])
    .wrapper.get(`[data-kind="${notice.kind}"]`)
    .text();
}

describe("CollaborationNotices", () => {
  it.each<[string, CollaborationNoticeView, string]>([
    [
      "a refused selection",
      { id: 1, kind: "selectionRefused", name: "Grace", isGuest: false },
      "Grace is editing this block.",
    ],
    [
      "a guest's refused selection",
      { id: 1, kind: "selectionRefused", name: "Guest", isGuest: true },
      "Guest is editing this block.",
    ],
    [
      "a refused edit",
      { id: 1, kind: "editRefused", code: "precondition_failed" },
      "Your change wasn't saved: someone else changed this part first.",
    ],
    [
      "an edit refused by a lock",
      {
        id: 1,
        kind: "editRefused",
        code: "lock_held",
        name: "Grace",
        isGuest: false,
      },
      "Your change wasn't saved: Grace is editing that block.",
    ],
    [
      "an edit too large to save",
      { id: 1, kind: "editRefused", code: "content_too_large" },
      "Your change wasn't saved: it's too large.",
    ],
    [
      "a skipped undo step",
      { id: 1, kind: "undoSkipped" },
      "Couldn't undo that step: someone else has changed it since.",
    ],
    [
      "a refused replace",
      {
        id: 1,
        kind: "replaceRefused",
        holders: [
          { name: "Grace", isGuest: false },
          { name: "Guest", isGuest: true },
        ],
      },
      "Can't replace the template while others are editing: Grace, Guest.",
    ],
    [
      "an agent's edit of one block",
      {
        id: 1,
        kind: "agentEdited",
        client: "Claude",
        name: "Ada",
        blocks: 1,
        settings: false,
        templateUpdated: false,
      },
      "Claude for Ada changed a block.",
    ],
    [
      "an agent's edit of several blocks",
      {
        id: 1,
        kind: "agentEdited",
        client: "Claude",
        name: "Ada",
        blocks: 3,
        settings: false,
        templateUpdated: false,
      },
      "Claude for Ada changed 3 blocks.",
    ],
    [
      "an agent's settings change",
      {
        id: 1,
        kind: "agentEdited",
        client: "Claude",
        name: "Ada",
        blocks: 0,
        settings: true,
        templateUpdated: false,
      },
      "Claude for Ada changed the template settings.",
    ],
    [
      "an agent's change to a block and the settings",
      {
        id: 1,
        kind: "agentEdited",
        client: "Claude",
        name: "Ada",
        blocks: 1,
        settings: true,
        templateUpdated: false,
      },
      "Claude for Ada changed a block and the template settings.",
    ],
    [
      "an agent's change to blocks and the settings",
      {
        id: 1,
        kind: "agentEdited",
        client: "Claude",
        name: "Ada",
        blocks: 2,
        settings: true,
        templateUpdated: false,
      },
      "Claude for Ada changed 2 blocks and the template settings.",
    ],
    [
      "an agent's updated template",
      {
        id: 1,
        kind: "agentEdited",
        client: "Claude",
        name: "Ada",
        blocks: 2,
        settings: true,
        templateUpdated: true,
      },
      "Claude for Ada updated the template.",
    ],
    [
      "an agent that sent no name",
      {
        id: 1,
        kind: "agentEdited",
        client: null,
        name: "Ada",
        blocks: 1,
        settings: false,
        templateUpdated: false,
      },
      "An agent for Ada changed a block.",
    ],
    [
      "the AI's edit of several blocks",
      {
        id: 1,
        kind: "aiEdited",
        name: "Ada",
        blocks: 3,
        settings: false,
        templateUpdated: false,
      },
      "AI (for Ada) changed 3 blocks.",
    ],
    [
      "the AI's settings change",
      {
        id: 1,
        kind: "aiEdited",
        name: "Ada",
        blocks: 0,
        settings: true,
        templateUpdated: false,
      },
      "AI (for Ada) changed the template settings.",
    ],
    [
      "the AI's built template",
      {
        id: 1,
        kind: "aiEdited",
        name: "Ada",
        blocks: 0,
        settings: false,
        templateUpdated: true,
      },
      "AI (for Ada) updated the template.",
    ],
  ])("words %s", (_label, notice, text) => {
    expect(shown(notice)).toBe(text);
  });

  it("renders an agent's name as text, never as markup", () => {
    const { wrapper } = mountNotices([
      {
        id: 1,
        kind: "agentEdited",
        client: '<img src="x" onerror="alert(1)">',
        name: "Ada",
        blocks: 1,
        settings: false,
        templateUpdated: false,
      },
    ]);
    const notice = wrapper.get('[data-kind="agentEdited"]');

    expect(notice.text()).toBe(
      '<img src="x" onerror="alert(1)"> for Ada changed a block.',
    );
    expect(notice.find("img").exists()).toBe(false);
  });

  it("marks an agent's notice as information and a refusal as a warning", () => {
    const tone = (notice: CollaborationNoticeView) =>
      mountNotices([notice])
        .wrapper.get('[data-testid="collaboration-notice"]')
        .attributes("data-tone");

    expect(
      tone({
        id: 1,
        kind: "agentEdited",
        client: "Claude",
        name: "Ada",
        blocks: 1,
        settings: false,
        templateUpdated: false,
      }),
    ).toBe("info");
    expect(
      tone({
        id: 3,
        kind: "aiEdited",
        name: "Ada",
        blocks: 1,
        settings: false,
        templateUpdated: false,
      }),
    ).toBe("info");
    expect(tone({ id: 2, kind: "undoSkipped" })).toBe("warning");
  });

  it("shows the latest notice only, and dismisses it", async () => {
    const { wrapper, feature } = mountNotices([
      { id: 3, kind: "undoSkipped" },
      { id: 4, kind: "selectionRefused", name: "Grace", isGuest: false },
    ]);

    expect(
      wrapper.findAll('[data-testid="collaboration-notice"]'),
    ).toHaveLength(1);
    await wrapper.get('button[aria-label="Dismiss"]').trigger("click");
    expect(feature.dismissNotice).toHaveBeenCalledWith(4);
  });

  it.each(["reconnecting", "offline"] as const)(
    "says so while the connection is %s",
    (connection) => {
      const { wrapper } = mountNotices([], connection);

      expect(wrapper.get('[data-kind="reconnecting"]').text()).toBe(
        "Reconnecting… You can keep editing.",
      );
      expect(wrapper.get('[data-kind="reconnecting"]').attributes("role")).toBe(
        "status",
      );
    },
  );

  it.each(["connected", null] as const)("is quiet while %s", (connection) => {
    const { wrapper } = mountNotices([], connection);

    expect(wrapper.find('[data-testid="collaboration-notice"]').exists()).toBe(
      false,
    );
  });
});
