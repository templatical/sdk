// A pure reducer over the MCP operation vocabulary.
//
// `applyOperation(content, payload) -> { ok, content, error }`. The input is
// never mutated: every operation works on a `safeClone` and returns a new
// document, so a rejected operation leaves the caller's copy provably untouched.
//
// Two deliberate differences from the editor's own mutators in
// `@templatical/core` (`src/editor.ts`), which this mirrors:
//
//  1. **Failure is explicit.** Core silently `return`s on an invalid operation,
//     which is right for a UI — a drag that can't drop simply doesn't. An agent
//     gets no such feedback, so a silent no-op would read as success and the
//     next instruction would build on a state that never happened. Every
//     rejection here carries a reason.
//  2. **No collaboration locks.** `lockedBlocks` is a Cloud concern; this runs
//     against a local working file with a single writer.
//
// Core is FSL and cannot be imported here, so the shared invariants — above all
// the section-into-column refusal (issue #292) — are reimplemented. That is a
// real drift risk: a guard added to core will not appear here. `tests/
// operations.test.ts` states each invariant against both descriptions so the
// pair has to be reconciled deliberately.
//
// Note the payload keys are camelCase (`blockId`, `targetSectionId`), matching
// `@templatical/types` and core. Cloud's MCP tools emit snake_case in their own
// `data` payloads, so this reducer is NOT wire-compatible with Cloud broadcasts
// and is not meant to be.

import { safeClone } from "@templatical/types";
import type {
  Block,
  ColumnLayout,
  McpOperationPayload,
  SectionBlock,
  TemplateContent,
  TemplateSettings,
} from "@templatical/types";

/** Columns a layout declares. Mirrors the helper in core's editor. */
export function getColumnCount(layout: ColumnLayout): number {
  if (layout === "1") return 1;
  if (layout === "3") return 3;
  return 2;
}

function findBlockById(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (block.type === "section") {
      for (const column of block.children) {
        const found = findBlockById(column, id);
        if (found) return found;
      }
    }
  }
  return null;
}

interface ParentRef {
  blocks: Block[];
  sectionId?: string;
  columnIndex?: number;
}

function findBlockParent(
  blocks: Block[],
  id: string,
  parent: ParentRef = { blocks },
): ParentRef | null {
  for (const block of blocks) {
    if (block.id === id) return parent;
    if (block.type === "section") {
      for (let colIdx = 0; colIdx < block.children.length; colIdx++) {
        const result = findBlockParent(block.children[colIdx], id, {
          blocks: block.children[colIdx],
          sectionId: block.id,
          columnIndex: colIdx,
        });
        if (result) return result;
      }
    }
  }
  return null;
}

export interface OperationResult {
  ok: boolean;
  /** The new document on success; the unchanged input on failure. */
  content: TemplateContent;
  error?: string;
}

function reject(content: TemplateContent, error: string): OperationResult {
  return { ok: false, content, error };
}

/**
 * Resolve the array an operation targets, enforcing the column rules.
 * Returns a string on rejection so callers can surface the reason.
 */
function resolveTarget(
  content: TemplateContent,
  targetSectionId: string | undefined,
  columnIndex: number,
): Block[] | string {
  if (!targetSectionId) return content.blocks;

  const section = findBlockById(content.blocks, targetSectionId);
  if (!section) return `No block with id "${targetSectionId}".`;
  if (section.type !== "section") {
    return `Block "${targetSectionId}" is a ${section.type}, not a section — it has no columns.`;
  }
  const count = getColumnCount((section as SectionBlock).columns);
  if (columnIndex < 0 || columnIndex >= count) {
    return `Column ${columnIndex} is out of range for a "${(section as SectionBlock).columns}" section (${count} column(s)).`;
  }
  const children = section as SectionBlock;
  children.children[columnIndex] = children.children[columnIndex] || [];
  return children.children[columnIndex];
}

function insertAt(target: Block[], block: Block, index?: number): void {
  if (index !== undefined && index < target.length) {
    target.splice(index, 0, block);
  } else {
    target.push(block);
  }
}

type Data = Record<string, unknown>;

