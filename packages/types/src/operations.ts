import type { Block } from "./blocks";
import { safeClone } from "./clone";
import { deepEqual } from "./deep-equal";
import type { TemplateContent, TemplateSettings } from "./template";

/** Where a block sits: `null` is the top level, otherwise a section column. */
export type BlockParent = null | { sectionId: string; column: number };

/** Insert `block` into `parent`, after the sibling `after` (`null`: first). */
export interface AddBlockOperation {
  op: "addBlock";
  /**
   * A non-empty string `id` and a string `type`. A section brings its
   * `children`: a list of columns, each a list of blocks.
   */
  block: Block;
  parent: BlockParent;
  after: string | null;
}

/**
 * Move a block to `parent`, after the sibling `after` (`null`: first). The
 * sibling list is the target container with the moved block taken out.
 */
export interface MoveBlockOperation {
  op: "moveBlock";
  blockId: string;
  parent: BlockParent;
  after: string | null;
  /**
   * The block's current position: its parent and its previous sibling. A key
   * left out counts as `null`.
   */
  expect?: { parent: BlockParent; after: string | null };
}

/** Delete a block. Deleting a section deletes its children with it. */
export interface DeleteBlockOperation {
  op: "deleteBlock";
  blockId: string;
  /** The whole current block, children included, compared exactly. */
  expect?: { block: Block };
}

/**
 * Replace top-level keys of a block (`set`, a `styles` object included) and
 * remove others (`unset`). `id`, `type` and `children` can't be touched, and
 * a section's `columns` can't be unset. On a section, `set.columns` resizes
 * `children` to the layout's column count.
 */
export interface UpdateBlockOperation {
  op: "updateBlock";
  blockId: string;
  set?: Record<string, unknown>;
  unset?: string[];
  /** Expected current values by key; `null` matches `null` or an absent key. */
  expect?: Record<string, unknown>;
}

/** Replace and remove top-level keys of `content.settings`. */
export interface UpdateSettingsOperation {
  op: "updateSettings";
  set?: Partial<TemplateSettings>;
  unset?: string[];
  /** Expected current values by key; `null` matches `null` or an absent key. */
  expect?: Record<string, unknown>;
}

/**
 * Replace `blocks` and `settings` wholesale. The engine checks only that
 * `blocks` is an array and `settings` an object.
 */
export interface SetContentOperation {
  op: "setContent";
  content: TemplateContent;
}

/**
 * One change to a template, in the vocabulary the editor, the CLI's `edit`
 * command, collaboration backends and Templatical Cloud share. Positions are
 * anchored to a sibling rather than an index, so an operation means the same
 * thing after someone else's change lands first.
 */
export type Operation =
  | AddBlockOperation
  | MoveBlockOperation
  | DeleteBlockOperation
  | UpdateBlockOperation
  | UpdateSettingsOperation
  | SetContentOperation;

/** Why {@link applyOperations} refused a batch. */
export type OperationErrorCode =
  | "block_exists"
  | "block_missing"
  | "anchor_missing"
  | "precondition_failed"
  | "lock_held"
  | "locked_by_others"
  | "invalid_operation";

/**
 * A refused batch. `opIndex` is the 0-based index of the operation that
 * failed; nothing in the batch was applied. `blockId`, when set, is the block
 * the refusal is about: the locked block for `lock_held` and
 * `locked_by_others`, the clashing id for `block_exists`, the missing block or
 * section for `block_missing`, the missing anchor for `anchor_missing`.
 */
export class OperationError extends Error {
  readonly code: OperationErrorCode;
  readonly opIndex: number;
  readonly blockId?: string;

  constructor(
    code: OperationErrorCode,
    opIndex: number,
    message: string,
    blockId?: string,
  ) {
    super(message);
    this.name = "OperationError";
    this.code = code;
    this.opIndex = opIndex;
    if (blockId !== undefined) this.blockId = blockId;
  }
}

/** A lock as the engine sees it: which session holds which block. */
export interface OperationLock {
  blockId: string;
  sessionId: string;
}

/**
 * Who is acting, and which blocks sessions hold. Omit it to apply with no
 * locks at all, which is how an editor applies a batch the server accepted.
 */
export interface OperationContext {
  /** Unexpired locks only. */
  locks?: readonly OperationLock[];
  /** The acting session; `null` (headless) treats every lock as another's. */
  session?: string | null;
}

/**
 * The column count of a section layout: `"1"` → 1, `"3"` → 3, anything else
 * → 2. The section toolbar and Templatical Cloud's engine use the same rule.
 */
