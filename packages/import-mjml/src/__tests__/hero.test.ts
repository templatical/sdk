import { describe, expect, it } from "vitest";
import type { SectionBlock } from "@templatical/types";
import { convertMjmlTemplate } from "../converter";

const URL = "https://cdn.test/hero.jpg";

function convert(body: string) {
  const { content, report } = convertMjmlTemplate(
    `<mjml><mj-body width="600px">${body}</mj-body></mjml>`,
  );
  return { blocks: content.blocks, entries: report.entries };
}

function onlySection(body: string): SectionBlock {
  const { blocks } = convert(body);
  expect(blocks).toHaveLength(1);
  expect(blocks[0].type).toBe("section");
  return blocks[0] as SectionBlock;
}

describe("mj-hero import", () => {
  it("maps a fluid hero with its image size to height: image", () => {
    const { blocks, entries } = convert(
      `<mj-hero mode="fluid-height" background-url="${URL}" background-width="1200px" background-height="800px" background-color="#0f172a" padding="48px 24px" vertical-align="middle"><mj-text>Big news</mj-text></mj-hero>`,
    );
    const section = blocks[0] as SectionBlock;
    expect(section).toMatchObject({
      columns: "1",
      hero: { height: "image", verticalAlign: "middle" },
      backgroundImage: {
        url: URL,
        size: "cover",
        position: { x: "center", y: "center" },
        repeat: false,
        width: 1200,
        height: 800,
      },
      styles: {
        padding: { top: 48, right: 24, bottom: 48, left: 24 },
        backgroundColor: "#0f172a",
      },
    });
    expect(section.children).toHaveLength(1);
    expect(section.children[0][0].type).toBe("paragraph");
    expect(entries[0]).toEqual({
      sourceTag: "mj-hero",
      templaticalBlockType: "section",
      status: "converted",
    });
  });

  it("maps a fixed-height hero to a fixed height, vertical-align defaulting to top", () => {
    const section = onlySection(
      `<mj-hero mode="fixed-height" height="320px" background-url="${URL}" background-color="#000000"><mj-text>x</mj-text></mj-hero>`,
    );
    expect(section.hero).toEqual({ height: 320, verticalAlign: "top" });
  });

  it("reads MJML's default mode, fixed-height with no height, as a regular section", () => {
    const { blocks, entries } = convert(
      `<mj-hero background-url="${URL}" background-color="#000000"><mj-text>x</mj-text></mj-hero>`,
    );
    const section = blocks[0] as SectionBlock;
    expect("hero" in section).toBe(false);
    expect(section.backgroundImage).toMatchObject({
      url: URL,
      size: "cover",
      repeat: false,
    });
    expect(entries[0].status).toBe("converted");
  });

  it("notes a fluid hero without an image size", () => {
    const { blocks, entries } = convert(
      `<mj-hero mode="fluid-height" background-url="${URL}" background-color="#000000"><mj-text>x</mj-text></mj-hero>`,
    );
    expect((blocks[0] as SectionBlock).hero).toEqual({
      height: "image",
      verticalAlign: "top",
    });
    expect(entries[0]).toMatchObject({
      status: "approximated",
      note: "Hero fluid-height has no background-width / background-height, so its image size is unknown; it renders as a regular section until it has a size or a fixed height.",
    });
  });

  it("notes a hero with a height but no background-url", () => {
    const { entries } = convert(
      `<mj-hero mode="fixed-height" height="300px" background-color="#000000"><mj-text>x</mj-text></mj-hero>`,
    );
    expect(entries[0].note).toBe(
      "Hero has no background-url, so it renders as a regular section until it has a background image.",
    );
  });

  it("paints MJML's white where the hero sets no colour, and nothing for transparent", () => {
    expect(
      onlySection(`<mj-hero><mj-text>x</mj-text></mj-hero>`).styles
        .backgroundColor,
    ).toBe("#ffffff");
    expect(
      onlySection(
        `<mj-hero background-color="transparent"><mj-text>x</mj-text></mj-hero>`,
      ).styles.backgroundColor,
    ).toBeUndefined();
  });

  it("reads background-position, ignoring size and repeat it doesn't have", () => {
    const section = onlySection(
      `<mj-hero mode="fixed-height" height="300px" background-url="${URL}" background-position="left top" background-size="contain" background-repeat="repeat"><mj-text>x</mj-text></mj-hero>`,
    );
    expect(section.backgroundImage).toMatchObject({
      size: "cover",
      position: { x: "left", y: "top" },
      repeat: false,
    });
  });

  it("drops inner-padding and inner-background-color with a note", () => {
    const { entries } = convert(
      `<mj-hero mode="fixed-height" height="300px" background-url="${URL}" inner-padding="10px" inner-background-color="#ffffff"><mj-text>x</mj-text></mj-hero>`,
    );
    expect(entries[0].note).toBe(
      'Hero inner-padding "10px" has no Templatical equivalent; dropped. Hero inner-background-color "#ffffff" has no Templatical equivalent; dropped.',
    );
  });

  it("notes an unknown mode and vertical-align", () => {
    const { blocks, entries } = convert(
      `<mj-hero mode="sideways" height="300px" vertical-align="baseline" background-url="${URL}"><mj-text>x</mj-text></mj-hero>`,
    );
    expect((blocks[0] as SectionBlock).hero).toEqual({
      height: 300,
      verticalAlign: "top",
    });
    expect(entries[0].note).toBe(
      'Hero vertical-align "baseline" has no Templatical equivalent; imported as "top". Hero mode "sideways" has no Templatical equivalent; imported as "fixed-height".',
    );
  });

  it("frames a hero inside an mj-wrapper with the wrapper's band", () => {
    const section = onlySection(
      `<mj-wrapper padding="0 20px" background-color="#eeeeee"><mj-hero mode="fluid-height" background-url="${URL}" background-width="600px" background-height="400px"><mj-text>x</mj-text></mj-hero></mj-wrapper>`,
    );
    expect(section.hero).toEqual({ height: "image", verticalAlign: "top" });
    expect(section.wrapper).toMatchObject({
      backgroundColor: "#eeeeee",
      padding: { top: 0, right: 20, bottom: 0, left: 20 },
    });
  });

  it("measures a wrapper-framed hero's content against the box the wrapper's padding leaves", () => {
    const { blocks, entries } = convert(
      `<mj-wrapper padding="0 20px"><mj-hero mode="fluid-height" background-url="${URL}" background-width="560px" background-height="373px"><mj-image src="https://cdn.test/a.png" width="560px" /></mj-hero></mj-wrapper>`,
    );
    const section = blocks[0] as SectionBlock;
    expect(section.children[0][0]).toMatchObject({
      type: "image",
      width: "full",
    });
    expect(entries.map((e) => e.status)).toEqual(["converted", "converted"]);
  });

  it("measures a section in the same wrapper against the full content width", () => {
    const section = onlySection(
      `<mj-wrapper padding="0 20px"><mj-section><mj-column><mj-image src="https://cdn.test/a.png" width="600px" /></mj-column></mj-section></mj-wrapper>`,
    );
    expect(section.children[0][0]).toMatchObject({
      type: "image",
      width: "full",
    });
  });

  it("keeps a hero inside a column as html, since MJML forbids it there", () => {
    const { entries } = convert(
      `<mj-section><mj-column><mj-hero><mj-text>x</mj-text></mj-hero></mj-column></mj-section>`,
    );
    expect(entries).toContainEqual({
      sourceTag: "mj-hero",
      templaticalBlockType: "html",
      status: "html-fallback",
      note: "MJML forbids <mj-hero> inside <mj-column>; the nested hero's markup is preserved as an html block.",
    });
  });

  it("reads the visibility class", () => {
    const section = onlySection(
      `<mj-hero css-class="tpl-hide-mobile"><mj-text>x</mj-text></mj-hero>`,
    );
    expect(section.visibility).toEqual({ desktop: true, mobile: false });
  });
});
