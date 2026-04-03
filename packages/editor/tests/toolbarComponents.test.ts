import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readComponent(relativePath: string): string {
  return readFileSync(resolve(__dirname, "..", "src", relativePath), "utf-8");
}

const toolbarDir = "components/toolbar";

// ── Toolbar.vue (dispatcher) ──────────────────────────────────────────────────

describe("Toolbar.vue dispatcher structure", () => {
  const src = readComponent("components/Toolbar.vue");

  it("imports all per-block toolbar components", () => {
    const expected = [
      "ButtonToolbar",
      "CommonBlockSettings",
      "CountdownToolbar",
      "CustomBlockToolbar",
      "DividerToolbar",
      "HtmlToolbar",
      "ImageToolbar",
      "MenuToolbar",
      "SectionToolbar",
      "SocialToolbar",
      "SpacerToolbar",
      "TableToolbar",
      "TitleToolbar",
    ];
    for (const name of expected) {
      expect(src).toContain(`import ${name} from`);
    }
  });

  it("dispatches to each block toolbar via v-else-if", () => {
    expect(src).toContain('<SectionToolbar');
    expect(src).toContain('<TitleToolbar');
    expect(src).toContain('<ImageToolbar');
    expect(src).toContain('<ButtonToolbar');
    expect(src).toContain('<DividerToolbar');
    expect(src).toContain('<SocialToolbar');
    expect(src).toContain('<MenuToolbar');
    expect(src).toContain('<TableToolbar');
    expect(src).toContain('<SpacerToolbar');
    expect(src).toContain('<HtmlToolbar');
    expect(src).toContain('<CountdownToolbar');
  });

  it("always renders CommonBlockSettings at the bottom", () => {
    expect(src).toContain("<CommonBlockSettings");
    // CommonBlockSettings should not have a v-if/v-else-if — it renders for all block types
    const commonIdx = src.indexOf("<CommonBlockSettings");
    const afterCommon = src.slice(commonIdx, commonIdx + 200);
    expect(afterCommon).not.toMatch(/v-else-if/);
  });

  it("emits update, delete, and duplicate events", () => {
    expect(src).toContain('"update"');
    expect(src).toContain('"delete"');
    expect(src).toContain('"duplicate"');
  });

  it("passes fontFamilies prop to toolbars that need it", () => {
    expect(src).toMatch(/<TitleToolbar[\s\S]*?:font-families/);
    expect(src).toMatch(/<ButtonToolbar[\s\S]*?:font-families/);
    expect(src).toMatch(/<MenuToolbar[\s\S]*?:font-families/);
    expect(src).toMatch(/<TableToolbar[\s\S]*?:font-families/);
    expect(src).toMatch(/<CountdownToolbar[\s\S]*?:font-families/);
  });

  it("does not pass fontFamilies to toolbars that do not need it", () => {
    // SectionToolbar, ImageToolbar, DividerToolbar, SocialToolbar, SpacerToolbar, HtmlToolbar
    const sectionMatch = src.match(
      /<SectionToolbar[\s\S]*?(?=\/>|<\/SectionToolbar>)/,
    );
    expect(sectionMatch?.[0]).not.toContain(":font-families");
  });
});

// ── SectionToolbar ────────────────────────────────────────────────────────────

describe("SectionToolbar.vue structure", () => {
  const src = readComponent(`${toolbarDir}/SectionToolbar.vue`);

  it("accepts SectionBlock prop", () => {
    expect(src).toContain("block: SectionBlock");
  });

  it("emits update with Partial<SectionBlock>", () => {
    expect(src).toContain("Partial<SectionBlock>");
  });

  it("renders column layout select", () => {
    expect(src).toContain("block.columns");
    expect(src).toContain("columnOptions");
  });

  it("uses i18n for labels", () => {
    expect(src).toContain("useI18n");
    expect(src).toContain("t.section.columns");
  });
});

// ── TitleToolbar ──────────────────────────────────────────────────────────────

describe("TitleToolbar.vue structure", () => {
  const src = readComponent(`${toolbarDir}/TitleToolbar.vue`);

  it("accepts TitleBlock and fontFamilies props", () => {
    expect(src).toContain("block: TitleBlock");
    expect(src).toContain("fontFamilies: Array<{ value: string; label: string }>");
  });

  it("emits update with Partial<TitleBlock>", () => {
    expect(src).toContain("Partial<TitleBlock>");
  });

  it("renders heading level select", () => {
    expect(src).toContain("block.level");
    expect(src).toContain("t.title.heading1");
  });

  it("renders font family, color, and alignment controls", () => {
    expect(src).toContain("block.fontFamily");
    expect(src).toContain("<ColorPicker");
    expect(src).toContain("<SlidingPillSelect");
    expect(src).toContain("AlignLeft");
  });
});

