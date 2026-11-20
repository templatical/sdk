# Custom blocks from your data

Fill a custom block from your API

init({ customBlocks: [{ dataSource }] }) — choose an article to fill its fields.

Contract: https://docs.templatical.com/guide/custom-blocks#data-sources
Live: https://play.templatical.com/scenes/custom-blocks-data-source

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  customBlocks: [
    {
      type: "featured-article",
      name: "Featured Article",
      fields: [
        { type: "text", key: "title", label: "Title", readOnly: true },
        { type: "textarea", key: "excerpt", label: "Excerpt", readOnly: true },
        { type: "image", key: "imageUrl", label: "Cover Image" },
        { type: "text", key: "author", label: "Author", readOnly: true },
        { type: "text", key: "readTime", label: "Read Time", readOnly: true },
        { type: "text", key: "url", label: "Article URL", readOnly: true },
      ],
      template: '<article><h2>{{ title }}</h2><p>{{ excerpt }}</p><p>By {{ author }}</p></article>',
      dataSource: {
        label: "Change article",
        onFetch: async () => {
          const response = await fetch("/api/articles/featured");
          if (!response.ok) throw new Error("Could not fetch article");
          const article = await response.json();
          return {
            title: article.title,
            excerpt: article.excerpt,
            imageUrl: article.imageUrl,
            author: article.author,
            readTime: article.readTime,
            url: article.url,
          };
        },
      },
    },
  ],
});
```
