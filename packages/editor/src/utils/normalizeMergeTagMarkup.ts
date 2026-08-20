import type { Ref } from "vue";
import type {
  Block,
  MergeTag,
  MergeTagsConfig,
  SectionBlock,
  SyntaxPreset,
  TemplateContent,
  TemplatesProvider,
} from "@templatical/types";
import {
  containsMergeTag,
  getLogicMergeTagKeyword,
  getMergeTagLabel,
  resolveSyntax,
} from "@templatical/types";

/**
 * Convert bare merge-tag tokens in rich-text HTML into the `<span
 * data-merge-tag>` nodes the editor understands.
 *
 * A tag reaches stored content in one of two physical shapes. Anything a user
 * types or pastes is already a node, because `MergeTagNode`'s input and paste
 * rules convert it on the spot. What stays a bare token is content that never
 * passed through that pipeline — `init({ content })`, `setContent()`, a
 * template loaded from a store, or one produced by the `@templatical/import-*`
 * converters. A bare token renders as literal text: no label, no highlight, no
 * `sample` substitution, and it cannot be selected or deleted as a unit.
 *
 * Three properties of this implementation are load-bearing:
 *
 * 1. **It walks text nodes, never markup.** A token in attribute position —
 *    `<a href="{{unsubscribe_url}}">` is the common one — must be left exactly
 *    as it is; wrapping it injects an element into an attribute value and
 *    corrupts the document. A `TreeWalker` over text nodes cannot reach an
 *    attribute at all, so this holds by construction rather than by guard.
 *    A regex cannot do this job. Guarding with a `(?<!data-merge-tag=")`
 *    lookbehind protects the attribute of an already-converted span and
 *    nothing else, so `<a href="{{unsubscribe_url}}">` becomes an anchor whose
 *    href contains a `<span>`. Telling text position from attribute position
 *    needs parsing; no amount of lookbehind substitutes for it.
 *
 * 2. **It is idempotent structurally.** The walk rejects the whole subtree of
 *    any element already carrying `data-merge-tag` / `data-logic-merge-tag`,
 *    so an existing span's inner text is unreachable no matter what it says.
 *    That covers the case where a tag's label *is* its value.
 *
 * 3. **It never builds markup by concatenation.** A consumer may configure a
 *    syntax whose delimiters contain `<` / `>` — Smarty-style `<% $email %>` —
 *    so a template string would emit an attribute no scanner could re-read.
 *    Spans are created as elements and filled via `setAttribute` /
 *    `textContent`, which leaves escaping to the serializer.
 *
 * Matching is driven by `syntax`, not by the declared tag list, so a template
 * migrated from another ESP has all of its tags made atomic rather than only
 * the handful the consumer has declared so far. An undeclared token falls back
 * to showing its raw value as the label, which `getMergeTagLabel` already does.
 * This mirrors typing: the input and paste rules are registered unconditionally
 * and match on syntax alone.
 */

interface TagHit {
  start: number;
  end: number;
  attr: string;
  value: string;
  label: string;
}

function globalRegex(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

function collectHits(
  text: string,
  mergeTags: MergeTag[],
  syntax: SyntaxPreset,
): TagHit[] {
  const hits: TagHit[] = [];

  const scan = (
    pattern: RegExp,
    attr: string,
    label: (match: string) => string,
  ): void => {
    const regex = globalRegex(pattern);
    let match = regex.exec(text);
    while (match !== null) {
      const start = match.index;
      const end = start + match[0].length;
      // A zero-length match would spin `exec` forever on the same index.
      if (match[0].length === 0) {
        regex.lastIndex++;
      } else if (!hits.some((hit) => start < hit.end && end > hit.start)) {
        hits.push({
          start,
          end,
          attr,
          value: match[0],
          label: label(match[0]),
        });
      }
      match = regex.exec(text);
    }
  };

  // Logic first, so it wins any overlap. Some syntaxes' value regex is liberal
  // enough to also match a logic tag — handlebars' `{{.+?}}` swallows
  // `{{#each items}}` — and `isMergeTagValue` resolves that same way.
  scan(syntax.logic, "data-logic-merge-tag", (value) =>
    getLogicMergeTagKeyword(value, syntax),
  );
  scan(syntax.value, "data-merge-tag", (value) =>
    getMergeTagLabel(value, mergeTags),
  );

  return hits.sort((a, b) => a.start - b.start);
}

/** Text nodes not already inside a merge-tag span, in document order. */
function collectNormalizableTextNodes(doc: Document): Text[] {
  const walker = doc.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Node): number {
        if (node.nodeType !== 1) return NodeFilter.FILTER_ACCEPT;
        const el = node as Element;
        // REJECT (not SKIP) prunes the subtree, which is what makes a second
        // pass unable to see an existing span's inner text.
        return el.hasAttribute("data-merge-tag") ||
          el.hasAttribute("data-logic-merge-tag")
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_SKIP;
      },
    },
  );

  // Collected up front: replacing a node mid-walk invalidates the walker.
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current !== null) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

