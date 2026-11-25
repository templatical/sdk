import { Extension } from "@tiptap/core";

/**
 * Mod-a selects the text inside the block, not the whole document.
 *
 * TipTap's default Mod-a is an `AllSelection`, whose start sits at the
 * document level rather than inside text. Typing over it inherits no marks
 * (`marksAcross` finds a paragraph, not text) and replaces the paragraph, so a
 * styled heading turns into plain body text while the toolbar still reports
 * the old font. A text selection over the same words keeps both the marks and
 * the paragraph's attributes, the same as selecting with the mouse.
 */
export const SelectAllText = Extension.create({
  name: "selectAllText",

  addKeyboardShortcuts() {
    return {
      "Mod-a": ({ editor }) => {
        let from = -1;
        let to = -1;
        editor.state.doc.descendants((node, pos) => {
          if (!node.isTextblock) return true;
          if (from < 0) from = pos + 1;
          to = pos + node.nodeSize - 1;
          return false;
        });
        // A document with no text block has nothing better to offer.
        if (from < 0) return false;

        return editor.commands.setTextSelection({ from, to });
      },
    };
  },
});
