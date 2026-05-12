/**
 * @fileoverview Disallow `<Teleport to="body">` in Vue templates. Pop-up
 * surfaces must mount inside the editor's shadow-aware popover root, so the
 * `tpl-popover-root` container can host modals and dropdowns from inside a
 * shadow boundary. Inject the ref via `usePopoverRoot()` in `<script setup>`
 * and bind it on the Teleport: `<Teleport :to="popoverRoot">`.
 */

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        'Disallow `<Teleport to="body">` in `.vue` templates; pop-up surfaces must use the editor\'s shadow-aware popover root via `usePopoverRoot()`.',
    },
    schema: [],
    messages: {
      noBodyTeleport:
        '`<Teleport to="body">` escapes the editor\'s shadow boundary. Inject the popover root with `usePopoverRoot()` and bind it: `<Teleport :to="popoverRoot">`.',
    },
  },

  create(context) {
    const { parserServices } = context;
    if (!parserServices || !parserServices.defineTemplateBodyVisitor) {
      return {};
    }

    return parserServices.defineTemplateBodyVisitor({
      VElement(node) {
        const name = node.rawName?.toLowerCase();
        if (name !== "teleport") return;

        for (const attr of node.startTag.attributes) {
          if (attr.directive) continue;
          if (attr.key?.name !== "to") continue;
          if (attr.value?.value === "body") {
            context.report({
              node: attr,
              messageId: "noBodyTeleport",
            });
          }
        }
      },
    });
  },
};

export default rule;
