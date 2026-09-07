import { describe, expect, it } from "vitest";
import type { SocialIconsBlock } from "@templatical/types";
import { convertSocial } from "../social-mapper";
import { readGlobalStyle } from "../global-style";
import type { MapContext } from "../block-mapper";
import type { TopolNode } from "../types";

function ctx(): MapContext {
  return {
    style: readGlobalStyle(
      { tagName: "mj-global-style", attributes: {} } as never,
      undefined,
      [],
    ),
    columnWidth: 600,
  };
}

const social = (attributes: Record<string, unknown>): TopolNode =>
  ({ tagName: "mj-social", attributes }) as TopolNode;

describe("convertSocial", () => {
  it("emits one icon per display entry, in display order", () => {
    const r = convertSocial(
      social({
        display: "twitter:url facebook:url",
        "facebook-href": "https://fb.test/a",
        "twitter-href": "https://tw.test/a",
      }),
      ctx(),
    )!;
    const block = r.block as SocialIconsBlock;
    expect(block.type).toBe("social");
    expect(block.icons.map((i) => [i.platform, i.url])).toEqual([
      ["twitter", "https://tw.test/a"],
      ["facebook", "https://fb.test/a"],
    ]);
    expect(r.entry.status).toBe("converted");
  });

  it("ignores a platform configured but absent from display", () => {
    const r = convertSocial(
      social({
        display: "facebook:url",
        "facebook-href": "https://fb.test/a",
        "youtube-icon": "https://cdn.test/youtube.png",
        "youtube-href": "https://yt.test/a",
      }),
      ctx(),
    )!;
    expect((r.block as SocialIconsBlock).icons.map((i) => i.platform)).toEqual([
      "facebook",
    ]);
  });

  it("maps google to website and reports it", () => {
    const r = convertSocial(
      social({
        display: "google:url",
        "google-href": "https://plus.google.com/PROFILE",
      }),
      ctx(),
    )!;
    const block = r.block as SocialIconsBlock;
    expect(block.icons[0].platform).toBe("website");
    expect(block.icons[0].url).toBe("https://plus.google.com/PROFILE");
    expect(r.entry.status).toBe("approximated");
    expect(r.entry.note).toContain('"google"');
  });

  it("joins the platform and icon-size notes when both are approximated", () => {
    // Every one of the five reference exports produces at least one social
    // entry with both notes at once — google's own widget still writes
    // google-href, and Topol's default icon-size is 35px — so the joined
    // string here is what a real import actually reports, not an edge case.
    const r = convertSocial(
      social({
        display: "google:url",
        "google-href": "https://plus.google.com/PROFILE",
        "icon-size": "35px",
      }),
      ctx(),
    )!;
    expect(r.entry.status).toBe("approximated");
    expect(r.entry.note).toContain('"google"');
    expect(r.entry.note).toContain("35px");
  });

  it("gives every icon a generated id", () => {
    const r = convertSocial(
      social({
        display: "facebook:url twitter:url",
        "facebook-href": "https://fb.test/a",
        "twitter-href": "https://tw.test/a",
      }),
      ctx(),
    )!;
    const ids = (r.block as SocialIconsBlock).icons.map((i) => i.id);
    expect(ids.filter(Boolean)).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("carries the node's own padding onto the block", () => {
    const r = convertSocial(
      social({
        display: "facebook:url",
        "facebook-href": "https://fb.test/a",
        padding: "9px",
      }),
      ctx(),
    )!;
    expect((r.block as SocialIconsBlock).styles.padding).toEqual({
      top: 9,
      right: 9,
      bottom: 9,
      left: 9,
    });
  });

  it("reverses an exact icon size", () => {
    const r = convertSocial(
      social({
        display: "facebook:url",
        "facebook-href": "https://fb.test/a",
        "icon-size": "32px",
      }),
      ctx(),
    )!;
    expect((r.block as SocialIconsBlock).iconSize).toBe("medium");
    expect(r.entry.status).toBe("converted");
  });

  it("reports a non-standard icon size as approximated", () => {
    const r = convertSocial(
      social({
        display: "facebook:url",
        "facebook-href": "https://fb.test/a",
        "icon-size": "35px",
      }),
      ctx(),
    )!;
    expect((r.block as SocialIconsBlock).iconSize).toBe("medium");
    expect(r.entry.status).toBe("approximated");
    expect(r.entry.note).toContain("35px");
  });

  it("resolves an icon size that differs from the factory default", () => {
    // 32px/35px above both resolve to "medium", which is also the factory
    // default — this pins a size the mapping could only reach by computing.
    const r = convertSocial(
      social({
        display: "facebook:url",
        "facebook-href": "https://fb.test/a",
        "icon-size": "24px",
      }),
      ctx(),
    )!;
    expect((r.block as SocialIconsBlock).iconSize).toBe("small");
    expect(r.entry.status).toBe("converted");
  });

  it("reads the icon style from the base-url path segment", () => {
    const r = convertSocial(
      social({
        display: "facebook:url",
        "facebook-href": "https://fb.test/a",
        "base-url": "https://cdn.test/social-icos/outlined/",
      }),
      ctx(),
    )!;
    expect((r.block as SocialIconsBlock).iconStyle).toBe("outlined");
  });

  it("maps Topol's outlinedbw icon set to the outlined style", () => {
    const r = convertSocial(
      social({
        display: "facebook:url",
        "facebook-href": "https://fb.test/a",
        "base-url": "https://cdn.test/social-icos/outlinedbw/",
      }),
      ctx(),
    )!;
    // Not "solid": outlinedbw is the outlined set in monochrome, and the
    // fallback would import it as filled. Both folder names occur in the
    // reference exports.
    expect((r.block as SocialIconsBlock).iconStyle).toBe("outlined");
  });

  it("leaves the style at the factory default for an unrecognised base-url segment", () => {
    const r = convertSocial(
      social({
        display: "facebook:url",
        "facebook-href": "https://fb.test/a",
        "base-url": "https://cdn.test/social-icos/somethingelse/",
      }),
      ctx(),
    )!;
    expect((r.block as SocialIconsBlock).iconStyle).toBe("solid");
  });

  it("reads alignment", () => {
    const r = convertSocial(
      social({
        display: "facebook:url",
        "facebook-href": "https://fb.test/a",
        align: "left",
      }),
      ctx(),
    )!;
    expect((r.block as SocialIconsBlock).align).toBe("left");
  });

  it("returns null when display is empty", () => {
    expect(
      convertSocial(social({ "facebook-href": "https://fb.test/a" }), ctx()),
    ).toBe(null);
  });

  it("returns null when no displayed platform has a url", () => {
    expect(convertSocial(social({ display: "facebook:url" }), ctx())).toBe(
      null,
    );
  });
});