/** Apply one operation, returning a new document. Never mutates the input. */
export function applyOperation(
  content: TemplateContent,
  payload: McpOperationPayload,
): OperationResult {
  const data = (payload.data ?? {}) as Data;

  switch (payload.operation) {
    case "set_content": {
      const next = data.content as TemplateContent | undefined;
      if (!next || typeof next !== "object" || !Array.isArray(next.blocks)) {
        return reject(
          content,
          "set_content needs `content` with a blocks array.",
        );
      }
      return { ok: true, content: safeClone(next) };
    }

    case "update_settings": {
      const updates = data.settings as Partial<TemplateSettings> | undefined;
      if (!updates || typeof updates !== "object") {
        return reject(content, "update_settings needs a `settings` object.");
      }
      const draft = safeClone(content);
      draft.settings = { ...draft.settings, ...updates };
      return { ok: true, content: draft };
    }

    case "add_block": {
      const block = data.block as Block | undefined;
      if (!block || typeof block !== "object" || typeof block.id !== "string") {
        return reject(content, "add_block needs a `block` with an id.");
      }
      const targetSectionId = data.targetSectionId as string | undefined;

      // Sections cannot nest inside a column — MJML forbids `mj-section` inside
      // `mj-column`, so the renderer drops them on export (issue #292). Reject
      // up front rather than lose the content silently at render time.
      if (targetSectionId && block.type === "section") {
        return reject(
          content,
          "A section cannot be nested inside a section column — MJML would drop it on export. Add it at the top level instead.",
        );
      }

      const draft = safeClone(content);
      if (findBlockById(draft.blocks, block.id)) {
        return reject(content, `A block with id "${block.id}" already exists.`);
      }
      const target = resolveTarget(
        draft,
        targetSectionId,
        (data.columnIndex as number | undefined) ?? 0,
      );
      if (typeof target === "string") return reject(content, target);

      insertAt(target, safeClone(block), data.index as number | undefined);
      return { ok: true, content: draft };
    }

    case "update_block": {
      const blockId = data.blockId as string | undefined;
      const updates = data.updates as Partial<Block> | undefined;
      if (!blockId) return reject(content, "update_block needs a `blockId`.");
      if (!updates || typeof updates !== "object") {
        return reject(content, "update_block needs an `updates` object.");
      }
      const draft = safeClone(content);
      const block = findBlockById(draft.blocks, blockId);
      if (!block) return reject(content, `No block with id "${blockId}".`);
      if ("type" in updates && updates.type !== block.type) {
        // Changing type in place would leave the block carrying the previous
        // type's fields, which no longer validate against its new subschema.
        return reject(
          content,
          `Cannot change a block's type (${block.type} → ${String(updates.type)}). Delete it and add the new block instead.`,
        );
      }
      Object.assign(block, updates);
      return { ok: true, content: draft };
    }

    case "update_block_style": {
      const blockId = data.blockId as string | undefined;
      const styles = data.styles as Record<string, unknown> | undefined;
      if (!blockId) {
        return reject(content, "update_block_style needs a `blockId`.");
      }
      if (!styles || typeof styles !== "object") {
        return reject(content, "update_block_style needs a `styles` object.");
      }
      const draft = safeClone(content);
      const block = findBlockById(draft.blocks, blockId);
      if (!block) return reject(content, `No block with id "${blockId}".`);
      // Merge rather than replace, so a caller can set one property without
      // restating padding and every other style the block already carries.
      block.styles = {
        ...block.styles,
        ...styles,
      } as Block["styles"];
      return { ok: true, content: draft };
    }

    case "delete_block": {
      const blockId = data.blockId as string | undefined;
      if (!blockId) return reject(content, "delete_block needs a `blockId`.");
      const draft = safeClone(content);
      const parent = findBlockParent(draft.blocks, blockId);
      if (!parent) return reject(content, `No block with id "${blockId}".`);
      const index = parent.blocks.findIndex((b) => b.id === blockId);
      parent.blocks.splice(index, 1);
      return { ok: true, content: draft };
    }

    case "move_block": {
      const blockId = data.blockId as string | undefined;
      const index = data.index as number | undefined;
      if (!blockId) return reject(content, "move_block needs a `blockId`.");
      if (typeof index !== "number" || index < 0) {
        return reject(content, "move_block needs a non-negative `index`.");
      }
      const targetSectionId = data.targetSectionId as string | undefined;

      const draft = safeClone(content);
      const parent = findBlockParent(draft.blocks, blockId);
      if (!parent) return reject(content, `No block with id "${blockId}".`);
      const oldIndex = parent.blocks.findIndex((b) => b.id === blockId);

      if (targetSectionId && parent.blocks[oldIndex].type === "section") {
        return reject(
          content,
          "A section cannot be moved into a section column — MJML would drop it on export.",
        );
      }
      if (targetSectionId === blockId) {
        return reject(content, "A block cannot be moved into itself.");
      }

      // Resolve the target BEFORE splicing the source: an invalid target would
      // otherwise leave the block removed and unrecoverable.
      const target = resolveTarget(
        draft,
        targetSectionId,
        (data.columnIndex as number | undefined) ?? 0,
      );
      if (typeof target === "string") return reject(content, target);

      const [block] = parent.blocks.splice(oldIndex, 1);
      target.splice(index, 0, block);
      return { ok: true, content: draft };
    }

    default: {
      return reject(
        content,
        `Unknown operation "${String(payload.operation)}".`,
      );
    }
  }
}
