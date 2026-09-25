/**
 * Where each scene note goes. Pure geometry over rects the page measured, so
 * placement runs in unit tests without a DOM.
 *
 * Each note has a few candidate spots near its target, best first. A note
 * takes the first spot that stays inside the viewport and clear of the page's
 * text and icons and of the notes already placed, and is left out when none
 * is clear: a note written over the UI it describes is worse than no note.
 */

export type NoteId =
  | "rail"
  | "palette"
  | "canvas"
  | "properties"
  | "viewport"
  | "preview"
  | "docs"
  | "share"
  | "code";

/**
 * Placement order. Chrome notes go first because their spots are the most
 * contested; the canvas-side notes have room to move.
 */
export const NOTE_IDS: readonly NoteId[] = [
  "code",
  "share",
  "docs",
  "preview",
  "viewport",
  "properties",
  "canvas",
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
  docs?: Box;
  share?: Box;
  /** The preview toggle itself. */
  preview?: Box;
  /** The Desktop / Mobile switch. */
  viewport?: Box;
  /** The email card, and the scrolling canvas that shows it. */
  canvas?: { stage: Box; body: Box };
  /** The properties panel's tab strip, and the panel around it. */
  properties?: { tabs: Box; panel: Box };
  /** The palette column, and its last block item. */
  palette?: { column: Box; last: Box };
  /** The rail, and the bottom edge of its last group. */
  rail?: { rail: Box; foot: number };
}

export interface PlaceOptions {
  viewport: { width: number; height: number };
  /** Rects of the page's own text and icons, which a note must not cover. */
  obstacles: readonly Box[];
  /** Width and height of a note's text in the note font. */
  measure: (id: NoteId) => { width: number; height: number };
}

interface Spot {
  box: Box;
  from: Point;
  to: Point;
  /** How far the arrow bows from a straight line; the sign picks the side. */
  bend: number;
}

type Size = { width: number; height: number };

const EDGE = 8;
const CLEARANCE = 4;
// Wide enough that two notes side by side never read as one phrase.
const NOTE_GAP = 26;

function box(left: number, top: number, size: Size): Box {
  return { left, top, width: size.width, height: size.height };
}

function centerX(b: Box): number {
  return b.left + b.width / 2;
}

function centerY(b: Box): number {
  return b.top + b.height / 2;
}

