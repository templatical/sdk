import {
  createCustomBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import { featuredArticleBlock } from "../../templates";
import type { Scene } from "../types";

export const customBlocksDataSource: Scene = {
  id: "custom-blocks-data-source",
  title: "Custom blocks from your data",
  job: "Fill a custom block from your API",
  initKey: "customBlocks[].dataSource",
  summary:
    "init({ customBlocks: [{ dataSource }] }) — choose an article to fill its fields.",
  catalog: "oss",
  group: "configure",
  docs: "/guide/custom-blocks#data-sources",
  pointer: {
    selector: '[data-block-type="custom"] button:not([aria-label])',
    root: "editor",
    side: "below",
  },
  content: () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createCustomBlock(featuredArticleBlock)];
    return content;
  },
  config: () => ({ customBlocks: [featuredArticleBlock] }),
  snippet: `import { init } from "@templatical/editor";
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
});`,
};