export function normalizeMergeTagsInHtml(
  html: string,
  mergeTags: MergeTag[],
  syntax: SyntaxPreset,
): string {
  if (!html) return html;
  // Cheap reject before paying for a parse. A token that exists only in an
  // attribute still gets past this, and is then caught by the zero-replacement
  // short-circuit below.
  if (!containsMergeTag(html, syntax)) return html;
  if (typeof DOMParser === "undefined") return html;

  const doc = new DOMParser().parseFromString(
    `<!doctype html><body>${html}</body>`,
    "text/html",
  );

  let replacements = 0;
  for (const node of collectNormalizableTextNodes(doc)) {
    const text = node.data;
    const hits = collectHits(text, mergeTags, syntax);
    if (hits.length === 0) continue;

    const fragment = doc.createDocumentFragment();
    let cursor = 0;
    for (const hit of hits) {
      if (hit.start > cursor) {
        fragment.appendChild(
          doc.createTextNode(text.substring(cursor, hit.start)),
        );
      }
      const span = doc.createElement("span");
      span.setAttribute(hit.attr, hit.value);
      span.textContent = hit.label;
      fragment.appendChild(span);
      cursor = hit.end;
    }
    if (cursor < text.length) {
      fragment.appendChild(doc.createTextNode(text.substring(cursor)));
    }

    node.parentNode?.replaceChild(fragment, node);
    replacements += hits.length;
  }

  // Nothing matched in text position, so return the input verbatim rather than
  // a re-serialization of it — otherwise content with no tags at all would be
  // rewritten (`<br/>` → `<br>`, attribute quoting, entity encoding) for no
  // reason. Where a replacement does happen some churn is unavoidable, and the
  // renderer accepts both shapes.
  if (replacements === 0) return html;

  return doc.body.innerHTML;
}

/**
 * The rich-text fields, and only those. Every other merge-tag-bearing field —
 * `ButtonBlock.text`/`url`, `ImageBlock.alt`, `HtmlBlock.content`, custom-block
 * `fieldValues`, `settings.preheaderText` — is a plain string rendered as text,
 * so a span written into one would be displayed literally on the canvas and
 * emitted into a `url=` attribute by the renderer.
 *
 * `TableCellData.content` is span-bearing to the renderer but is deliberately
 * excluded: `TableBlock.vue` hydrates a cell with `textContent` and writes
 * `innerText` back on blur, so the first focus-and-leave on a normalized cell
 * would persist the literal markup into stored content as text. The
 * editor/renderer asymmetry there is a separate, pre-existing gap.
 */
function normalizeBlock(
  block: Block,
  mergeTags: MergeTag[],
  syntax: SyntaxPreset,
): Block {
  if (block.type === "section") {
    if (!Array.isArray(block.children)) return block;
    let changed = false;
    const children = block.children.map((column) => {
      if (!Array.isArray(column)) return column;
      let columnChanged = false;
      const next = column.map((child) => {
        const normalized = normalizeBlock(child, mergeTags, syntax);
        if (normalized !== child) columnChanged = true;
        return normalized;
      });
      if (!columnChanged) return column;
      changed = true;
      return next;
    });
    return changed ? ({ ...block, children } as SectionBlock) : block;
  }

  if (block.type !== "title" && block.type !== "paragraph") return block;
  if (typeof block.content !== "string") return block;

  const content = normalizeMergeTagsInHtml(block.content, mergeTags, syntax);
  return content === block.content ? block : { ...block, content };
}

/**
 * Normalize every rich-text field in a template. Returns the input reference
 * unchanged when nothing matched, so a template with no bare tokens costs no
 * allocation and keeps its object identity; otherwise returns a copy, leaving
 * the caller's content untouched.
 *
 * Shape is checked rather than trusted at every level. `TemplateContent` types
 * `blocks` as required and `SectionBlock.children` as a `Block[][]`, but this
 * runs at the SDK's entry points on an object the consumer hands us — a partial
 * or hand-rolled template must come back untouched, not turn a working `init()`
 * into a `TypeError`.
 */
