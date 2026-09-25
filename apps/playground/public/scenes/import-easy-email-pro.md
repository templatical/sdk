# Easy Email Pro

Paste Easy Email Pro JSON

convertEasyEmailProTemplate + init({ content }) — persist { subject, content } page.

Contract: https://docs.templatical.com/guide/migration-from-easy-email-pro#usage
Live: https://play.templatical.com/scenes/import-easy-email-pro

## Snippet

```ts
import { convertEasyEmailProTemplate } from "@templatical/import-easy-email-pro";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const { content } = convertEasyEmailProTemplate(emailTemplate);

const editor = await init({
  container: document.getElementById("editor"),
  content,
});
```
