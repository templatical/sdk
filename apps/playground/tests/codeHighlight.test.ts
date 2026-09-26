import { describe, expect, it } from "vitest";
import { highlightCode } from "@lezer/highlight";
import { parser } from "@lezer/javascript";
import {
  defaultHighlightStyle,
  type HighlightStyle,
} from "@codemirror/language";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import {
  DARK_BASE_COLOR,
  highlightJs,
  type CodeTheme,
} from "../src/host/codeHighlight";
import { getScene } from "../src/scenes/index";

const snippet = getScene("minimum")!.snippet;
const tsParser = parser.configure({ dialect: "ts" });

/**
 * What the Code dialog paints: CodeMirror's real highlight style run over
 * the same parse, with colours read from the CSS the style generates. When
 * a token carries several classes the rule defined last wins, as in CSS.
 */
function referenceTokens(style: HighlightStyle, base?: string) {
  const rules = style.module!.getRules();
  const order = new Map<string, { position: number; color: string }>();
  for (const match of rules.matchAll(/\.([^\s{]+)\s*\{([^}]*)\}/g)) {
    const color = /color:\s*([^;]+)/.exec(match[2]!)?.[1]?.trim();
    if (color) order.set(match[1]!, { position: match.index!, color });
  }
  const tokens: { text: string; color?: string }[] = [];
  highlightCode(
    snippet,
    tsParser.parse(snippet),
    style,
    (text, classes) => {
      const winner = classes
        .split(" ")
        .map((name) => order.get(name))
        .filter((rule) => rule !== undefined)
        .sort((a, b) => b.position - a.position)[0];
      tokens.push({ text, color: winner?.color ?? base });
    },
    () => tokens.push({ text: "\n" }),
  );
  return tokens;
}

const REFERENCE: Record<CodeTheme, HighlightStyle> = {
  light: defaultHighlightStyle,
  dark: oneDarkHighlightStyle,
};

describe("highlightJs", () => {
  it.each(["light", "dark"] as const)(
    "%s: every token of the minimal snippet matches the Code dialog",
    (theme) => {
      const base = theme === "dark" ? DARK_BASE_COLOR : undefined;
      expect(highlightJs(snippet, theme)).toEqual(
        referenceTokens(REFERENCE[theme], base),
      );
    },
  );

  it("joins back to exactly the minimal snippet", () => {
    for (const theme of ["light", "dark"] as const) {
      expect(
        highlightJs(snippet, theme)
          .map((token) => token.text)
          .join(""),
      ).toBe(snippet);
    }
  });

  it("paints the colours the dialog shows (spot check)", () => {
    const colorOf = (theme: CodeTheme, text: string) =>
      highlightJs(snippet, theme).find((token) => token.text === text)?.color;
    expect(colorOf("light", "import")).toBe("#708");
    expect(colorOf("light", "init")).toBe("#00f");
    expect(colorOf("light", "container")).toBe("#00c");
    expect(colorOf("light", '"editor"')).toBe("#a11");
    expect(colorOf("dark", "import")).toBe("#c678dd");
    expect(colorOf("dark", "await")).toBe("#56b6c2");
    expect(colorOf("dark", '"@templatical/editor"')).toBe("#98c379");
  });
});
