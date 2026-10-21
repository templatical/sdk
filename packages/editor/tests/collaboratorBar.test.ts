// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import type { CollaborationConnectionState } from "@templatical/types";
import CollaboratorBar from "../src/components/collaboration/CollaboratorBar.vue";
import type { CollaborationPerson } from "../src/composables/useCollaborationFeature";
import { TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";

function person(
  key: string,
  name: string,
  extra: Partial<CollaborationPerson> = {},
): CollaborationPerson {
  return { key, type: "user", name, color: "#3b82f6", ...extra };
}

function mountBar(
  people: CollaborationPerson[],
  connection: CollaborationConnectionState | null = "connected",
) {
  return mount(CollaboratorBar, {
    props: { people, connection },
    global: { provide: { [TRANSLATIONS_KEY as symbol]: en } },
  });
}

describe("CollaboratorBar", () => {
  it.each([
    ["connected", "Live"],
    ["reconnecting", "Reconnecting…"],
    ["offline", "Offline"],
  ] as const)("names the %s state", (connection, label) => {
    const indicator = mountBar([], connection).get(
      '[data-testid="collaborator-connection"]',
    );

    expect(indicator.attributes("title")).toBe(label);
    expect(indicator.attributes("data-state")).toBe(connection);
  });

  it("shows initials in the person's colour, or their avatar image", () => {
    const wrapper = mountBar([
      person("user:1", "Ada"),
      person("user:2", "Grace Hopper", { color: "#ef4444" }),
      person("user:3", "Alan", { avatarUrl: "https://example.com/alan.png" }),
    ]);
    const avatars = wrapper.findAll('[data-testid="collaborator-avatar"]');

    expect(avatars.map((avatar) => avatar.attributes("title"))).toEqual([
      "Ada",
      "Grace Hopper",
      "Alan",
    ]);
    expect(avatars[0].get('[aria-hidden="true"]').text()).toBe("A");
    expect(avatars[1].get('[aria-hidden="true"]').text()).toBe("GH");
    expect(avatars[1].attributes("style")).toContain("background-color");
    expect(avatars[2].get("img").attributes("src")).toBe(
      "https://example.com/alan.png",
    );
    expect(avatars[2].find('[aria-hidden="true"]').exists()).toBe(false);
  });

  it("calls every guest Guest, in the bar's own words", () => {
    const wrapper = mountBar([
      person("guest:g-1", "Guest", { type: "guest" }),
      person("guest:g-2", "Gast", { type: "guest" }),
    ]);
    const avatars = wrapper.findAll('[data-testid="collaborator-avatar"]');

    expect(avatars.map((avatar) => avatar.attributes("title"))).toEqual([
      "Guest",
      "Guest",
    ]);
    expect(
      avatars.map((avatar) => avatar.attributes("data-person-type")),
    ).toEqual(["guest", "guest"]);
  });

  it("caps the stack at three and lists the rest in the overflow title", () => {
    const wrapper = mountBar([
      person("user:1", "Ada"),
      person("user:2", "Grace"),
      person("user:3", "Alan"),
      person("user:4", "Barbara"),
      person("guest:g-5", "Guest", { type: "guest" }),
    ]);

    expect(wrapper.findAll('[data-testid="collaborator-avatar"]')).toHaveLength(
      3,
    );
    const overflow = wrapper.get('[data-testid="collaborator-overflow"]');
    expect(overflow.text()).toBe("+2");
    expect(overflow.attributes("title")).toBe("Barbara\nGuest");
  });

  it("labels the group for assistive technology", () => {
    expect(
      mountBar([])
        .get('[data-testid="collaborator-bar"]')
        .attributes("aria-label"),
    ).toBe("People editing this template");
  });
});
