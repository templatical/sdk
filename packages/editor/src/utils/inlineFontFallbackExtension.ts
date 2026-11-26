import { Decoration, Extension } from "@tiptap/core";

/** Paint TipTap font marks with fallbacks without changing stored HTML. */
export function inlineFontFallbackExtension(
  resolve: (family: string) => string,
) {
  return Extension.create({
    name: "inlineFontFallbacks",
    addDecorations() {
      return {
        create: ({ state }) => {
          const decorations: ReturnType<typeof Decoration.Inline>[] = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            const mark = node.marks.find(
              (item) => item.type.name === "textStyle",
            );
            const family = mark?.attrs.fontFamily;
            if (typeof family !== "string") return;
            const stack = resolve(family);
            if (stack !== family) {
              decorations.push(
                Decoration.Inline(pos, pos + node.nodeSize, {
                  style: `font-family: ${stack}`,
                }),
              );
            }
          });
          return decorations;
        },
      };
    },
  });
}
