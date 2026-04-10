import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readComponent(relativePath: string): string {
  return readFileSync(resolve(__dirname, "..", "src", relativePath), "utf-8");
}

describe("VideoPlayButton.vue structure", () => {
  const src = readComponent("components/blocks/VideoPlayButton.vue");

  it("renders play button SVG", () => {
    expect(src).toContain("<svg");
    expect(src).toContain('<polygon points="5,3 19,12 5,21"');
  });

  it("accepts optional hoverEffect prop", () => {
    expect(src).toContain("hoverEffect?: boolean");
  });

  it("applies hover transition class when hoverEffect is true", () => {
    expect(src).toContain("hoverEffect && 'tpl:transition-opacity");
  });
});

describe("VideoBlock.vue uses VideoPlayButton", () => {
  const src = readComponent("components/blocks/VideoBlock.vue");

  it("imports VideoPlayButton", () => {
    expect(src).toContain(
      'import VideoPlayButton from "./VideoPlayButton.vue"',
    );
  });

  it("uses <VideoPlayButton /> instead of inline SVG overlays", () => {
    expect(src).toContain("<VideoPlayButton");
    expect(src).not.toContain(
      'class="tpl:flex tpl:size-16 tpl:items-center tpl:justify-center tpl:rounded-full tpl:bg-white/90',
    );
  });

  it("passes hover-effect prop for link variant", () => {
    expect(src).toContain("<VideoPlayButton hover-effect");
  });
});