export function normalizeMergeTagMarkup(
  content: TemplateContent,
  mergeTags: MergeTag[],
  syntax: SyntaxPreset,
): TemplateContent {
  if (!content || !Array.isArray(content.blocks)) return content;

  let changed = false;
  const blocks = content.blocks.map((block) => {
    const normalized = normalizeBlock(block, mergeTags, syntax);
    if (normalized !== block) changed = true;
    return normalized;
  });

  return changed ? { ...content, blocks } : content;
}

/**
 * `normalizeMergeTagMarkup` bound to the editor's own config shape, so the hook
 * sites don't each resolve tags and syntax themselves.
 *
 * An absent `mergeTags` still normalizes, under the liquid default. That is not
 * an oversight: `MergeTagNode`'s input and paste rules are registered
 * unconditionally with the same default, so a consumer who configured nothing
 * already gets a node the instant a user types `{{x}}`. Loading the same text
 * and leaving it inert would be the inconsistency.
 */
export function normalizeContentForConfig(
  content: TemplateContent,
  mergeTags: MergeTagsConfig | undefined,
): TemplateContent {
  return normalizeMergeTagMarkup(
    content,
    mergeTags?.tags ?? [],
    resolveSyntax(mergeTags?.syntax),
  );
}

/**
 * Wrap a `TemplatesProvider` so content arriving from the store is normalized
 * before the editor ever sees it.
 *
 * Only `load` is wrapped. `save` sends content *out*, and what it sends is
 * already-normalized editor state; rewriting it here would change what the
 * store keeps for no benefit. `create` likewise carries content outward, and
 * the template it returns supplies identity and timestamps rather than the
 * content the editor goes on to edit.
 *
 * Wrapping the provider — rather than normalizing after `load()` resolves —
 * is what keeps Q4 true: core assigns already-normalized content to its state
 * and observes no mutation, so there is no dirty flag to suppress and no
 * autosave tick to swallow.
 */
/**
 * The slice of the editor a content-restoring feature consumes. Structural on
 * purpose: it matches `useVersionHistoryFeature`'s own `VersionHistoryEditor`
 * without importing it, so this util keeps no dependency on a composable.
 */
interface ContentWritingEditor {
  state: {
    readonly template?: { id: string } | null;
    readonly isDirty: boolean;
  };
  content: Ref<TemplateContent>;
  setContent: (content: TemplateContent, markDirty?: boolean) => void;
}

/**
 * Wrap an editor so content written through `setContent` is normalized first.
 *
 * This is how version history is covered. Its content reaches the canvas by
 * three routes — `version.content` off a hydrated list, a `fetched` cache, and
 * `provider.get()` — so wrapping the *provider*, the way the `templates` path
 * does, would miss two of them. `setContent` is the one chokepoint they share.
 *
 * A version is not guaranteed to hold normalized content just because a save
 * produced it: a store carries whatever was written to it, and a backend may
 * version a template it imported rather than one the editor round-tripped.
 * Previewing such a version without this would put bare tokens back on a canvas
 * where every other tag is a chip.
 *
 * `markDirty` is forwarded untouched: every version-history write passes
 * `false`, and swallowing that would turn opening a preview into an unsaved
 * change. `setContent` is resolved per call rather than captured, because
 * collaboration replaces the editor's mutators with broadcasting versions
 * before this feature is built.
 */
export function withNormalizedContentWrites<T extends ContentWritingEditor>(
  editor: T,
  mergeTags: MergeTagsConfig | undefined,
): ContentWritingEditor {
  return {
    get state() {
      return editor.state;
    },
    get content() {
      return editor.content;
    },
    setContent: (content: TemplateContent, markDirty?: boolean) =>
      editor.setContent(
        normalizeContentForConfig(content, mergeTags),
        markDirty,
      ),
  };
}

export function withNormalizedTemplateLoads(
  provider: TemplatesProvider,
  mergeTags: MergeTagsConfig | undefined,
): TemplatesProvider {
  return {
    ...provider,
    async load(id: string) {
      const template = await provider.load(id);
      const content = normalizeContentForConfig(template.content, mergeTags);
      return content === template.content ? template : { ...template, content };
    },
  };
}