export function getColumnCount(layout: unknown): number {
  if (layout === "1") return 1;
  if (layout === "3") return 3;
  return 2;
}

/**
 * Apply a batch to a copy of `content` and return the copy. All or nothing:
 * the first operation that can't apply throws an {@link OperationError}, and
 * `content` is untouched.
 *
 * Each operation is checked in a fixed order, and the first failing check
 * decides the error (the cross-track contract's C1, which Templatical Cloud's
 * PHP engine follows too):
 *
 * 1. its shape (`invalid_operation`), a section's `columns` in `unset` included;
 * 2. the blocks it names (`block_missing`, `block_exists`);
 * 3. locks (`lock_held`, `locked_by_others`);
 * 4. preconditions (`precondition_failed`);
 * 5. placement (`invalid_operation`): a section into a column, a block after itself;
 * 6. the target container (`block_missing`, `invalid_operation`);
 * 7. the anchor (`anchor_missing`);
 * 8. the change itself (`invalid_operation`): a layout that drops non-empty columns.
 */
export function applyOperations(
  content: TemplateContent,
  ops: readonly Operation[],
  context: OperationContext = {},
): TemplateContent {
  const draft = safeClone(content);
  applyOperationsInPlace(draft, ops, context);
  return draft;
}

/**
 * {@link applyOperations} without the copy: `content` itself changes. When an
 * operation throws, the ones before it have already applied, so use this only
 * on a draft you can throw away, or with operations known to apply.
 */
export function applyOperationsInPlace(
  content: TemplateContent,
  ops: readonly Operation[],
  context: OperationContext = {},
): void {
  const engine: EngineContext = {
    locks: context.locks ?? [],
    session: context.session ?? null,
  };
  ops.forEach((op, index) => applyOne(content, op, index, engine));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface EngineContext {
  locks: readonly OperationLock[];
  session: string | null;
}

type Json = Record<string, unknown>;

interface Location {
  block: Json;
  /** The list the block sits in, changed in place. */
  list: unknown[];
  index: number;
  parent: BlockParent;
}

const IMMUTABLE_KEYS: ReadonlySet<string> = new Set(["id", "type", "children"]);
const NO_IMMUTABLE_KEYS: ReadonlySet<string> = new Set();

function fail(
  code: OperationErrorCode,
  index: number,
  message: string,
  blockId?: string,
): never {
  throw new OperationError(code, index, message, blockId);
}

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSection(block: Json): boolean {
  return block.type === "section";
}

/** The top-level blocks, read only: anything but a list reads as none. */
function topLevelOf(content: TemplateContent): unknown[] {
  return Array.isArray(content.blocks) ? content.blocks : [];
}

/** A section's columns, read only: anything but a list reads as empty. */
function columnsOf(section: Json): unknown[][] {
  const children = section.children;
  if (!Array.isArray(children)) return [];
  return children.map((column) => (Array.isArray(column) ? column : []));
}

/**
 * Find a block, depth first in document order: each top-level block, then the
 * blocks in its columns when it is a section. A template has no deeper level.
 */
function locate(content: TemplateContent, blockId: string): Location | null {
  const blocks = topLevelOf(content);
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    if (!isRecord(block)) continue;
    if (block.id === blockId)
      return { block, list: blocks, index, parent: null };
    if (!isSection(block) || typeof block.id !== "string") continue;
    const children = block.children;
    if (!Array.isArray(children)) continue;
    for (let column = 0; column < children.length; column++) {
      const list: unknown = children[column];
      if (!Array.isArray(list)) continue;
      for (let position = 0; position < list.length; position++) {
        const child: unknown = list[position];
        if (isRecord(child) && child.id === blockId) {
          return {
            block: child,
            list,
            index: position,
            parent: { sectionId: block.id, column },
          };
        }
      }
    }
  }
  return null;
}

/** A block's id and every id inside it, in document order. */
function idsOf(block: Json): string[] {
  const ids = typeof block.id === "string" ? [block.id] : [];
  if (isSection(block)) {
    for (const column of columnsOf(block)) ids.push(...idsIn(column));
  }
  return ids;
}

function idsIn(blocks: readonly unknown[]): string[] {
  return blocks.flatMap((block) => (isRecord(block) ? idsOf(block) : []));
}

// --- 1. Shape ----------------------------------------------------------------

function readBlockId(op: Json, index: number): string {
  if (typeof op.blockId !== "string" || op.blockId === "") {
    return fail("invalid_operation", index, "blockId must be a block id.");
  }
  return op.blockId;
}

