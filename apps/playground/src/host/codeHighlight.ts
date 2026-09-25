import {
  highlightCode,
  tagHighlighter,
  tags as t,
  type Tag,
} from "@lezer/highlight";
import { parser } from "@lezer/javascript";

interface ColorSpec {
  tag: Tag | readonly Tag[];
  color: string;
}

/**
 * The colour rules of the two palettes the Code dialog renders with:
 * `defaultHighlightStyle` (@codemirror/language) in light and
 * `oneDarkHighlightStyle` (@codemirror/theme-one-dark) in dark, in their
 * original order (a later rule wins, as in CodeMirror). Copied rather than
 * imported because those packages pull in the whole editor view;
 * tests/codeHighlight.test.ts compares every token against the real styles,
 * so a CodeMirror upgrade that changes a colour fails the suite.
 */
export const LIGHT_SPECS: readonly ColorSpec[] = [
  { tag: t.meta, color: "#404740" },
  { tag: t.keyword, color: "#708" },
  {
    tag: [t.atom, t.bool, t.url, t.contentSeparator, t.labelName],
    color: "#219",
  },
  { tag: [t.literal, t.inserted], color: "#164" },
  { tag: [t.string, t.deleted], color: "#a11" },
  { tag: [t.regexp, t.escape, t.special(t.string)], color: "#e40" },
  { tag: t.definition(t.variableName), color: "#00f" },
  { tag: t.local(t.variableName), color: "#30a" },
  { tag: [t.typeName, t.namespace], color: "#085" },
  { tag: t.className, color: "#167" },
  { tag: [t.special(t.variableName), t.macroName], color: "#256" },
  { tag: t.definition(t.propertyName), color: "#00c" },
  { tag: t.comment, color: "#940" },
  { tag: t.invalid, color: "#f00" },
];

export const DARK_SPECS: readonly ColorSpec[] = [
  { tag: t.keyword, color: "#c678dd" },
  {
    tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
    color: "#e06c75",
  },
  { tag: [t.function(t.variableName), t.labelName], color: "#61afef" },
  {
    tag: [t.color, t.constant(t.name), t.standard(t.name)],
    color: "#d19a66",
  },
  { tag: [t.definition(t.name), t.separator], color: "#abb2bf" },
  {
    tag: [
      t.typeName,
      t.className,
      t.number,
      t.changed,
      t.annotation,
      t.modifier,
      t.self,
      t.namespace,
    ],
    color: "#e5c07b",
  },
  {
    tag: [
      t.operator,
      t.operatorKeyword,
      t.url,
      t.escape,
      t.regexp,
      t.link,
      t.special(t.string),
    ],
    color: "#56b6c2",
  },
  { tag: [t.meta, t.comment], color: "#7d8799" },
  { tag: t.link, color: "#7d8799" },
  { tag: t.heading, color: "#e06c75" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#d19a66" },
  { tag: [t.processingInstruction, t.string, t.inserted], color: "#98c379" },
  { tag: t.invalid, color: "#ffffff" },
];

/** One Dark's editor text colour, which plain tokens take in dark mode. */
export const DARK_BASE_COLOR = "#abb2bf";

/** The Code dialog parses as `javascript({ typescript: true })`. */
const tsParser = parser.configure({ dialect: "ts" });

export type CodeTheme = "light" | "dark";

export interface HighlightedToken {
  text: string;
  color?: string;
}

function highlighterFor(specs: readonly ColorSpec[]) {
  return tagHighlighter(
    specs.map((spec, index) => ({ tag: spec.tag, class: `c${index}` })),
  );
}

const HIGHLIGHTERS = {
  light: { specs: LIGHT_SPECS, highlighter: highlighterFor(LIGHT_SPECS) },
  dark: { specs: DARK_SPECS, highlighter: highlighterFor(DARK_SPECS) },
};

/**
 * Highlights JavaScript exactly as the Code dialog does. Tokens join back
 * to the input, so what is shown and what is copied cannot differ.
 */
export function highlightJs(
  code: string,
  theme: CodeTheme,
): HighlightedToken[] {
  const { specs, highlighter } = HIGHLIGHTERS[theme];
  const base = theme === "dark" ? DARK_BASE_COLOR : undefined;
  const tokens: HighlightedToken[] = [];
  highlightCode(
    code,
    tsParser.parse(code),
    highlighter,
    (text, classes) => {
      const winner = classes
        .split(" ")
        .filter(Boolean)
        .map((name) => Number(name.slice(1)))
        .reduce((best, index) => Math.max(best, index), -1);
      tokens.push({ text, color: winner >= 0 ? specs[winner]!.color : base });
    },
    () => tokens.push({ text: "\n" }),
  );
  return tokens;
}