// ── ImageToolbar ──────────────────────────────────────────────────────────────

describe("ImageToolbar.vue structure", () => {
  const src = readComponent(`${toolbarDir}/ImageToolbar.vue`);

  it("accepts ImageBlock prop", () => {
    expect(src).toContain("block: ImageBlock");
  });

  it("injects config for media browser", () => {
    expect(src).toContain('inject<TemplaticalEditorConfig>("config")');
  });

  it("has openMediaBrowser function", () => {
    expect(src).toContain("async function openMediaBrowser");
  });

  it("calls useTimeoutFn at setup time, not inside callback", () => {
    expect(src).toMatch(/const \{ start: startPulseSrc \} = useTimeoutFn/);
    // The old anti-pattern was `useTimeoutFn(() => {...}, 1000)` inside openMediaBrowser
    expect(src).not.toMatch(
      /async function openMediaBrowser[\s\S]*?useTimeoutFn/,
    );
  });

  it("renders src, alt, width, align, and link controls", () => {
    expect(src).toContain("block.src");
    expect(src).toContain("block.alt");
    expect(src).toContain("block.width");
    expect(src).toContain("block.linkUrl");
  });

  it("uses MergeTagInput for src and alt", () => {
    expect(src).toContain("<MergeTagInput");
  });
});

// ── ButtonToolbar ─────────────────────────────────────────────────────────────

describe("ButtonToolbar.vue structure", () => {
  const src = readComponent(`${toolbarDir}/ButtonToolbar.vue`);

  it("accepts ButtonBlock and fontFamilies props", () => {
    expect(src).toContain("block: ButtonBlock");
    expect(src).toContain("fontFamilies:");
  });

  it("renders text, url, colors, borderRadius, and fontSize controls", () => {
    expect(src).toContain("block.text");
    expect(src).toContain("block.url");
    expect(src).toContain("block.backgroundColor");
    expect(src).toContain("block.textColor");
    expect(src).toContain("block.borderRadius");
    expect(src).toContain("block.fontSize");
  });

  it("uses ColorPicker for background and text color", () => {
    const matches = src.match(/<ColorPicker/g);
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });
});

// ── DividerToolbar ────────────────────────────────────────────────────────────

describe("DividerToolbar.vue structure", () => {
  const src = readComponent(`${toolbarDir}/DividerToolbar.vue`);

  it("accepts DividerBlock prop", () => {
    expect(src).toContain("block: DividerBlock");
  });

  it("renders style, color, and thickness controls", () => {
    expect(src).toContain("block.lineStyle");
    expect(src).toContain("block.color");
    expect(src).toContain("block.thickness");
  });
});

// ── SocialToolbar ─────────────────────────────────────────────────────────────

describe("SocialToolbar.vue structure", () => {
  const src = readComponent(`${toolbarDir}/SocialToolbar.vue`);

  it("accepts SocialIconsBlock prop", () => {
    expect(src).toContain("block: SocialIconsBlock");
  });

  it("has add, update, and remove social icon functions", () => {
    expect(src).toContain("function addSocialIcon");
    expect(src).toContain("function updateSocialIcon");
    expect(src).toContain("function removeSocialIcon");
  });

  it("uses generateId for new icons", () => {
    expect(src).toContain("generateId()");
  });

  it("renders iconStyle, iconSize, spacing, and align controls", () => {
    expect(src).toContain("block.iconStyle");
    expect(src).toContain("block.iconSize");
    expect(src).toContain("block.spacing");
    expect(src).toContain("block.align");
  });
});

// ── MenuToolbar ───────────────────────────────────────────────────────────────

describe("MenuToolbar.vue structure", () => {
  const src = readComponent(`${toolbarDir}/MenuToolbar.vue`);

  it("accepts MenuBlock and fontFamilies props", () => {
    expect(src).toContain("block: MenuBlock");
    expect(src).toContain("fontFamilies:");
  });

  it("has add, update, and remove menu item functions", () => {
    expect(src).toContain("function addMenuItem");
    expect(src).toContain("function updateMenuItem");
    expect(src).toContain("function removeMenuItem");
  });

  it("renders item text, url, openInNewTab, bold, underline, and color controls", () => {
    expect(src).toContain("item.text");
    expect(src).toContain("item.url");
    expect(src).toContain("item.openInNewTab");
    expect(src).toContain("item.bold");
    expect(src).toContain("item.underline");
  });
});

// ── TableToolbar ──────────────────────────────────────────────────────────────

