/**
 * Where each scene note goes. Pure geometry over rects the page measured, so
 * placement runs in unit tests without a DOM.
 *
 * Each note has one spot, fixed beside its target, and stays there even when
 * that covers part of the editor: the notes go away on the first interaction,
 * so covering UI for a moment costs less than a note moved to wherever is
 * empty, with an arrow too short to follow. A spot past the viewport's edge is
 * pulled back inside it. A note is left out only when it would land on
 * another note, the close pill or another note's arrow, or when pulling it
 * inside turns its own arrow back through it.
 */

export type NoteId =
  "rail" | "palette" | "properties" | "issues" | "preview" | "share" | "code";

/**
 * Placement order, which decides the note that stays when two collide. That
 * happens only in narrow windows, where the preview toggle sits above the
 * properties panel, so the panel's notes go first.
 */
export const NOTE_IDS: readonly NoteId[] = [
  "code",
  "share",
  "properties",
  "issues",
  "preview",
  "palette",
  "rail",
];

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Arrow {
  from: Point;
  control: Point;
  to: Point;
  head: readonly [Point, Point];
}

export interface PlacedNote {
  id: NoteId;
  box: Box;
  arrow: Arrow;
}

/** What the page measured for each note: where it points, and extra context. */
export interface NoteTargets {
  code?: Box;
  share?: Box;
  /** The preview toggle itself. */
  preview?: Box;
  /** The linter's tab in the properties panel, and the panel around it. */
  issues?: { tab: Box; panel: Box };
  /** The properties panel's tab strip, and the panel around it. */
  properties?: { tabs: Box; panel: Box };
  /** The palette column. */
  palette?: Box;
  /** The rail, and the bottom edge of its last group. */
  rail?: { rail: Box; foot: number };
}

export interface PlaceOptions {
  viewport: { width: number; height: number };
  /** Areas no note or arrow may cover, such as the close pill. */
  reserved: readonly Box[];
  /** Width and height of a note's text in the note font. */
  measure: (id: NoteId) => { width: number; height: number };
}

interface Spot {
  box: Box;
  /** Where the arrow leaves the note, wherever the note ends up. */
  from: (box: Box) => Point;
  to: Point;
  /** How far the arrow bows from a straight line; the sign picks the side. */
  bend: number;
}

type Size = { width: number; height: number };

const EDGE = 8;
// Wide enough that two notes side by side never read as one phrase.
const NOTE_GAP = 26;

function box(left: number, top: number, size: Size): Box {
  return { left, top, width: size.width, height: size.height };
}

function centerX(b: Box): number {
  return b.left + b.width / 2;
}

const SPOTS: Record<NoteId, (targets: NoteTargets, size: Size) => Spot | null> =
  {
    // Code and Share sit a few px apart, so Code's note starts under its left
    // edge and Share's hangs left of its button.
    code(targets, size) {
      const t = targets.code;
      if (!t) return null;
      const bottom = t.top + t.height;
      return {
        // Never further right than the header's last button, so a Code at
        // the edge still leaves Share room.
        box: box(
          Math.min(t.left - 4, t.left + t.width + 36 - size.width),
          bottom + 34,
          size,
        ),
        from: (b) => ({ x: b.left + 28, y: b.top - 4 }),
        to: { x: centerX(t) - 6, y: bottom + 6 },
        bend: -8,
      };
    },
    share(targets, size) {
      const t = targets.share;
      if (!t) return null;
      const bottom = t.top + t.height;
      return {
        box: box(t.left + 10 - size.width, bottom + 34, size),
        from: (b) => ({
          x: Math.min(b.left + b.width - 18, centerX(t) + 30),
          y: b.top - 4,
        }),
        to: { x: centerX(t), y: bottom + 6 },
        bend: 8,
      };
    },
    // Down and to the left, over the canvas: straight below it the note would
    // meet the properties panel's arrow, and right beside it the Share note.
    preview(targets, size) {
      const t = targets.preview;
      if (!t) return null;
      const bottom = t.top + t.height;
      return {
        box: box(centerX(t) - 14 - size.width, bottom + 60, size),
        from: (b) => ({ x: b.left + b.width - 10, y: b.top - 4 }),
        to: { x: centerX(t) - 2, y: bottom + 6 },
        bend: 12,
      };
    },
    issues(targets, size) {
      const p = targets.issues;
      if (!p) return null;
      const { tab, panel } = p;
      const bottom = tab.top + tab.height;
      // Hung under the tab, and kept inside the panel when the tab sits at
      // its right edge.
      const left = Math.min(
        tab.left,
        panel.left + panel.width - 10 - size.width,
      );
      return {
        box: box(left, bottom + 28, size),
        from: (b) => ({ x: b.left + 24, y: b.top - 4 }),
        to: { x: centerX(tab), y: bottom + 6 },
        bend: -10,
      };
    },
    properties(targets, size) {
      const p = targets.properties;
      if (!p) return null;
      const { tabs, panel } = p;
      const below = tabs.top + tabs.height;
      // The arrow runs up the panel's left margin to its tabs, and the note
      // sits under the panel's empty state.
      const x = panel.left + 22;
      return {
        box: box(panel.left + 14, below + 180, size),
        from: (b) => ({ x: b.left + 8, y: b.top - 4 }),
        to: { x, y: below + 8 },
        bend: -6,
      };
    },
    // On the canvas beside the palette, pointing back at it.
    palette(targets, size) {
      const column = targets.palette;
      if (!column) return null;
      const edge = column.left + column.width;
      return {
        box: box(edge + 34, column.top + 196, size),
        from: (b) => ({ x: b.left + 10, y: b.top - 4 }),
        to: { x: edge + 6, y: column.top + 150 },
        bend: 14,
      };
    },
    rail(targets, size) {
      const r = targets.rail;
      if (!r) return null;
      return {
        box: box(r.rail.left + 30, r.foot + 78, size),
        from: (b) => ({ x: b.left + 36, y: b.top - 6 }),
        to: { x: r.rail.left + 60, y: r.foot + 10 },
        bend: -16,
      };
    },
  };

