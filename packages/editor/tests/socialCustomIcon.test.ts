// @vitest-environment happy-dom
import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createSocialIconsBlock } from "@templatical/types";
import type { SocialIconSize, SocialIconsBlock } from "@templatical/types";
import SocialIconsBlockView from "../src/components/blocks/SocialIconsBlock.vue";
import SocialCustomIconImage from "../src/components/blocks/SocialCustomIconImage.vue";
import SocialCustomIconFields from "../src/components/toolbar/SocialCustomIconFields.vue";
import SocialIconSvg from "../src/components/blocks/SocialIconSvg.vue";
import { socialIconSizeMap } from "../src/constants/socialIcons";
import { createImageUrlResolver } from "../src/composables/useImageUrlResolver";
import { IMAGE_URL_RESOLVER_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

function socialBlock(
  icons: SocialIconsBlock["icons"],
  iconSize: SocialIconSize = "medium",
): SocialIconsBlock {
  return createSocialIconsBlock({
    icons,
    iconSize,
    iconStyle: "circle",
    iconTone: "dark",
  });
}

describe("custom social icons on the canvas", () => {
  it("draws a custom image at each icon size between built-in icons", () => {
    for (const iconSize of ["small", "medium", "large"] as const) {
      const wrapper = mountEditor(SocialIconsBlockView, {
        props: {
          viewport: "desktop",
          block: socialBlock(
            [
              { id: "a", platform: "facebook", url: "https://fb.example" },
              {
                id: "b",
                platform: "custom",
                url: "https://shop.example",
                imageUrl: "https://cdn.example/mark.png",
                alt: "Shop",
              },
              { id: "c", platform: "github", url: "https://github.com/acme" },
            ],
            iconSize,
          ),
        },
      });

      const links = wrapper.findAll("a");
      expect(links).toHaveLength(3);
      expect(links[0].attributes("href")).toBe("https://fb.example");
      expect(links[0].findComponent(SocialIconSvg).exists()).toBe(true);
      expect(links[0].find("img").exists()).toBe(false);

      const img = links[1].get("img");
      expect(links[1].attributes("href")).toBe("https://shop.example");
      expect(links[1].findComponent(SocialIconSvg).exists()).toBe(false);
      expect(img.attributes("src")).toBe("https://cdn.example/mark.png");
      expect(img.attributes("alt")).toBe("Shop");
      expect(img.attributes("width")).toBe(String(socialIconSizeMap[iconSize]));
      expect(img.attributes("height")).toBeUndefined();
      expect((img.element as HTMLElement).style.display).toBe("block");
      expect((img.element as HTMLElement).style.height).toBe("auto");
      expect((img.element as HTMLElement).style.borderRadius).toBe("");
      expect((img.element as HTMLElement).style.backgroundColor).toBe("");

      expect(links[2].attributes("href")).toBe("https://github.com/acme");
      expect(links[2].findComponent(SocialIconSvg).exists()).toBe(true);
      expect(links[2].find("img").exists()).toBe(false);
    }
  });

  it("uses an empty alt when the custom icon has none", () => {
    const wrapper = mountEditor(SocialIconsBlockView, {
      props: {
        viewport: "desktop",
        block: socialBlock([
          {
            id: "b",
            platform: "custom",
            url: "https://shop.example",
            imageUrl: "https://cdn.example/mark.png",
          },
        ]),
      },
    });

    expect(wrapper.get("img").attributes("alt")).toBe("");
  });

  it("shows a placeholder of the icon size when imageUrl is empty", () => {
    const wrapper = mountEditor(SocialIconsBlockView, {
      props: {
        viewport: "desktop",
        block: socialBlock(
          [
            {
              id: "b",
              platform: "custom",
              url: "https://shop.example",
              imageUrl: "",
            },
          ],
          "large",
        ),
      },
    });

    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.findComponent(SocialIconSvg).exists()).toBe(false);
    const placeholder = wrapper.get('[role="img"]');
    expect(placeholder.attributes("aria-label")).toBe(
      "social.customIconMissing",
    );
    expect((placeholder.element as HTMLElement).style.width).toBe("48px");
    expect((placeholder.element as HTMLElement).style.height).toBe("48px");
    expect(placeholder.classes()).toContain("tpl:border-dashed");
    expect(placeholder.classes()).toContain("tpl:border-[var(--tpl-border)]");
    expect(placeholder.classes()).toContain("tpl:text-[var(--tpl-text-dim)]");
    expect(placeholder.find("svg").exists()).toBe(true);
    expect(placeholder.attributes("style") ?? "").not.toContain("border-radius");
    expect(
      placeholder.classes().some((name) => name.includes("bg-")),
    ).toBe(false);
  });

  it("renders the resolved preview URL and leaves imageUrl canonical", async () => {
    const resolve = vi.fn(async (src: string) => `blob:preview/${src}`);
    const block = socialBlock([
      {
        id: "b",
        platform: "custom",
        url: "https://shop.example",
        imageUrl: "logo.png",
        alt: "Logo",
      },
    ]);
    const wrapper = mountEditor(SocialIconsBlockView, {
      props: { block, viewport: "desktop" },
      provides: {
        [IMAGE_URL_RESOLVER_KEY]: createImageUrlResolver(resolve),
      },
    });

    await flushPromises();

    expect(wrapper.get("img").attributes("src")).toBe("blob:preview/logo.png");
    expect(wrapper.get("img").attributes("alt")).toBe("Logo");
    expect(resolve).toHaveBeenCalledWith("logo.png");
    expect(block.icons[0]).toMatchObject({ imageUrl: "logo.png" });
    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("shows the placeholder when a stored custom icon has no imageUrl", () => {
    const wrapper = mountEditor(SocialCustomIconImage, {
      props: {
        iconSize: "medium",
        icon: { id: "b", platform: "custom", url: "https://shop.example" },
      },
    });

    expect(wrapper.find("img").exists()).toBe(false);
    const placeholder = wrapper.get('[role="img"]');
    expect(placeholder.attributes("aria-label")).toBe(
      "social.customIconMissing",
    );
    expect((placeholder.element as HTMLElement).style.width).toBe("32px");
    expect((placeholder.element as HTMLElement).style.height).toBe("32px");
  });

  it("shows an empty image field when a stored custom icon has no imageUrl", () => {
    const wrapper = mountEditor(SocialCustomIconFields, {
      props: {
        icon: { id: "b", platform: "custom", url: "https://shop.example" },
      },
    });

    expect(
      (wrapper.get('input[type="url"]').element as HTMLInputElement).value,
    ).toBe("");
  });

  it("shows an empty image field when imageUrl is not a string", () => {
    const wrapper = mountEditor(SocialCustomIconFields, {
      props: {
        icon: {
          id: "b",
          platform: "custom",
          url: "https://shop.example",
          imageUrl: 1,
        },
      },
    });

    expect(
      (wrapper.get('input[type="url"]').element as HTMLInputElement).value,
    ).toBe("");
  });

  it("shows the placeholder for a merge-tag imageUrl and does not resolve it", async () => {
    const resolve = vi.fn(async (src: string) => `blob:preview/${src}`);
    const wrapper = mountEditor(SocialIconsBlockView, {
      props: {
        viewport: "desktop",
        block: socialBlock([
          {
            id: "b",
            platform: "custom",
            url: "https://shop.example",
            imageUrl: "{{ icon }}",
            alt: "Icon",
          },
        ]),
      },
      provides: {
        [IMAGE_URL_RESOLVER_KEY]: createImageUrlResolver(resolve),
      },
    });

    await flushPromises();

    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toBe(
      "social.customIconMissing",
    );
    expect(resolve).not.toHaveBeenCalled();
  });
});
