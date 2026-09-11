import type {
  EasyEmailProDocument,
  EasyEmailProNode,
  EasyEmailProVariable,
} from "./types";

const VAR_PREFIX = "$var(";

/** Spec §3.3 category map — unknown types skip the category layer. */
export const CATEGORY_BY_TYPE: Record<string, string> = {
  "standard-paragraph": "TEXT",
  "standard-h1": "TEXT",
  "standard-h2": "TEXT",
  "standard-h3": "TEXT",
  "standard-h4": "TEXT",
  "standard-button": "BUTTON",
  "standard-image": "IMAGE",
  "standard-navbar": "NAVBAR",
  "standard-navbar-link": "NAVBAR",
  "standard-social": "SOCIAL",
  "standard-social-element": "SOCIAL",
  "standard-spacer": "SPACER",
  "standard-divider": "DIVIDER",
  "standard-hero": "HERO",
  "standard-wrapper": "WRAPPER",
  "standard-section": "SECTION",
  "standard-column": "COLUMN",
  "standard-group": "GROUP",
};

export interface ResolveContext {
  variables: Record<string, string>;
  blockAttributes: Record<string, Record<string, unknown>>;
  categoryAttributes: Record<string, Record<string, unknown>>;
  globalAttributes: Record<string, unknown>;
  /** Page node — section fill falls back to `content-background-color`. */
  page: EasyEmailProNode;
}

/**
 * `null`, `""`, `"url()"`, `"transparent"`, and leftover `$var(` after
 * substitution are unset. Presence-guards that treat these as set write
 * illegal empties.
 */
export function isUnset(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    trimmed === "" ||
    trimmed === "url()" ||
    trimmed.toLowerCase() === "transparent" ||
    trimmed.includes(VAR_PREFIX)
  );
}

/** Index `data.variables[]` by name for `$var` lookup. */
export function buildVariableTable(
  variables: EasyEmailProVariable[] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!variables) return out;
  for (const entry of variables) {
    if (typeof entry.name !== "string" || entry.name === "") continue;
    if (typeof entry.value !== "string") continue;
    out[entry.name] = entry.value;
  }
  return out;
}

/**
 * Replace `$var(name)` tokens via a linear scan (no regex — CodeQL
 * `js/polynomial-redos`). Unknown names are left in place and flagged.
 */
export function substituteVars(
  value: string,
  variables: Record<string, string>,
): { value: string; unresolved: boolean } {
  let out = "";
  let i = 0;
  let unresolved = false;

  while (i < value.length) {
    const start = value.indexOf(VAR_PREFIX, i);
    if (start === -1) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, start);
    const nameStart = start + VAR_PREFIX.length;
    const nameEnd = findMatchingParen(value, nameStart);
    if (nameEnd === -1) {
      // Unclosed `$var(` — keep the rest verbatim and mark unresolved.
      out += value.slice(start);
      unresolved = true;
      break;
    }
    const name = value.slice(nameStart, nameEnd);
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      out += variables[name];
    } else {
      out += value.slice(start, nameEnd + 1);
      unresolved = true;
    }
    i = nameEnd + 1;
  }

  if (out.includes(VAR_PREFIX)) unresolved = true;
  return { value: out, unresolved };
}

/** Walk from `openIdx` (char after `(`) to the matching `)`. */
function findMatchingParen(value: string, openIdx: number): number {
  let depth = 1;
  for (let i = openIdx; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function contextFromPage(page: EasyEmailProNode): ResolveContext {
  const data = isPlainObject(page.data) ? page.data : {};
  return {
    variables: buildVariableTable(
      Array.isArray(data.variables)
        ? (data.variables as EasyEmailProVariable[])
        : undefined,
    ),
    blockAttributes: asNestedAttrMap(data.blockAttributes),
    categoryAttributes: asNestedAttrMap(data.categoryAttributes),
    globalAttributes: asAttrMap(data.globalAttributes),
    page,
  };
}

/** Widget `data.input` overrides page variables for `$var` resolution. */
export function withWidgetInput(
  ctx: ResolveContext,
  input: Record<string, unknown> | undefined,
): ResolveContext {
  if (!input) return ctx;
  const variables = { ...ctx.variables };
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") variables[key] = value;
  }
  return { ...ctx, variables };
}

/**
 * Cascade: element → blockAttributes[type] → categoryAttributes[cat] →
 * globalAttributes. Missing keys fall through. String hits run through
 * `substituteVars`. Keys stay kebab-case MJML.
 */
export function readAttr(
  node: EasyEmailProNode,
  key: string,
  ctx: ResolveContext,
): unknown {
  const raw = lookupAttr(node, key, ctx);
  if (typeof raw !== "string") return raw;
  return substituteVars(raw, ctx.variables).value;
}

function lookupAttr(
  node: EasyEmailProNode,
  key: string,
  ctx: ResolveContext,
): unknown {
  const fromElement = node.attributes?.[key];
  if (fromElement !== undefined) return fromElement;

  if (typeof node.type === "string") {
    const fromBlock = ctx.blockAttributes[node.type]?.[key];
    if (fromBlock !== undefined) return fromBlock;

    const category = CATEGORY_BY_TYPE[node.type];
    if (category) {
      const fromCategory = ctx.categoryAttributes[category]?.[key];
      if (fromCategory !== undefined) return fromCategory;
    }
  }

  return ctx.globalAttributes[key];
}

/**
 * Envelope unwrap. Never throws — the converter owns invalid-shape errors.
 * Returns `{ page, subject }` when a page is visible; caller checks
 * `page.type === "page"`.
 */
export function unwrapDocument(root: unknown): {
  page: EasyEmailProNode;
  subject?: string;
} {
  if (!isPlainObject(root)) {
    return { page: {} };
  }

  if (root.type === "page") {
    return { page: root as EasyEmailProNode };
  }

  const doc = root as EasyEmailProDocument;
  const page = isPlainObject(doc.content)
    ? (doc.content as EasyEmailProNode)
    : (root as EasyEmailProNode);
  const subject = typeof doc.subject === "string" ? doc.subject : undefined;
  return subject === undefined ? { page } : { page, subject };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asAttrMap(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function asNestedAttrMap(
  value: unknown,
): Record<string, Record<string, unknown>> {
  if (!isPlainObject(value)) return {};
  const out: Record<string, Record<string, unknown>> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isPlainObject(entry)) out[key] = entry;
  }
  return out;
}
