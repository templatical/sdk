import type { EasyEmailProNode, EasyEmailProTextNode } from "./types";

/** Escape `& < > "` for text content and attribute values. */
function escapeHtml(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    if (ch === "&") out += "&amp;";
    else if (ch === "<") out += "&lt;";
    else if (ch === ">") out += "&gt;";
    else if (ch === '"') out += "&quot;";
    else out += ch;
  }
  return out;
}

function isTextNode(
  node: EasyEmailProNode | EasyEmailProTextNode,
): node is EasyEmailProTextNode {
  return typeof (node as EasyEmailProTextNode).text === "string";
}

/**
 * Nesting (outer → inner): link → color/bgColor span → underline → strike →
 * em → strong. Matches the Task 4 brief / design §8.1 mark order.
 */
function serialiseTextNode(node: EasyEmailProTextNode): string {
  let html = escapeHtml(node.text);

  if (node.bold) html = `<strong>${html}</strong>`;
  if (node.italic) html = `<em>${html}</em>`;
  if (node.strikethrough) html = `<s>${html}</s>`;
  if (node.underline) html = `<u>${html}</u>`;

  const styles: string[] = [];
  if (typeof node.color === "string" && node.color !== "") {
    styles.push(`color: ${escapeHtml(node.color)}`);
  }
  if (typeof node.bgColor === "string" && node.bgColor !== "") {
    styles.push(`background-color: ${escapeHtml(node.bgColor)}`);
  }
  if (styles.length > 0) {
    html = `<span style="${styles.join("; ")}">${html}</span>`;
  }

  if (node.link) {
    const href = escapeHtml(node.link.href ?? "");
    const blank = node.link.blank === true ? ' target="_blank"' : "";
    html = `<a href="${href}"${blank}>${html}</a>`;
  }

  return html;
}

/** Easy Email Pro's `HTML_NODE_VOID_TAGS`: rendered `<tag />`, children ignored. */
const VOID_TAGS = new Set([
  "img",
  "br",
  "hr",
  "area",
  "base",
  "col",
  "embed",
  "input",
  "link",
  "meta",
  "source",
]);

const TAG_NAME = /^[a-z][a-z0-9-]*$/;
const ATTRIBUTE_NAME = /^[a-z_:][a-z0-9_:.-]*$/i;

/**
 * An inline `html-node` renders as `<tagName attrs>children</tagName>`. Only
 * non-empty string attributes are written, as Easy Email Pro does. A tag or
 * attribute name that could break out of the markup is dropped, the tag
 * falling back to `span`.
 */
function serialiseHtmlNode(node: EasyEmailProNode): string {
  const rawTag = node.data?.["tagName"];
  const lowered = typeof rawTag === "string" ? rawTag.toLowerCase() : "";
  const tagName = TAG_NAME.test(lowered) ? lowered : "span";

  let attrs = "";
  for (const [name, value] of Object.entries(node.attributes ?? {})) {
    if (typeof value !== "string" || !ATTRIBUTE_NAME.test(name)) continue;
    const trimmed = value.trim();
    if (trimmed === "") continue;
    attrs += ` ${name}="${escapeHtml(trimmed)}"`;
  }

  if (VOID_TAGS.has(tagName)) return `<${tagName}${attrs} />`;
  return `<${tagName}${attrs}>${serialiseChildren(node.children)}</${tagName}>`;
}

/**
 * Easy Email Pro renders a `mergetag` as `{{ name }}`, the name being its
 * first text child and the marks on that child applying to the token.
 * `data.default` is not part of that output. A blank name has no variable to
 * keep.
 */
function serialiseMergetag(node: EasyEmailProNode): string {
  const first = node.children?.[0];
  if (!first || !isTextNode(first)) return "";
  const name = first.text.trim();
  if (name === "") return "";
  return serialiseTextNode({ ...first, text: `{{ ${name} }}` });
}

function serialiseNode(node: EasyEmailProNode | EasyEmailProTextNode): string {
  if (node.type === "line-break") return "<br>";

  if (node.type === "html-block-node") {
    const element = node as EasyEmailProNode;
    const rawTag = element.data?.["tagName"];
    const tagName =
      typeof rawTag === "string" && rawTag !== "" ? rawTag : "div";
    const inner = serialiseChildren(element.children);
    return `<${tagName}>${inner}</${tagName}>`;
  }

  if (node.type === "html-node") {
    return serialiseHtmlNode(node as EasyEmailProNode);
  }

  if (node.type === "mergetag")
    return serialiseMergetag(node as EasyEmailProNode);

  // Any other typed element has no inline rendering here and is dropped.
  if (typeof node.type === "string" && node.type !== "") return "";

  if (isTextNode(node)) return serialiseTextNode(node);

  return "";
}

/** Slate children → HTML for TitleBlock / ParagraphBlock content. */
export function serialiseChildren(
  children: Array<EasyEmailProNode | EasyEmailProTextNode> | undefined,
): string {
  if (!children || children.length === 0) return "";
  let out = "";
  for (const child of children) {
    out += serialiseNode(child);
  }
  return out;
}
