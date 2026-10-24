import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: "#editor",
  templates: {
    load: async (id) => {
      const response = await fetch(`/api/templates/${encodeURIComponent(id)}`);
      if (!response.ok)
        throw new Error(`Template load: HTTP ${response.status}`);
      return response.json();
    },
    create: false,
    save: false,
  },
});
await editor.load("tpl_123");
const response = await fetch("/api/subject-lines", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ content: editor.getContent() }),
});
if (!response.ok) throw new Error(`Subject lines: HTTP ${response.status}`);
const { subjectLines } = await response.json();
console.log(subjectLines); // Display these in your host's subject field.
