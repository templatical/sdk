import type { ChamaileonDocument, ChamaileonNode } from "../../types";

const text = (html: string): ChamaileonNode => ({
  type: "text",
  attrs: { text: html },
});

const column = (
  width: string,
  ...children: ChamaileonNode[]
): ChamaileonNode => ({
  type: "column",
  style: { width },
  children,
});

const multicolumn = (...columns: ChamaileonNode[]): ChamaileonNode => ({
  type: "multicolumn",
  children: columns,
});

const image = (src: string): ChamaileonNode => ({
  type: "image",
  attrs: { src, altText: "" },
  style: { width: "36px" },
});

const fullwidth = (...children: ChamaileonNode[]): ChamaileonNode => ({
  type: "fullwidth",
  children,
});

/**
 * Hand-authored 4.x-shaped document covering settings, layouts, nested
 * multicolumn, outlined vs filled buttons, variable unwrap, an empty loop,
 * title inference, and a 2.0 kebab-case button in the same tree.
 */
export const NEWSLETTER: ChamaileonDocument = {
  previewText: "Hello",
  variables: [{ name: "SecondaryColor", value: "#5C9AEB", type: "color" }],
  body: {
    eid: "root",
    type: "body",
    version: "4.1.0",
    style: {
      bodyWidth: 600,
      backgroundColor: "#f4f4f4",
    },
    children: [
      fullwidth(
        {
          type: "button",
          attrs: { text: "<p>Download</p>", href: "https://example.test" },
          style: {
            backgroundColor: "#00a591",
            color: "#ffffff",
            borderRadius: "5px",
          },
        },
        text("<h1>Welcome</h1>"),
      ),
      fullwidth(
        multicolumn(
          column("300px", text("<p>Left</p>")),
          column("300px", text("<p>Right</p>")),
        ),
      ),
      fullwidth(
        multicolumn(
          column("150px", text("<p>1</p>")),
          column("150px", text("<p>2</p>")),
          column("150px", text("<p>3</p>")),
          column("150px", text("<p>4</p>")),
        ),
      ),
      fullwidth(
        multicolumn(
          column(
            "300px",
            multicolumn(
              column("100px", image("https://cdn.test/a.png")),
              column("100px", image("https://cdn.test/b.png")),
              column("100px", image("https://cdn.test/c.png")),
            ),
          ),
          column("300px", text("<p>Side</p>")),
        ),
      ),
      fullwidth(
        {
          type: "button",
          attrs: { text: "Outline", href: "" },
          style: {
            backgroundColor: null,
            color: "#00a591",
            borderLeft: "1px solid #00a591",
            borderRadius: "5px",
          },
        },
        {
          type: "button",
          attrs: { text: "<p>Details</p>\n", href: "" },
          style: {
            backgroundColor: {
              reference: "SecondaryColor",
              default: "#5C9AEB",
            },
            color: "#ffffff",
          },
        },
        {
          type: "button",
          attrs: {
            text: "Download the App",
            href: "https://x.test",
            align: "center",
          },
          style: {
            "background-color": "#00a591",
            color: "#ffffff",
            "border-radius": "5px",
            "font-size": "16px",
          },
        },
      ),
      {
        type: "block-level-loop",
        children: [],
        attrs: { expression: "items" },
        style: {},
      },
    ],
  },
};
