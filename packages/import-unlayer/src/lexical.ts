/** Convert the serialized Lexical state stored by modern Unlayer text blocks. */
export function lexicalToHtml(state: unknown): string | null {
  try {
    const parsed = typeof state === "string" ? JSON.parse(state) : state;
    if (
      !record(parsed) ||
      !record(parsed.root) ||
      !Array.isArray(parsed.root.children)
    )
      return null;
    return render(parsed.root);
  } catch {
    return null;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function render(node: unknown): string {
  if (!record(node)) throw new Error("Unreadable Lexical node");
  if (node.type === "text") {
    if (typeof node.text !== "string")
      throw new Error("Unreadable Lexical text");
    let html = escape(node.text);
    const format = typeof node.format === "number" ? node.format : 0;
    for (const [bit, tag] of [
      [1, "strong"],
      [2, "em"],
      [4, "s"],
      [8, "u"],
      [16, "code"],
      [32, "sub"],
      [64, "sup"],
    ] as const) {
      if (format & bit) html = `<${tag}>${html}</${tag}>`;
    }
    return html;
  }
  if (node.type === "linebreak") return "<br>";
  if (!Array.isArray(node.children))
    throw new Error("Unreadable Lexical children");
  const children = node.children.map(render).join("");
  switch (node.type) {
    case "paragraph":
      return `<p>${children}</p>`;
    case "heading": {
      const tag =
        typeof node.tag === "string" && /^h[1-6]$/.test(node.tag)
          ? node.tag
          : "h2";
      return `<${tag}>${children}</${tag}>`;
    }
    case "list": {
      const tag = node.tag === "ol" || node.listType === "number" ? "ol" : "ul";
      return `<${tag}>${children}</${tag}>`;
    }
    case "listitem":
      return `<li>${children}</li>`;
    case "link":
      return typeof node.url === "string"
        ? `<a href="${escape(node.url)}">${children}</a>`
        : children;
    default:
      return children;
  }
}
