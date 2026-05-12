import noTeleportToBody from "./no-teleport-to-body.js";
import noUnannotatedDocumentGlobal from "./no-unannotated-document-global.js";

const plugin = {
  meta: {
    name: "@templatical/editor-rules",
  },
  rules: {
    "no-teleport-to-body": noTeleportToBody,
    "no-unannotated-document-global": noUnannotatedDocumentGlobal,
  },
};

export default plugin;