/** `parent` is required: `null`, or a section id and a whole column index. */
function readParent(op: Json, index: number): BlockParent {
  const parent = op.parent;
  if (parent === null) return null;
  if (
    isRecord(parent) &&
    typeof parent.sectionId === "string" &&
    typeof parent.column === "number" &&
    Number.isInteger(parent.column)
  ) {
    return { sectionId: parent.sectionId, column: parent.column };
  }
  return fail(
    "invalid_operation",
    index,
    'parent must be null or { "sectionId", "column" }.',
  );
}

/** `after` is required: `null`, or a block id. */
function readAfter(op: Json, index: number): string | null {
  const after = op.after;
  if (after === null) return null;
  if (typeof after === "string" && after !== "") return after;
  return fail("invalid_operation", index, "after must be null or a block id.");
}

/** `expect`, or `null` when it is absent or `null`. */
function readExpect(op: Json, index: number): Json | null {
  const expect = op.expect;
  if (expect === undefined || expect === null) return null;
  if (isRecord(expect)) return expect;
  return fail("invalid_operation", index, "expect must be an object.");
}

/**
 * `set` and `unset`, either absent or `null`, but not both empty. A key that
 * holds `undefined` isn't set: JSON drops it on the way to a server.
 */
function readChanges(
  op: Json,
  index: number,
  immutable: ReadonlySet<string>,
): { set: Json; unset: string[] } {
  const set = op.set ?? null;
  const unset = op.unset ?? [];
  if (
    (set !== null && !isRecord(set)) ||
    !Array.isArray(unset) ||
    !unset.every((key) => typeof key === "string")
  ) {
    fail(
      "invalid_operation",
      index,
      "set must be an object and unset a list of keys.",
    );
  }
  const values = set === null ? {} : set;
  const keys = Object.keys(values).filter((key) => values[key] !== undefined);
  if (keys.length === 0 && unset.length === 0) {
    fail("invalid_operation", index, "Set or unset at least one key.");
  }
  for (const key of [...keys, ...unset]) {
    if (immutable.has(key)) {
      fail("invalid_operation", index, `"${key}" can't be set or unset.`);
    }
  }
  const clash = unset.find((key) => keys.includes(key));
  if (clash !== undefined) {
    fail("invalid_operation", index, `"${clash}" is both set and unset.`);
  }
  return {
    set: Object.fromEntries(keys.map((key) => [key, values[key]])),
    unset: unset as string[],
  };
}

/**
 * A new block: a non-empty string id and a string type. A section has a list
 * of columns, each a list of such blocks, and sits only at the top level, so
 * no section goes into a column.
 */
function assertNewBlock(
  block: unknown,
  index: number,
  inColumn: boolean,
): asserts block is Json {
  if (
    !isRecord(block) ||
    typeof block.id !== "string" ||
    block.id === "" ||
    typeof block.type !== "string"
  ) {
    fail(
      "invalid_operation",
      index,
      "A block needs a non-empty string id and a string type.",
    );
  }
  if (!isSection(block)) return;
  if (inColumn) {
    fail(
      "invalid_operation",
      index,
      "Sections can only be placed at the top level.",
    );
  }
  const columns = block.children;
  if (
    !Array.isArray(columns) ||
    !columns.every((column) => Array.isArray(column))
  ) {
    fail(
      "invalid_operation",
      index,
      "A section needs children: a list of columns, each a list of blocks.",
    );
  }
  for (const column of columns as unknown[][]) {
    for (const child of column) assertNewBlock(child, index, true);
  }
}

// --- 3. Locks ----------------------------------------------------------------

function heldByOthers(engine: EngineContext, lock: OperationLock): boolean {
  return engine.session === null || lock.sessionId !== engine.session;
}

function assertUnlocked(
  engine: EngineContext,
  ids: readonly string[],
  index: number,
): void {
  const held = engine.locks.find(
    (lock) => ids.includes(lock.blockId) && heldByOthers(engine, lock),
  );
  if (held) {
    fail(
      "lock_held",
      index,
      `Block "${held.blockId}" is being edited in another session.`,
      held.blockId,
    );
  }
}

// --- 4. Preconditions --------------------------------------------------------

/**
 * Each `expect` key against the current value, where an absent key reads as
 * `null`: an expected `null` matches `null` or absent. Values compare with
 * {@link deepEqual}.
 */
function assertExpected(
  target: Json,
  expect: Json,
  index: number,
  blockId?: string,
): void {
  for (const [key, expected] of Object.entries(expect)) {
    if (expected === undefined) continue;
    const current =
      Object.hasOwn(target, key) && target[key] !== undefined
        ? target[key]
        : null;
    if (!deepEqual(current, expected)) {
      fail(
        "precondition_failed",
        index,
        blockId === undefined
          ? `Setting "${key}" has changed since.`
          : `"${key}" of block "${blockId}" has changed since.`,
        blockId,
      );
    }
  }
}

