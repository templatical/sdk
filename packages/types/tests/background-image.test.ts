import { describe, expect, it } from "vitest";
import {
  BACKGROUND_POSITIONS_X,
  BACKGROUND_POSITIONS_Y,
  BACKGROUND_SIZES,
  createBackgroundImage,
  createSectionBlock,
  createWrapperBlock,
  encodeCssUrl,
  resolveBackgroundImage,
} from "../src";
import type { BackgroundImage } from "../src";

describe("createBackgroundImage", () => {
  it("fills one centered, unrepeated banner image", () => {
    expect(createBackgroundImage("https://cdn.test/hero.jpg")).toEqual({
      url: "https://cdn.test/hero.jpg",
      size: "cover",
      position: { x: "center", y: "center" },
      repeat: false,
    });
  });

  it("returns a fresh position object each call", () => {
    const a = createBackgroundImage("a");
    const b = createBackgroundImage("b");
    expect(a.position).not.toBe(b.position);
  });
});

describe("value lists", () => {
  it("lists the supported keywords in UI order", () => {
    expect(BACKGROUND_SIZES).toEqual(["cover", "contain", "auto"]);
    expect(BACKGROUND_POSITIONS_X).toEqual(["left", "center", "right"]);
    expect(BACKGROUND_POSITIONS_Y).toEqual(["top", "center", "bottom"]);
  });
});

describe("encodeCssUrl", () => {
  it("percent-encodes the characters that can end a quoted CSS string", () => {
    expect(encodeCssUrl(`a'b"c\\d`)).toBe("a%27b%22c%5Cd");
  });

  it("percent-encodes control characters, including line breaks", () => {
    expect(encodeCssUrl("a\nb\rc\td\u007fe")).toBe("a%0Ab%0Dc%09d%7Fe");
  });

  it("leaves spaces, parentheses and merge tags untouched", () => {
    expect(encodeCssUrl("https://x.test/a b(1).jpg")).toBe(
      "https://x.test/a b(1).jpg",
    );
    expect(encodeCssUrl("{{ hero_url }}")).toBe("{{ hero_url }}");
    expect(encodeCssUrl("*|HERO|*")).toBe("*|HERO|*");
    expect(encodeCssUrl("%%=v(@hero)=%%")).toBe("%%=v(@hero)=%%");
  });
});

describe("resolveBackgroundImage", () => {
  const image: BackgroundImage = {
    url: "https://cdn.test/hero.jpg",
    size: "contain",
    position: { x: "left", y: "bottom" },
    repeat: true,
  };

  it("resolves to CSS-ready values, x before y", () => {
    expect(resolveBackgroundImage(image)).toEqual({
      url: "https://cdn.test/hero.jpg",
      size: "contain",
      position: "left bottom",
      repeat: "repeat",
    });
  });

  it("maps repeat false to no-repeat", () => {
    expect(resolveBackgroundImage({ ...image, repeat: false })?.repeat).toBe(
      "no-repeat",
    );
  });

  it("trims and encodes the url", () => {
    expect(
      resolveBackgroundImage({ ...image, url: "  https://x.test/a'b.jpg  " })
        ?.url,
    ).toBe("https://x.test/a%27b.jpg");
  });

  it.each([undefined, "", "   "])("returns null for url %j", (url) => {
    expect(
      resolveBackgroundImage(
        url === undefined ? undefined : { ...image, url },
      ),
    ).toBeNull();
  });

  it("falls back to cover and center for values outside the allowlists", () => {
    const tampered = {
      ...image,
      size: "50%;color:red",
      position: { x: "0;color:red", y: "nowhere" },
    } as unknown as BackgroundImage;
    expect(resolveBackgroundImage(tampered)).toEqual({
      url: "https://cdn.test/hero.jpg",
      size: "cover",
      position: "center center",
      repeat: "repeat",
    });
  });

  it("falls back to center center when position is missing", () => {
    const partial = { ...image, position: undefined } as unknown as
      BackgroundImage;
    expect(resolveBackgroundImage(partial)?.position).toBe("center center");
  });
});

describe("block fields", () => {
  it("lets sections, section wrappers and layout wrappers carry an image", () => {
    const image = createBackgroundImage("https://cdn.test/hero.jpg");
    const section = createSectionBlock({
      backgroundImage: image,
      wrapper: { backgroundImage: image },
    });
    const band = createWrapperBlock({ backgroundImage: image });
    expect(section.backgroundImage?.url).toBe("https://cdn.test/hero.jpg");
    expect(section.wrapper?.backgroundImage?.size).toBe("cover");
    expect(band.backgroundImage?.repeat).toBe(false);
  });
});
