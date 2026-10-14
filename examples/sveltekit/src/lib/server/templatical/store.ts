// The one file to replace when this app moves to a real database. Every route
// that loads or saves templates or saved blocks goes through these functions,
// so swapping their bodies for SQL or an ORM changes nothing else.
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isRenderableTemplateContent,
  type SavedBlock,
  type SavedBlockInput,
  type SavedBlockPatch,
  type SavedBlocksListParams,
  type Template,
  type TemplateContent,
  type TemplatePatch,
} from "@templatical/types";

export type TemplateInput = { name?: string; content: TemplateContent };

const DATA_DIR = process.env.TEMPLATICAL_DATA_DIR ?? "./data";
const TEMPLATES_DIR = join(DATA_DIR, "templates");
const SAVED_BLOCKS_DIR = join(DATA_DIR, "saved-blocks");

// Ids are UUIDs. Anything else is rejected before it can reach a file path.
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function readRecord<T>(dir: string, id: string): Promise<T | null> {
  if (!ID.test(id)) return null;
  try {
    return JSON.parse(await readFile(join(dir, `${id}.json`), "utf8")) as T;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

async function writeRecord(dir: string, id: string, record: unknown): Promise<void> {
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${id}.json`);
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(record, null, 2));
  // rename is atomic: a reader sees the old record or the new one, never half of one.
  await rename(temp, file);
}

/** A message to send back as 400, or null when the body is acceptable. */
export function templateInputError(body: unknown, partial: boolean): string | null {
  if (typeof body !== "object" || body === null) return "Expected a JSON object.";
  const { name, content } = body as Record<string, unknown>;
  if (name !== undefined && typeof name !== "string") return "`name` must be a string.";
  if (content === undefined ? !partial : !isRenderableTemplateContent(content)) {
    return "`content` must be a template with a `blocks` array.";
  }
  return null;
}

/** A message to send back as 400, or null when the body is acceptable. */
export function savedBlockInputError(body: unknown, partial: boolean): string | null {
  if (typeof body !== "object" || body === null) return "Expected a JSON object.";
  const { name, content, category } = body as Record<string, unknown>;
  if (name === undefined ? !partial : typeof name !== "string" || name.trim() === "") {
    return "`name` must be a non-empty string.";
  }
  if (content === undefined ? !partial : !Array.isArray(content)) {
    return "`content` must be an array of blocks.";
  }
  if (category !== undefined && typeof category !== "string") return "`category` must be a string.";
  return null;
}

export async function createTemplate(input: TemplateInput): Promise<Template> {
  const now = new Date().toISOString();
  const template: Template = {
    id: randomUUID(),
    name: input.name ?? "Untitled",
    content: input.content,
    createdAt: now,
    updatedAt: now,
  };
  await writeRecord(TEMPLATES_DIR, template.id, template);
  return template;
}

export function getTemplate(id: string): Promise<Template | null> {
  return readRecord<Template>(TEMPLATES_DIR, id);
}

export async function updateTemplate(id: string, patch: TemplatePatch): Promise<Template | null> {
  const current = await getTemplate(id);
  if (!current) return null;
  const template: Template = {
    ...current,
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.content !== undefined && { content: patch.content }),
    updatedAt: new Date().toISOString(),
  };
  await writeRecord(TEMPLATES_DIR, id, template);
  return template;
}

export async function listSavedBlocks(params: SavedBlocksListParams = {}): Promise<SavedBlock[]> {
  let files: string[];
  try {
    files = await readdir(SAVED_BLOCKS_DIR);
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const records = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map((file) => readRecord<SavedBlock>(SAVED_BLOCKS_DIR, file.slice(0, -".json".length))),
  );
  const search = params.search?.trim().toLowerCase();
  return records
    .filter((block): block is SavedBlock => block !== null)
    .filter((block) => !params.category || block.category === params.category)
    .filter((block) => !search || block.name.toLowerCase().includes(search))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function createSavedBlock(input: SavedBlockInput): Promise<SavedBlock> {
  const now = new Date().toISOString();
  const block: SavedBlock = {
    id: randomUUID(),
    name: input.name.trim(),
    content: input.content,
    ...(input.category && { category: input.category }),
    createdAt: now,
    updatedAt: now,
  };
  await writeRecord(SAVED_BLOCKS_DIR, block.id, block);
  return block;
}

export async function updateSavedBlock(id: string, patch: SavedBlockPatch): Promise<SavedBlock | null> {
  const current = await readRecord<SavedBlock>(SAVED_BLOCKS_DIR, id);
  if (!current) return null;
  const block: SavedBlock = {
    ...current,
    ...(patch.name !== undefined && { name: patch.name.trim() }),
    ...(patch.content !== undefined && { content: patch.content }),
    ...(patch.category !== undefined && { category: patch.category }),
    updatedAt: new Date().toISOString(),
  };
  await writeRecord(SAVED_BLOCKS_DIR, id, block);
  return block;
}

export async function deleteSavedBlock(id: string): Promise<boolean> {
  if (!ID.test(id)) return false;
  try {
    await rm(join(SAVED_BLOCKS_DIR, `${id}.json`));
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}
