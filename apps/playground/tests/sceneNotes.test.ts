import { describe, expect, it } from "vitest";
import de from "../src/i18n/de";
import en from "../src/i18n/en";
import {
  NOTE_IDS,
  arrowBetween,
  placeNotes,
  type Box,
  type NoteTargets,
  type PlaceOptions,
  type Point,
} from "../src/host/sceneNotes";

const SIZE = { width: 120, height: 31 };
const VIEWPORT = { width: 1440, height: 900 };
const CODE: Box = { left: 1308, top: 12, width: 80, height: 32 };

function box(left: number, top: number, right: number, bottom: number): Box {
  return { left, top, width: right - left, height: bottom - top };
}

/** The Minimum scene's parts at 1440x900, as the page measures them. */
const WIDE: NoteTargets = {
  code: CODE,
  share: box(1232, 12, 1264, 44),
  preview: box(971, 83, 1005, 117),
  properties: {
    panel: box(1104, 128, 1424, 884),
    tabs: box(1105, 128, 1424, 173),
  },
  issues: { panel: box(1104, 128, 1424, 884), tab: box(1354, 134, 1418, 166) },
  palette: box(240, 128, 288, 884),
  rail: { rail: box(0, 0, 224, 900), foot: 236 },
};

/** The same parts at 1024x768, where the preview toggle sits over the panel. */
const NARROW: NoteTargets = {
  preview: box(759, 83, 793, 117),
  properties: {
    panel: box(688, 128, 1008, 752),
    tabs: box(689, 128, 1008, 173),
  },
};

function options(overrides: Partial<PlaceOptions> = {}): PlaceOptions {
  return {
    viewport: VIEWPORT,
    reserved: [],
    measure: () => SIZE,
    ...overrides,
  };
}

function length(arrow: { from: Point; to: Point }): number {
  return Math.hypot(arrow.to.x - arrow.from.x, arrow.to.y - arrow.from.y);
}

