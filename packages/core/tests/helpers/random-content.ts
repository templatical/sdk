import type { Block, TemplateContent } from "@templatical/types";
import { getColumnCount, safeClone } from "@templatical/types";

// Seeded random templates and edits for the diff and inverse round trips. A
// loose block shape on purpose: the engine and the diff must hold for any
// keys, not only the ones the block types declare.
type AnyBlock = Block & Record<string, unknown>;

/** mulberry32: a small seeded PRNG, so a failing seed replays exactly. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Generator {
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  id(): string;
}

export function createGenerator(seed: number): Generator {
  const random = createRandom(seed);
  let counter = 0;
  return {
    int: (min, max) => min + Math.floor(random() * (max - min + 1)),
    pick: (items) => items[Math.floor(random() * items.length)],
    chance: (probability) => random() < probability,
    id: () => `b${seed}-${counter++}`,
  };
}

const LAYOUTS = ["1", "2", "3", "2-1", "1-2"] as const;
const LEAF_TYPES = [
  "title",
  "paragraph",
  "button",
  "image",
  "divider",
] as const;
const COLORS = ["#ffffff", "#000000", "#1d4ed8", "#ef4444"];

function randomLeaf(gen: Generator): Block {
  const block = {
    id: gen.id(),
    type: gen.pick(LEAF_TYPES),
    styles: { padding: { top: gen.int(0, 20), right: 0, bottom: 0, left: 0 } },
  } as AnyBlock;
  if (gen.chance(0.7)) block.content = `<p>${gen.id()}</p>`;
  if (gen.chance(0.3))
    block.visibility = { desktop: true, mobile: gen.chance(0.5) };
  if (gen.chance(0.3)) block.color = gen.pick(COLORS);
  return block;
}

function randomSection(gen: Generator): Block {
  const columns = gen.pick(LAYOUTS);
  return {
    id: gen.id(),
    type: "section",
    columns,
    styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: Array.from({ length: getColumnCount(columns) }, () =>
      Array.from({ length: gen.int(0, 3) }, () => randomLeaf(gen)),
    ),
  } as Block;
}

export function randomContent(gen: Generator): TemplateContent {
  return {
    blocks: Array.from({ length: gen.int(0, 6) }, () =>
      gen.chance(0.4) ? randomSection(gen) : randomLeaf(gen),
    ),
    settings: {
      width: gen.pick([600, 640]),
      backgroundColor: gen.pick(COLORS),
      ...(gen.chance(0.5) ? { linkColor: gen.pick(COLORS) } : {}),
    } as TemplateContent["settings"],
  };
}

interface Slot {
  list: Block[];
}

function containers(content: TemplateContent): Slot[] {
  const slots: Slot[] = [{ list: content.blocks }];
  for (const block of content.blocks) {
    if (block.type === "section") {
      for (const column of block.children) slots.push({ list: column });
    }
  }
  return slots;
}

function leaves(content: TemplateContent): { list: Block[]; index: number }[] {
  const found: { list: Block[]; index: number }[] = [];
  for (const slot of containers(content)) {
    slot.list.forEach((block, index) => {
      if (block.type !== "section") found.push({ list: slot.list, index });
    });
  }
  return found;
}

/** A well-formed `after`: random edits of every kind the editor makes. */
export function randomEdit(
  gen: Generator,
  before: TemplateContent,
): TemplateContent {
  const after = safeClone(before);
  const steps = gen.int(1, 8);
  for (let step = 0; step < steps; step++) {
    const kind = gen.int(0, 10);
    const slots = containers(after);
    if (kind === 0) {
      // Add a leaf anywhere.
      const slot = gen.pick(slots);
      slot.list.splice(gen.int(0, slot.list.length), 0, randomLeaf(gen));
    } else if (kind === 1) {
      // Add a section at the top level.
      after.blocks.splice(
        gen.int(0, after.blocks.length),
        0,
        randomSection(gen),
      );
    } else if (kind === 2) {
      // Delete a leaf.
      const all = leaves(after);
      if (all.length === 0) continue;
      const { list, index } = gen.pick(all);
      list.splice(index, 1);
    } else if (kind === 3) {
      // Delete a section, sometimes keeping some of its blocks elsewhere.
      const sections = after.blocks.filter((block) => block.type === "section");
      if (sections.length === 0) continue;
      const section = gen.pick(sections);
      after.blocks.splice(after.blocks.indexOf(section), 1);
      for (const column of (section as AnyBlock).children as Block[][]) {
        for (const child of column) {
          if (gen.chance(0.5)) {
            const slot = gen.pick(containers(after));
            slot.list.splice(gen.int(0, slot.list.length), 0, child);
          }
        }
      }
    } else if (kind === 4) {
      // Move a leaf to any container.
      const all = leaves(after);
      if (all.length === 0) continue;
      const { list, index } = gen.pick(all);
      const [block] = list.splice(index, 1);
      const slot = gen.pick(containers(after));
      slot.list.splice(gen.int(0, slot.list.length), 0, block);
    } else if (kind === 5) {
      // Reorder the top level.
      if (after.blocks.length < 2) continue;
      const [block] = after.blocks.splice(
        gen.int(0, after.blocks.length - 1),
        1,
      );
      after.blocks.splice(gen.int(0, after.blocks.length), 0, block);
    } else if (kind === 6) {
      // Change a layout the way the section toolbar does.
      const sections = after.blocks.filter((block) => block.type === "section");
      if (sections.length === 0) continue;
      const section = gen.pick(sections) as AnyBlock;
      const columns = gen.pick(LAYOUTS);
      const target = getColumnCount(columns);
      const current = section.children as Block[][];
      if (current.length < target) {
        section.children = [
          ...current,
          ...Array.from({ length: target - current.length }, () => []),
        ];
      } else if (current.length > target) {
        const kept = current.slice(0, target);
        const overflow = current.slice(target).flat();
        section.children = [
          ...kept.slice(0, target - 1),
          [...kept[target - 1], ...overflow],
        ];
      }
      section.columns = columns;
    } else if (kind === 7) {
      // Set, change and remove keys on any block.
      const all = [
        ...leaves(after).map(({ list, index }) => list[index]),
        ...after.blocks,
      ];
      if (all.length === 0) continue;
      const block = gen.pick(all) as AnyBlock;
      if (gen.chance(0.5)) block.content = `<p>${gen.id()}</p>`;
      if (gen.chance(0.3)) delete block.visibility;
      if (gen.chance(0.3)) block.color = gen.pick(COLORS);
      if (gen.chance(0.2)) delete block.color;
      if (gen.chance(0.3))
        block.styles = {
          padding: { top: gen.int(0, 9), right: 1, bottom: 2, left: 3 },
        };
      if (gen.chance(0.1)) block.flag = undefined;
    } else if (kind === 8) {
      // Settings.
      if (gen.chance(0.5)) after.settings.backgroundColor = gen.pick(COLORS);
      if (gen.chance(0.3)) delete after.settings.linkColor;
      if (gen.chance(0.3)) after.settings.preheaderText = `pre ${gen.id()}`;
    } else if (kind === 9) {
      // Change a leaf's type in place (same id) — rare in the editor.
      const all = leaves(after);
      if (all.length === 0) continue;
      const { list, index } = gen.pick(all);
      list[index] = {
        ...list[index],
        type: list[index].type === "title" ? "paragraph" : "title",
      } as Block;
    } else {
      // Move a block out of a section into a new section at the top.
      const all = leaves(after).filter(({ list }) => list !== after.blocks);
      if (all.length === 0) continue;
      const { list, index } = gen.pick(all);
      const [block] = list.splice(index, 1);
      const section = randomSection(gen) as AnyBlock;
      (section.children as Block[][])[0].push(block);
      after.blocks.splice(gen.int(0, after.blocks.length), 0, section);
    }
  }
  return after;
}
