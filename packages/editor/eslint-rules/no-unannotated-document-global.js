/**
 * @fileoverview Flag direct uses of `document.body`, `document.head`,
 * `document.activeElement`, and `window.getSelection()` in `@templatical/editor`
 * source without an adjacent `// shadow-ok:` justification comment.
 *
 * These globals don't cross the shadow boundary correctly and require either a
 * shadow-aware composable (`usePopoverRoot()`, `useEditorRoot()`) or an explicit
 * intentional-escape annotation. The trailing or preceding comment must include
 * `shadow-ok:` and a short reason.
 */

const FORBIDDEN_DOCUMENT_PROPS = new Set(["body", "head", "activeElement"]);

const SHADOW_OK = /\bshadow-ok\b/;

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag uses of `document.body`, `document.head`, `document.activeElement`, and `window.getSelection` without a `// shadow-ok: <reason>` justification comment.",
    },
    schema: [],
    messages: {
      unannotated:
        "Direct use of `{{access}}` is shadow-DOM-unsafe. Use a shadow-aware composable (`usePopoverRoot()`, `useEditorRoot()`) or add a `// shadow-ok: <reason>` comment on the same or preceding line.",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    function hasJustification(node) {
      const startLine = node.loc.start.line;
      // Accept a `shadow-ok` comment on the same line as the access (trailing
      // or before the expression) or up to 3 lines above. The window is wide
      // enough to cover a short explanation block immediately above the call
      // site without false-matching unrelated comments elsewhere in the file.
      for (const comment of sourceCode.getAllComments()) {
        if (!SHADOW_OK.test(comment.value)) continue;
        const cStart = comment.loc.start.line;
        const cEnd = comment.loc.end.line;
        if (cStart === startLine || cEnd === startLine) return true;
        if (cEnd >= startLine - 3 && cEnd <= startLine - 1) return true;
      }
      return false;
    }

    function reportIfUnannotated(node, access) {
      if (hasJustification(node)) return;
      context.report({
        node,
        messageId: "unannotated",
        data: { access },
      });
    }

    return {
      MemberExpression(node) {
        const object = node.object;
        const property = node.property;
        if (!property || property.type !== "Identifier") return;

        if (
          object.type === "Identifier" &&
          object.name === "document" &&
          FORBIDDEN_DOCUMENT_PROPS.has(property.name)
        ) {
          reportIfUnannotated(node, `document.${property.name}`);
          return;
        }

        if (
          object.type === "Identifier" &&
          object.name === "window" &&
          property.name === "getSelection"
        ) {
          reportIfUnannotated(node, "window.getSelection");
        }
      },
    };
  },
};

export default rule;
