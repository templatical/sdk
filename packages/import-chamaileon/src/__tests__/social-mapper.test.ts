import { describe, expect, it } from "vitest";
import { convertSocial } from "../social-mapper";
import type { MapContext } from "../block-mapper";
import type { SocialIconsBlock } from "@templatical/types";

const ctx = (): MapContext => ({
  bodyWidth: 600,
  columnWidth: 600,
  variables: [],
  warnings: [],
});

describe("convertSocial", () => {
  it("emits icons in elements order", () => {
    const { block, entry } = convertSocial(
      {
        type: "social",
        attrs: {
          elements: [
            { type: "Facebook", link: "https://facebook.com/a" },
            { type: "Twitter", link: "https://x.com/a" },
          ],
          size: 40,
          align: "center",
        },
      },
      ctx(),
    );
    const b = block as SocialIconsBlock;
    expect(b.icons.map((i) => i.platform)).toEqual(["facebook", "twitter"]);
    expect(b.icons[0].url).toBe("https://facebook.com/a");
    expect(entry.status).toBe("approximated"); // 40 is not 24/32/48
  });

  it("maps an unknown platform to website", () => {
    const { block, entry } = convertSocial(
      {
        type: "social",
        attrs: {
          elements: [{ type: "Mastodon", link: "https://m.test" }],
          size: 32,
        },
      },
      ctx(),
    );
    expect((block as SocialIconsBlock).icons[0].platform).toBe("website");
    expect(entry.note).toMatch(/Mastodon/);
  });

  it("skips an empty elements list", () => {
    const { block, entry } = convertSocial(
      { type: "social", attrs: { elements: [] } },
      ctx(),
    );
    expect(block).toBeNull();
    expect(entry.status).toBe("skipped");
  });
});
