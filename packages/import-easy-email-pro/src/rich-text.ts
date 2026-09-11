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

  // Typed elements other than line-break / html-block-node are ignored —
  // the parent leaf mapper html-fallbacks whole unknown leaves.
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