const SPOTS: Record<NoteId, (targets: NoteTargets, size: Size) => Spot[]> = {
  // Code, Share and Docs sit a few px apart, so their notes fan out under
  // and beside them instead of stacking on one spot.
  code(targets, size) {
    const t = targets.code;
    if (!t) return [];
    const bottom = t.top + t.height;
    const left = box(t.left - 4, bottom + 34, size);
    const right = box(t.left + t.width - size.width, bottom + 34, size);
    return [
      {
        box: left,
        from: { x: left.left + 28, y: left.top - 4 },
        to: { x: centerX(t) - 6, y: bottom + 6 },
        bend: -8,
      },
      {
        box: right,
        from: { x: right.left + right.width * 0.7, y: right.top - 4 },
        to: { x: centerX(t) + 4, y: bottom + 6 },
        bend: 10,
      },
    ];
  },
  share(targets, size) {
    const t = targets.share;
    if (!t) return [];
    const bottom = t.top + t.height;
    return [
      box(t.left + t.width + 6 - size.width, bottom + 34, size),
      box(centerX(t) - size.width / 2, bottom + 34, size),
      box(centerX(t) - size.width / 2, bottom + 70, size),
    ].map((b) => ({
      box: b,
      from: {
        x: Math.min(b.left + b.width - 18, centerX(t) + 30),
        y: b.top - 4,
      },
      to: { x: centerX(t), y: bottom + 6 },
      bend: 8,
    }));
  },
  docs(targets, size) {
    const t = targets.docs;
    if (!t) return [];
    const bottom = t.top + t.height;
    const inHeader = box(
      t.left - 30 - size.width,
      centerY(t) - size.height / 2,
      size,
    );
    const below = box(t.left + 10 - size.width, bottom + 34, size);
    const under = box(centerX(t) - size.width / 2, bottom + 34, size);
    return [
      {
        box: inHeader,
        from: { x: inHeader.left + inHeader.width + 4, y: centerY(t) + 2 },
        to: { x: t.left - 4, y: centerY(t) },
        bend: -6,
      },
      {
        box: below,
        from: { x: below.left + below.width - 10, y: below.top - 4 },
        to: { x: t.left + 10, y: bottom + 6 },
        bend: 10,
      },
      {
        box: under,
        from: { x: centerX(under) + 6, y: under.top - 4 },
        to: { x: centerX(t), y: bottom + 6 },
        bend: -10,
      },
    ];
  },
  preview(targets, size) {
    const t = targets.preview;
    if (!t) return [];
    const bottom = t.top + t.height;
    const above = box(centerX(t) + 12 - size.width, t.top - 66, size);
    const right = box(
      t.left + t.width + 48,
      centerY(t) - size.height / 2,
      size,
    );
    const below = box(centerX(t) - size.width / 2, bottom + 16, size);
    return [
      {
        box: above,
        from: {
          x: above.left + above.width - 6,
          y: above.top + above.height + 2,
        },
        to: { x: centerX(t) + 2, y: t.top - 4 },
        bend: -12,
      },
      {
        box: right,
        from: { x: right.left - 6, y: centerY(t) + 2 },
        to: { x: t.left + t.width + 6, y: centerY(t) },
        bend: -12,
      },
      {
        box: below,
        from: { x: centerX(below) - 4, y: below.top - 2 },
        to: { x: centerX(t), y: bottom + 4 },
        bend: 6,
      },
    ];
  },
  viewport(targets, size) {
    const t = targets.viewport;
    if (!t) return [];
    const bottom = t.top + t.height;
    const left = box(
      t.left - 40 - size.width,
      centerY(t) - size.height / 2,
      size,
    );
    const above = box(t.left + 30, t.top - 66, size);
    const below = box(centerX(t) - size.width / 2, bottom + 16, size);
    return [
      {
        box: left,
        from: { x: left.left + left.width + 4, y: centerY(t) + 2 },
        to: { x: t.left - 6, y: centerY(t) },
        bend: -8,
      },
      {
        box: above,
        from: { x: above.left + 12, y: above.top + above.height + 2 },
        to: { x: t.left + 40, y: t.top - 4 },
        bend: 10,
      },
      {
        box: below,
        from: { x: centerX(below) - 4, y: below.top - 2 },
        to: { x: centerX(t), y: bottom + 4 },
        bend: 6,
      },
    ];
  },
  canvas(targets, size) {
    const c = targets.canvas;
    if (!c) return [];
    const { stage, body } = c;
    // Only below a card short enough to leave room in the visible canvas;
    // over an email the note would cover the content it names.
    const visibleLeft = Math.max(stage.left, body.left);
    const visibleRight = Math.min(
      stage.left + stage.width,
      body.left + body.width,
    );
    const middle = (visibleLeft + visibleRight) / 2;
    const bottom = stage.top + stage.height;
    const b = box(middle + 30, bottom + 34, size);
    if (b.top + b.height > body.top + body.height - EDGE) return [];
    return [
      {
        box: b,
        from: { x: b.left + 6, y: b.top - 4 },
        to: { x: middle + 12, y: bottom + 6 },
        bend: -10,
      },
    ];
  },
  properties(targets, size) {
    const p = targets.properties;
    if (!p) return [];
    const { tabs, panel } = p;
    // The arrow runs up the panel's left margin, clear of centred content.
    const x = panel.left + 22;
    return [0.3, 0.42, 0.56].map((depth) => {
      const b = box(panel.left + 14, panel.top + panel.height * depth, size);
      return {
        box: b,
        from: { x, y: b.top - 4 },
        to: { x, y: tabs.top + tabs.height + 8 },
        bend: -6,
      };
    });
  },
  palette(targets, size) {
    const p = targets.palette;
    if (!p) return [];
    const { column, last } = p;
    const below = box(
      column.left + column.width + 26,
      last.top + last.height + 30,
      size,
    );
    const beside = box(
      column.left + column.width + 34,
      column.top + column.height * 0.38,
      size,
    );
    return [
      {
        box: below,
        from: { x: below.left + 6, y: below.top - 2 },
        to: { x: last.left + last.width + 6, y: centerY(last) },
        bend: -14,
      },
      {
        box: beside,
        from: { x: beside.left + 10, y: beside.top - 4 },
        to: { x: column.left + column.width + 6, y: beside.top - 46 },
        bend: 14,
      },
    ];
  },
  rail(targets, size) {
    const r = targets.rail;
    if (!r) return [];
    const b = box(r.rail.left + 30, r.foot + 78, size);
    if (b.top + b.height > r.rail.top + r.rail.height - EDGE) return [];
    return [
      {
        box: b,
        from: { x: b.left + 36, y: b.top - 6 },
        to: { x: b.left + 30, y: r.foot + 10 },
        bend: -16,
      },
    ];
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

/**
 * An arrow may not cut through the page's text either. It is sampled short
 * of its tip, which stops beside its target and may graze it.
 */
function arrowClear(arrow: Arrow, obstacles: readonly Box[]): boolean {
  for (let step = 1; step <= 9; step += 1) {
    const point = pointOn(arrow, step / 11);
    const hit = obstacles.some(
      (o) =>
        point.x > o.left - 2 &&
        point.x < o.left + o.width + 2 &&
        point.y > o.top - 2 &&
        point.y < o.top + o.height + 2,
    );
    if (hit) return false;
  }
  return true;
}

export function placeNotes(
  targets: NoteTargets,
  options: PlaceOptions,
): PlacedNote[] {
  const placed: PlacedNote[] = [];
  for (const id of NOTE_IDS) {
    const size = options.measure(id);
    for (const spot of SPOTS[id](targets, size)) {
      const arrow = arrowBetween(spot.from, spot.to, spot.bend);
      const clear =
        insideViewport(spot.box, options.viewport) &&
        !options.obstacles.some((o) =>
          intersects(inflate(spot.box, CLEARANCE), o),
        ) &&
        !placed.some((note) =>
          intersects(inflate(spot.box, NOTE_GAP), note.box),
        ) &&
        arrowClear(arrow, [
          ...options.obstacles,
          ...placed.map((note) => note.box),
        ]);
      if (!clear) continue;
      placed.push({ id, box: spot.box, arrow });
      break;
    }
  }
  return placed;
}