// --- 6 and 7. Container and anchor --------------------------------------------

/** The list a block goes into, changed in place. */
function container(
  content: TemplateContent,
  parent: BlockParent,
  index: number,
): unknown[] {
  if (parent === null) {
    if (!Array.isArray(content.blocks)) content.blocks = [];
    return content.blocks;
  }
  const found = locate(content, parent.sectionId);
  if (!found) {
    return fail(
      "block_missing",
      index,
      `No section with id "${parent.sectionId}".`,
      parent.sectionId,
    );
  }
  if (!isSection(found.block)) {
    return fail(
      "invalid_operation",
      index,
      `Block "${parent.sectionId}" isn't a section.`,
    );
  }
  const children = found.block.children;
  if (
    !Array.isArray(children) ||
    parent.column < 0 ||
    parent.column >= children.length
  ) {
    return fail(
      "invalid_operation",
      index,
      `Section "${parent.sectionId}" has no column ${parent.column}.`,
    );
  }
  if (!Array.isArray(children[parent.column])) children[parent.column] = [];
  return children[parent.column] as unknown[];
}

function insertionIndex(
  list: readonly unknown[],
  after: string | null,
  index: number,
): number {
  if (after === null) return 0;
  const position = list.findIndex(
    (sibling) => isRecord(sibling) && sibling.id === after,
  );
  if (position === -1) {
    return fail(
      "anchor_missing",
      index,
      `No block "${after}" in the target container.`,
      after,
    );
  }
  return position + 1;
}

// --- 8. The change -----------------------------------------------------------

/** Grow with empty columns, or drop trailing columns that are already empty. */
function resizeColumns(
  section: Json,
  layout: unknown,
  index: number,
  blockId: string,
): void {
  const count = getColumnCount(layout);
  const columns: unknown[] = Array.isArray(section.children)
    ? section.children
    : [];
  for (let column = count; column < columns.length; column++) {
    const removed = columns[column];
    if (Array.isArray(removed) && removed.length > 0) {
      fail(
        "invalid_operation",
        index,
        `Column ${column} of section "${blockId}" still holds blocks, so the layout can't drop it.`,
      );
    }
  }
  const next = columns.slice(0, count);
  while (next.length < count) next.push([]);
  section.children = next;
}

/**
 * Set and unset top-level keys; a set value is a copy.
 *
 * Writes go through assignment and `delete`, never `Object.defineProperty`:
 * the editor applies remote batches in place to its reactive content, and a
 * Vue reactive proxy has no `defineProperty` trap, so a defined key changes
 * the object without re-rendering the block. `__proto__` is the one key that
 * needs `defineProperty`, because assigning it would replace the prototype.
 */
