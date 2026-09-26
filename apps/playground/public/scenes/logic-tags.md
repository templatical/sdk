# Logic tags

Branch copy with IF / ENDIF

init({ logicTags }) — insert control-flow tokens from a dedicated picker.

Contract: https://docs.templatical.com/guide/logic-tags
Live: https://play.templatical.com/scenes/logic-tags

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  logicTags: {
    tags: [
      { label: "Else", value: "{% else %}", group: "Conditions" },
    ],
    pairs: [
      { label: "If VIP", before: "{% if customer.vip %}", after: "{% endif %}", group: "Conditions" },
    ],
  },
});
```
