import { describe, expect, it } from "vitest";
import de from "../src/i18n/de";
import en from "../src/i18n/en";
import {
  NOTE_IDS,
  arrowBetween,
  intersects,
  placeNotes,
  type Box,
  type NoteTargets,
  type PlaceOptions,
} from "../src/host/sceneNotes";

const SIZE = { width: 120, height: 31 };
const VIEWPORT = { width: 1440, height: 900 };
const CODE: Box = { left: 1272, top: 12, width: 80, height: 32 };

function options(overrides: Partial<PlaceOptions> = {}): PlaceOptions {
  return {
    viewport: VIEWPORT,
    obstacles: [],
    measure: () => SIZE,
    ...overrides,
  };
}

describe("placeNotes", () => {
  it("puts a note at its first spot when nothing is in the way", () => {
    const [note] = placeNotes({ code: CODE }, options());
    expect(note.id).toBe("code");
    expect(note.box).toEqual({
      left: CODE.left - 4,
      top: CODE.top + CODE.height + 34,
      width: SIZE.width,
      height: SIZE.height,
    });
    expect(note.arrow.to).toEqual({ x: 1306, y: 50 });
  });

  it("moves to the next spot when the first covers the page's text", () => {
    // Inside the first spot (1268–1388) and clear of the second (1232–1352).
    const text: Box = { left: 1362, top: 80, width: 24, height: 20 };
    const [note] = placeNotes({ code: CODE }, options({ obstacles: [text] }));
    expect(note.box.left).toBe(CODE.left + CODE.width - SIZE.width);
    expect(intersects(note.box, text)).toBe(false);
  });

  it("leaves a note out when every spot is covered", () => {
    const wall: Box = { left: 0, top: 44, width: 1440, height: 200 };
    expect(placeNotes({ code: CODE }, options({ obstacles: [wall] }))).toEqual(
      [],
    );
  });

  it("leaves out a note whose target was not measured", () => {
    expect(placeNotes({}, options())).toEqual([]);
  });

  it("never places a note outside the viewport", () => {
    // Near the edge the left-aligned spot overhangs, and the right-aligned
    // one ends exactly on the 8px margin.
    const near: Box = { left: 1400, top: 12, width: 32, height: 32 };
    const [note] = placeNotes({ code: near }, options());
    expect(note.box.left).toBe(1312);
    expect(note.box.left + note.box.width).toBe(VIEWPORT.width - 8);
    // Right against it, both overhang, so the note is left out.
    const against: Box = { left: 1420, top: 12, width: 16, height: 32 };
    expect(placeNotes({ code: against }, options())).toEqual([]);
  });

  it("keeps two notes far enough apart to read as two", () => {
    const targets: NoteTargets = {
      code: CODE,
      share: { left: 1196, top: 12, width: 36, height: 32 },
      docs: { left: 1135, top: 18, width: 46, height: 20 },
    };
    const placed = placeNotes(targets, options());
    expect(placed.map((note) => note.id)).toEqual(["code", "share", "docs"]);
    for (const a of placed) {
      for (const b of placed) {
        if (a === b) continue;
        const gap: Box = {
          left: a.box.left - 25,
          top: a.box.top - 25,
          width: a.box.width + 50,
          height: a.box.height + 50,
        };
        expect(intersects(gap, b.box), `${a.id} and ${b.id}`).toBe(false);
      }
    }
  });

  it("refuses a spot whose arrow would cut through the page's text", () => {
    const panel: Box = { left: 1105, top: 130, width: 320, height: 760 };
    const tabs: Box = { left: 1113, top: 138, width: 300, height: 34 };
    const across: Box = { left: 1115, top: 300, width: 16, height: 18 };
    const clear = placeNotes({ properties: { panel, tabs } }, options());
    const blocked = placeNotes(
      { properties: { panel, tabs } },
      options({ obstacles: [across] }),
    );
    // Clear: the first depth. Blocked: the arrow up the margin crosses the
    // text at y 300 from every depth, so the note is left out.
    expect(clear[0].box.top).toBe(panel.top + panel.height * 0.3);
    expect(blocked).toEqual([]);
  });

  it("writes the canvas note only below a card that leaves room", () => {
    const body: Box = { left: 290, top: 130, width: 815, height: 770 };
    const short: Box = { left: 320, top: 160, width: 752, height: 448 };
    const full: Box = { left: 320, top: 160, width: 752, height: 1400 };
    const [below] = placeNotes({ canvas: { stage: short, body } }, options());
    expect(below.box.top).toBe(short.top + short.height + 34);
    expect(placeNotes({ canvas: { stage: full, body } }, options())).toEqual(
      [],
    );
  });

  it("writes the rail note only in a foot with room for it", () => {
    const rail: Box = { left: 0, top: 0, width: 224, height: 900 };
    expect(placeNotes({ rail: { rail, foot: 240 } }, options())).toHaveLength(
      1,
    );
    expect(placeNotes({ rail: { rail, foot: 820 } }, options())).toEqual([]);
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