describe("placeNotes", () => {
  it("writes every note at its one spot beside its target", () => {
    const placed = placeNotes(WIDE, options());
    expect(placed.map((note) => note.id)).toEqual([...NOTE_IDS]);
    const code = placed.find((note) => note.id === "code")!;
    expect(code.box).toEqual({ left: 1304, top: 78, ...SIZE });
    expect(code.arrow.to).toEqual({ x: 1342, y: 50 });
  });

  it("writes the preview note down and to the left, with an arrow to follow", () => {
    const [note] = placeNotes({ preview: WIDE.preview }, options());
    // Over the canvas, clear of the header's gutter: 60px under the toggle,
    // ending 14px left of its centre.
    expect(note.box).toEqual({ left: 854, top: 177, ...SIZE });
    expect(note.arrow.to).toEqual({ x: 986, y: 123 });
    expect(length(note.arrow)).toBeGreaterThan(48);
  });

  it("runs the properties arrow up the panel's margin to its tabs", () => {
    const [note] = placeNotes({ properties: WIDE.properties }, options());
    expect(note.box).toEqual({ left: 1118, top: 353, ...SIZE });
    expect(note.arrow.from).toEqual({ x: 1126, y: 349 });
    expect(note.arrow.to).toEqual({ x: 1126, y: 181 });
  });

  it("points the palette note back at the column from the canvas", () => {
    const [note] = placeNotes({ palette: WIDE.palette }, options());
    expect(note.box).toEqual({ left: 322, top: 324, ...SIZE });
    expect(note.arrow.to).toEqual({ x: 294, y: 278 });
    expect(note.arrow.to.x).toBeLessThan(note.arrow.from.x);
  });

  it("hangs the issues note under its tab, kept inside the panel", () => {
    const panel = box(1104, 128, 1424, 884);
    const tab = box(1200, 134, 1240, 166);
    const [under] = placeNotes({ issues: { tab, panel } }, options());
    expect(under.box).toEqual({ left: 1200, top: 194, ...SIZE });
    // A tab at the panel's right edge pulls the note back inside.
    const edge = { ...tab, left: 1380 };
    const [inside] = placeNotes({ issues: { tab: edge, panel } }, options());
    expect(inside.box.left).toBe(1424 - 10 - SIZE.width);
  });

  it("pulls a spot that would leave the viewport back inside it", () => {
    const near = box(1400, 12, 1432, 44);
    const [note] = placeNotes({ code: near }, options());
    expect(note.box.left + note.box.width).toBe(VIEWPORT.width - 8);
    // The arrow leaves from where the note ended up, and still ends at Code.
    expect(note.arrow.from).toEqual({ x: note.box.left + 28, y: 74 });
    expect(note.arrow.to).toEqual({ x: 1410, y: 50 });
  });

  it("keeps a pulled-in note only while its arrow still points away from it", () => {
    const rail = { rail: box(0, 0, 224, 720), foot: 635 };
    const [kept] = placeNotes(
      { rail },
      options({ viewport: { width: 1280, height: 720 } }),
    );
    expect(kept.box.top).toBe(720 - 8 - SIZE.height);
    expect(kept.arrow.to.y).toBeLessThan(kept.box.top);
    // With no room under the list the arrow would run back down through
    // the note, so it is left out.
    const short = { rail: { ...rail, rail: box(0, 0, 224, 640) } };
    expect(
      placeNotes(short, options({ viewport: { width: 1024, height: 640 } })),
    ).toEqual([]);
  });

  it("leaves a note out rather than stack it on another", () => {
    // Share right against Code: its one spot would crowd Code's note, and
    // no other spot is tried.
    const targets: NoteTargets = { code: CODE, share: box(1270, 12, 1302, 44) };
    const placed = placeNotes(targets, options());
    expect(placed.map((note) => note.id)).toEqual(["code"]);
    expect(placed[0].box.left).toBe(1304);
  });

  it("keeps the close pill clear", () => {
    const pill: Box = { left: 300, top: 300, width: 200, height: 70 };
    const placed = placeNotes(
      { palette: WIDE.palette, rail: WIDE.rail },
      options({ reserved: [pill] }),
    );
    expect(placed.map((note) => note.id)).toEqual(["rail"]);
  });

  it("never writes a note over another note's arrow", () => {
    // At 1024 the preview note's spot lands on the properties arrow, and the
    // panel's note goes first.
    const narrow = placeNotes(
      NARROW,
      options({ viewport: { width: 1024, height: 768 } }),
    );
    expect(narrow.map((note) => note.id)).toEqual(["properties"]);
    const wide = placeNotes(
      { preview: WIDE.preview, properties: WIDE.properties },
      options(),
    );
    expect(wide.map((note) => note.id)).toEqual(["properties", "preview"]);
  });

  it("leaves out a note whose target was not measured", () => {
    expect(placeNotes({}, options())).toEqual([]);
  });

  it("puts the panel's notes before the preview note", () => {
    expect(NOTE_IDS.indexOf("properties")).toBeLessThan(
      NOTE_IDS.indexOf("preview"),
    );
    expect(NOTE_IDS.indexOf("issues")).toBeLessThan(
      NOTE_IDS.indexOf("preview"),
    );
  });
});

describe("arrowBetween", () => {
  it("bows perpendicular to the line by the bend", () => {
    const arrow = arrowBetween({ x: 0, y: 0 }, { x: 100, y: 0 }, 20);
    expect(arrow.control).toEqual({ x: 50, y: 20 });
  });

  it("draws the head back along the curve's last direction", () => {
    const arrow = arrowBetween({ x: 0, y: 100 }, { x: 0, y: 0 }, 0);
    // Heading straight up, both barbs trail below the tip, one either side.
    for (const barb of arrow.head) expect(barb.y).toBeGreaterThan(0);
    expect(Math.sign(arrow.head[0].x)).toBe(-Math.sign(arrow.head[1].x));
    expect(Math.abs(arrow.head[0].x)).toBeGreaterThan(4);
  });
});

describe("note copy", () => {
  it("lists every note once", () => {
    expect(new Set(NOTE_IDS).size).toBe(NOTE_IDS.length);
  });

  it.each([
    ["en", en],
    ["de", de],
  ])("%s has text and a target name for every note", (_locale, strings) => {
    expect(Object.keys(strings.host.notes.items).sort()).toEqual(
      [...NOTE_IDS].sort(),
    );
    expect(Object.keys(strings.host.notes.targets).sort()).toEqual(
      [...NOTE_IDS].sort(),
    );
  });
});