function inflate(b: Box, by: number): Box {
  return {
    left: b.left - by,
    top: b.top - by,
    width: b.width + by * 2,
    height: b.height + by * 2,
  };
}

export function intersects(a: Box, b: Box): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

function insideViewport(b: Box, viewport: PlaceOptions["viewport"]): boolean {
  return (
    b.left >= EDGE &&
    b.top >= EDGE &&
    b.left + b.width <= viewport.width - EDGE &&
    b.top + b.height <= viewport.height - EDGE
  );
}

/** Pulls a box back inside the viewport's margin. */
function pullInside(b: Box, viewport: PlaceOptions["viewport"]): Box {
  return {
    ...b,
    left: Math.max(EDGE, Math.min(b.left, viewport.width - EDGE - b.width)),
    top: Math.max(EDGE, Math.min(b.top, viewport.height - EDGE - b.height)),
  };
}

/** A quadratic arrow that bows `bend` px off the straight line, with an open head. */
export function arrowBetween(from: Point, to: Point, bend: number): Arrow {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const control = {
    x: (from.x + to.x) / 2 - (dy / length) * bend,
    y: (from.y + to.y) / 2 + (dx / length) * bend,
  };
  const angle = Math.atan2(to.y - control.y, to.x - control.x);
  const barb = (spread: number): Point => ({
    x: to.x - 10 * Math.cos(angle - spread),
    y: to.y - 10 * Math.sin(angle - spread),
  });
  return { from, control, to, head: [barb(0.55), barb(-0.5)] };
}

function pointOn(arrow: Arrow, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * arrow.from.x + 2 * u * t * arrow.control.x + t * t * arrow.to.x,
    y: u * u * arrow.from.y + 2 * u * t * arrow.control.y + t * t * arrow.to.y,
  };
}

/** Whether an arrow runs through any of the boxes, its tip included. */
function crosses(arrow: Arrow, boxes: readonly Box[]): boolean {
  for (let step = 1; step <= 11; step += 1) {
    const point = pointOn(arrow, step / 11);
    const hit = boxes.some(
      (b) =>
        point.x > b.left - 2 &&
        point.x < b.left + b.width + 2 &&
        point.y > b.top - 2 &&
        point.y < b.top + b.height + 2,
    );
    if (hit) return true;
  }
  return false;
}

export function placeNotes(
  targets: NoteTargets,
  options: PlaceOptions,
): PlacedNote[] {
  const placed: PlacedNote[] = [];
  for (const id of NOTE_IDS) {
    const spot = SPOTS[id](targets, options.measure(id));
    if (!spot) continue;
    const box = pullInside(spot.box, options.viewport);
    const arrow = arrowBetween(spot.from(box), spot.to, spot.bend);
    const taken = [...options.reserved, ...placed.map((note) => note.box)];
    const clear =
      insideViewport(box, options.viewport) &&
      !crosses(arrow, [box]) &&
      !taken.some((b) => intersects(inflate(box, NOTE_GAP), b)) &&
      !crosses(arrow, taken) &&
      !placed.some((note) => crosses(note.arrow, [box]));
    if (clear) placed.push({ id, box, arrow });
  }
  return placed;
}
