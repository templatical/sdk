// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import type { Collaborator } from "@templatical/types";
import CollaboratorBar from "../src/cloud/components/CollaboratorBar.vue";
import { CLOUD_TRANSLATIONS_KEY } from "../src/keys";
import cloudEn from "../src/i18n/locales/cloud/en";

function person(id: string, name: string, color = "#2563eb"): Collaborator {
  return { id, name, color, selectedBlockId: null };
}

function mountBar(collaborators: Collaborator[], isConnected = true) {
  return mount(CollaboratorBar, {
    props: { collaborators, isConnected },
    global: {
      provide: { [CLOUD_TRANSLATIONS_KEY as symbol]: cloudEn },
    },
  });
}

describe("CollaboratorBar", () => {
  it("names the connection state and hides avatars when nobody else is present", () => {
    const on = mountBar([], true);
    expect(on.get("[title]").attributes("title")).toBe(
      cloudEn.collaboration.connected,
    );

    const off = mountBar([], false);
    expect(off.get("[title]").attributes("title")).toBe(
      cloudEn.collaboration.disconnected,
    );
    expect(off.find(".tpl-collaborator-avatar").exists()).toBe(false);
  });

  it("initials a single token and a two-word name", () => {
    const wrapper = mountBar([person("a", "Ada"), person("b", "Grace Hopper")]);
    const avatars = wrapper.findAll(".tpl-collaborator-avatar");
    expect(avatars[0].text()).toBe("A");
    expect(avatars[1].text()).toBe("GH");
    expect(avatars[0].attributes("title")).toBe("Ada");
  });

  it("caps the stack at three and lists the rest in the overflow title", () => {
    const wrapper = mountBar([
      person("1", "Ada"),
      person("2", "Grace"),
      person("3", "Alan"),
      person("4", "Barbara"),
      person("5", "Donald"),
    ]);
    expect(wrapper.findAll(".tpl-collaborator-avatar")).toHaveLength(3);
    expect(wrapper.text()).toContain("+2");
    expect(wrapper.find("[title]").html()).toBeDefined();
    const overflow = wrapper
      .findAll("[title]")
      .find((n) => n.text().includes("+2"))!;
    expect(overflow.attributes("title")).toBe("Barbara\nDonald");
  });
});