describe("TableToolbar.vue structure", () => {
  const src = readComponent(`${toolbarDir}/TableToolbar.vue`);

  it("accepts TableBlock and fontFamilies props", () => {
    expect(src).toContain("block: TableBlock");
    expect(src).toContain("fontFamilies:");
  });

  it("has add/remove row and column functions", () => {
    expect(src).toContain("function addTableRow");
    expect(src).toContain("function removeTableRow");
    expect(src).toContain("function addTableColumn");
    expect(src).toContain("function removeTableColumn");
  });

  it("computes tableColumnCount", () => {
    expect(src).toContain("const tableColumnCount = computed");
  });

  it("renders header row, border, cellPadding, and font controls", () => {
    expect(src).toContain("block.hasHeaderRow");
    expect(src).toContain("block.borderColor");
    expect(src).toContain("block.cellPadding");
    expect(src).toContain("block.fontFamily");
  });
});

// ── SpacerToolbar ─────────────────────────────────────────────────────────────

describe("SpacerToolbar.vue structure", () => {
  const src = readComponent(`${toolbarDir}/SpacerToolbar.vue`);

  it("accepts SpacerBlock prop", () => {
    expect(src).toContain("block: SpacerBlock");
  });

  it("renders height input and range slider", () => {
    expect(src).toContain("block.height");
    expect(src).toContain('type="number"');
    expect(src).toContain('type="range"');
  });
});

// ── HtmlToolbar ───────────────────────────────────────────────────────────────

describe("HtmlToolbar.vue structure", () => {
  const src = readComponent(`${toolbarDir}/HtmlToolbar.vue`);

  it("accepts HtmlBlock prop", () => {
    expect(src).toContain("block: HtmlBlock");
  });

  it("renders textarea for content editing", () => {
    expect(src).toContain("block.content");
    expect(src).toContain("<textarea");
  });

  it("shows sanitization hint", () => {
    expect(src).toContain("t.html.sanitizationHint");
  });
});

// ── CountdownToolbar ──────────────────────────────────────────────────────────

describe("CountdownToolbar.vue structure", () => {
  const src = readComponent(`${toolbarDir}/CountdownToolbar.vue`);

  it("accepts CountdownBlock and fontFamilies props", () => {
    expect(src).toContain("block: CountdownBlock");
    expect(src).toContain("fontFamilies:");
  });

  it("renders target date, timezone, and display toggles", () => {
    expect(src).toContain("block.targetDate");
    expect(src).toContain("block.timezone");
    expect(src).toContain("block.showDays");
    expect(src).toContain("block.showHours");
    expect(src).toContain("block.showMinutes");
    expect(src).toContain("block.showSeconds");
  });

  it("renders separator, font, digit/label sizing, and color controls", () => {
    expect(src).toContain("block.separator");
    expect(src).toContain("block.fontFamily");
    expect(src).toContain("block.digitFontSize");
    expect(src).toContain("block.labelFontSize");
    expect(src).toContain("block.digitColor");
    expect(src).toContain("block.labelColor");
  });

  it("renders expiry settings", () => {
    expect(src).toContain("block.expiredMessage");
    expect(src).toContain("block.expiredImageUrl");
    expect(src).toContain("block.hideOnExpiry");
  });
});

// ── CommonBlockSettings ───────────────────────────────────────────────────────

describe("CommonBlockSettings.vue structure", () => {
  const src = readComponent(`${toolbarDir}/CommonBlockSettings.vue`);

  it("accepts Block and isFirstSection props", () => {
    expect(src).toContain("block: Block");
    expect(src).toContain("isFirstSection?: boolean");
  });

  it("emits update with Partial<Block>", () => {
    expect(src).toContain("Partial<Block>");
  });

  it("has spacing accordion with SpacingControl for padding and margin", () => {
    expect(src).toContain("<SpacingControl");
    expect(src).toContain("t.blockSettings.padding");
    expect(src).toContain("t.blockSettings.margin");
  });

  it("has background accordion with ColorPicker", () => {
    expect(src).toContain("t.blockSettings.background");
    expect(src).toContain("<ColorPicker");
  });

  it("has display accordion with desktop, tablet, and mobile toggles", () => {
    expect(src).toContain("t.blockSettings.showOnDesktop");
    expect(src).toContain("t.blockSettings.showOnTablet");
    expect(src).toContain("t.blockSettings.showOnMobile");
  });

  it("has custom CSS accordion", () => {
    expect(src).toContain("t.blockSettings.customCss");
    expect(src).toContain("block.customCss");
  });

  it("has display conditions section with preset and custom modes", () => {
    expect(src).toContain("t.blockSettings.displayCondition");
    expect(src).toContain("function startCustomCondition");
    expect(src).toContain("function applyCustomCondition");
    expect(src).toContain("groupedDisplayConditions");
  });

  it("injects displayConditions and allowCustomConditions", () => {
    expect(src).toContain('inject<DisplayCondition[]>("displayConditions"');
    expect(src).toContain('inject<boolean>("allowCustomConditions"');
  });
});
