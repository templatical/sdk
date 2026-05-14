import { describe, expect, it } from "vitest";
import { computed } from "@vue/reactivity";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
} from "@templatical/types";
import {
  useBlockActions,
  useEditor,
  useHistory,
  useHistoryInterceptor,
} from "../src";

/**
 * Bug repro: section + child → clone the child (lands at sourceIndex + 1
 * in the same column) → move the clone above the original (still inside
 * the section) → click clone again → throws `cyclic object value` from
 * `history.cloneContent` (JSON.stringify of state.content).
 *
 * The failing call chain in production is:
 *   handleDuplicate → duplicateBlock → addBlock (history-intercepted)
 *     → history.record → cloneContent → JSON.stringify(state.content)
 *
 * The asserts below guard the data-layer contract: every public mutation
 * path must leave `state.content` JSON-serializable so `history.record`
 * can snapshot it. This currently passes at unit level — the production
 * cycle was only observed in browser + vue-draggable-plus + Firefox
 * (XrayWrapper-flavored error). Keeping the unit-level invariant test
 * means any future fix that touches block-actions, the editor's mutation
 * methods, or the history interceptor will be checked against this exact
 * sequence and fail fast if it reintroduces a cycle.
 */
describe("clone after moving within a section keeps state JSON-serializable", () => {
  function makeFixture() {
    const content = createDefaultTemplateContent();
    const childA = createParagraphBlock({ content: "<p>A</p>" });
    const section = createSectionBlock({ children: [[childA]] });
    content.blocks = [section];

    const editor = useEditor({ content });
    const history = useHistory({
      content: computed(() => editor.state.content),
      setContent: editor.setContent,
    });
    useHistoryInterceptor(editor, history);
    const actions = useBlockActions({
      addBlock: editor.addBlock,
      removeBlock: editor.removeBlock,
      updateBlock: editor.updateBlock,
      selectBlock: editor.selectBlock,
      findBlockLocation: editor.findBlockLocation,
    });

    return { editor, actions, childA, section };
  }

  it("setColumnBlocks-style update (VueDraggable path)", () => {
    const { editor, actions, childA } = makeFixture();

    // 1. Clone the child — clone lands at sourceIndex + 1 in the same column.
    const cloned = actions.duplicateBlock(childA);
    expect(() => JSON.stringify(editor.state.content)).not.toThrow();

    // 2. Simulate `SectionBlock.setColumnBlocks` after a VueDraggable
    //    update — reorder the column children and write back through
    //    `editor.updateBlock(section.id, { children: newOuter })`.
    const sec = editor.state.content.blocks[0];
    if (sec.type !== "section") throw new Error("expected section");
    const reordered = [sec.children[0][1], sec.children[0][0]];
    const newChildren = [...sec.children];
    newChildren[0] = reordered;
    editor.updateBlock(sec.id, { children: newChildren });

    expect(() => JSON.stringify(editor.state.content)).not.toThrow();

    // 3. Clone again — same call path the user's second click hits.
    //    Internally goes through history.record → cloneContent.
    const secondClone = actions.duplicateBlock(childA);
    expect(secondClone.id).not.toBe(childA.id);
    expect(secondClone.id).not.toBe(cloned.id);
    expect(() => JSON.stringify(editor.state.content)).not.toThrow();
  });

  it("editor.moveBlock path (keyboard reorder)", () => {
    const { editor, actions, childA, section } = makeFixture();

    const cloned = actions.duplicateBlock(childA);
    expect(() => JSON.stringify(editor.state.content)).not.toThrow();

    // Same scenario through the editor's own moveBlock API. If the cycle
    // is introduced by Vue reactivity rewrap when a column array is
    // mutated in-place vs replaced wholesale, this path stresses the
    // in-place variant.
    editor.moveBlock(cloned.id, 0, section.id, 0);
    expect(() => JSON.stringify(editor.state.content)).not.toThrow();

    const secondClone = actions.duplicateBlock(childA);
    expect(secondClone.id).not.toBe(childA.id);
    expect(secondClone.id).not.toBe(cloned.id);
    expect(() => JSON.stringify(editor.state.content)).not.toThrow();
  });

  it("repeated clone → move → clone iterations stay serializable", () => {
    // Stress the same path multiple times so accumulated state from
    // history snapshots + reactive rewrap can't sneak in a cycle.
    const { editor, actions, childA, section } = makeFixture();

    let lastTarget = childA;
    for (let i = 0; i < 5; i++) {
      const clone = actions.duplicateBlock(lastTarget);
      expect(() => JSON.stringify(editor.state.content)).not.toThrow();
      editor.moveBlock(clone.id, 0, section.id, 0);
      expect(() => JSON.stringify(editor.state.content)).not.toThrow();
      lastTarget = clone;
    }
  });

  it("history.record survives even if state.content carries a cyclic ref", () => {
    // Belt-and-suspenders: if some future drag handler manages to leak a
    // self-referencing object into state.content (e.g. a Sortable expando
    // back-ref), cloneContent must drop the cycle silently rather than
    // throw — otherwise the next duplicate/move/etc. call fires
    // history.record() and the editor freezes mid-action.
    const { editor, actions, childA } = makeFixture();

    const blockWithCycle: any = editor.state.content.blocks[0];
    if (blockWithCycle.type !== 'section') throw new Error('expected section');
    const child: any = blockWithCycle.children[0][0];
    const ring: Record<string, unknown> = {};
    ring.self = ring;
    // Smuggle a cyclic property into a live reactive block.
    child.__cyclicSmuggle = ring;

    expect(() => actions.duplicateBlock(childA)).not.toThrow();
  });
});