function change(target: Json, set: Json, unset: readonly string[]): void {
  for (const [key, value] of Object.entries(set)) {
    if (key === "__proto__") {
      Object.defineProperty(target, key, {
        value: safeClone(value),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    } else {
      target[key] = safeClone(value);
    }
  }
  for (const key of unset) delete target[key];
}

// --- The operations ----------------------------------------------------------

function applyOne(
  content: TemplateContent,
  raw: Operation,
  index: number,
  engine: EngineContext,
): void {
  const op: unknown = raw;
  if (!isRecord(op) || typeof op.op !== "string") {
    fail(
      "invalid_operation",
      index,
      'Each operation must be an object with an "op".',
    );
  }
  switch (op.op) {
    case "addBlock":
      return addBlock(content, op, index);
    case "moveBlock":
      return moveBlock(content, op, index, engine);
    case "deleteBlock":
      return deleteBlock(content, op, index, engine);
    case "updateBlock":
      return updateBlock(content, op, index, engine);
    case "updateSettings":
      return updateSettings(content, op, index);
    case "setContent":
      return setContent(content, op, index, engine);
    default:
      fail("invalid_operation", index, `Unknown operation "${op.op}".`);
  }
}

function addBlock(content: TemplateContent, op: Json, index: number): void {
  const parent = readParent(op, index);
  const after = readAfter(op, index);
  const block = op.block;
  assertNewBlock(block, index, parent !== null);

  const existing = new Set(idsIn(topLevelOf(content)));
  const seen = new Set<string>();
  for (const id of idsOf(block)) {
    if (existing.has(id) || seen.has(id)) {
      fail(
        "block_exists",
        index,
        `A block with id "${id}" already exists.`,
        id,
      );
    }
    seen.add(id);
  }

  const list = container(content, parent, index);
  list.splice(insertionIndex(list, after, index), 0, safeClone(block));
}

function moveBlock(
  content: TemplateContent,
  op: Json,
  index: number,
  engine: EngineContext,
): void {
  const blockId = readBlockId(op, index);
  const parent = readParent(op, index);
  const after = readAfter(op, index);
  const expect = readExpect(op, index);

  const location = locate(content, blockId);
  if (!location) {
    return fail(
      "block_missing",
      index,
      `No block with id "${blockId}".`,
      blockId,
    );
  }
  assertUnlocked(engine, idsOf(location.block), index);
  if (expect) {
    const previous =
      location.index > 0 ? location.list[location.index - 1] : null;
    const currentAfter = isRecord(previous) ? (previous.id ?? null) : null;
    if (
      !deepEqual(location.parent, expect.parent ?? null) ||
      !deepEqual(currentAfter, expect.after ?? null)
    ) {
      fail(
        "precondition_failed",
        index,
        `Block "${blockId}" has moved since.`,
        blockId,
      );
    }
  }
  if (isSection(location.block) && parent !== null) {
    fail(
      "invalid_operation",
      index,
      "Sections can only be placed at the top level.",
    );
  }
  if (after === blockId) {
    fail("invalid_operation", index, "A block can't be placed after itself.");
  }

  // The target is resolved before the block leaves its place, so a missing or
  // wrong parent is reported as such. It is a live list: when it is also the
  // block's own list, the anchor is looked up without the moved block.
  const target = container(content, parent, index);
  location.list.splice(location.index, 1);
  target.splice(insertionIndex(target, after, index), 0, location.block);
}

function deleteBlock(
  content: TemplateContent,
  op: Json,
  index: number,
  engine: EngineContext,
): void {
  const blockId = readBlockId(op, index);
  const expect = readExpect(op, index);

  const location = locate(content, blockId);
  if (!location) {
    return fail(
      "block_missing",
      index,
      `No block with id "${blockId}".`,
      blockId,
    );
  }
  assertUnlocked(engine, idsOf(location.block), index);
  if (expect && !deepEqual(location.block, expect.block ?? null)) {
    fail(
      "precondition_failed",
      index,
      `Block "${blockId}" has changed since.`,
      blockId,
    );
  }
  location.list.splice(location.index, 1);
}

function updateBlock(
  content: TemplateContent,
  op: Json,
  index: number,
  engine: EngineContext,
): void {
  const blockId = readBlockId(op, index);
  const { set, unset } = readChanges(op, index, IMMUTABLE_KEYS);
  const expect = readExpect(op, index);

  const location = locate(content, blockId);
  if (!location) {
    return fail(
      "block_missing",
      index,
      `No block with id "${blockId}".`,
      blockId,
    );
  }
  const block = location.block;
  const section = isSection(block);
  // Shape, but only knowable once the block is found: a section keeps its layout.
  if (section && unset.includes("columns")) {
    fail(
      "invalid_operation",
      index,
      "A section's columns can't be unset; set another layout instead.",
    );
  }
  assertUnlocked(engine, [blockId], index);
  if (expect) assertExpected(block, expect, index, blockId);
  if (section && Object.hasOwn(set, "columns")) {
    resizeColumns(block, set.columns, index, blockId);
  }
  change(block, set, unset);
}

function updateSettings(
  content: TemplateContent,
  op: Json,
  index: number,
): void {
  const { set, unset } = readChanges(op, index, NO_IMMUTABLE_KEYS);
  const expect = readExpect(op, index);
  if (!isRecord(content.settings)) {
    content.settings = {} as TemplateSettings;
  }
  const settings = content.settings as unknown as Json;
  if (expect) assertExpected(settings, expect, index);
  change(settings, set, unset);
}

function setContent(
  content: TemplateContent,
  op: Json,
  index: number,
  engine: EngineContext,
): void {
  const next = op.content;
  if (
    !isRecord(next) ||
    !Array.isArray(next.blocks) ||
    !isRecord(next.settings)
  ) {
    return fail(
      "invalid_operation",
      index,
      "setContent needs content with a blocks array and a settings object.",
    );
  }
  const held = engine.locks.find((lock) => heldByOthers(engine, lock));
  if (held) {
    fail(
      "locked_by_others",
      index,
      "Other sessions hold locks on this template.",
      held.blockId,
    );
  }
  content.blocks = safeClone(next.blocks) as Block[];
  content.settings = safeClone(next.settings) as unknown as TemplateSettings;
}
