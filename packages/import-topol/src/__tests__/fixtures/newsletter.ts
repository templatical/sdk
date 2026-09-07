import type { TopolDesign } from "../../types";

/**
 * A hand-authored Topol design covering every construct the importer handles:
 * the global-style cascade, a one-column section, a two-column section, a
 * four-column section (which must fold), each leaf type, and a social block
 * whose `display` omits a configured platform.
 */
export const NEWSLETTER: TopolDesign = {
  tagName: "mj-global-style",
  attributes: {
    containerWidth: 600,
    ":color": "#222222",
    ":font-family": "Ubuntu, Helvetica, Arial, sans-serif",
    ":line-height": "1.6",
    "a:color": "#0055ff",
    "h1:color": "#111111",
    "button:background-color": "#e85034",
    "mj-text": { "font-size": 15 },
  },
  children: [
    {
      tagName: "mj-container",
      attributes: { "background-color": "#f4f4f4" },
      children: [
        {
          tagName: "mj-section",
          attributes: { padding: "20px" },
          children: [
            {
              tagName: "mj-column",
              attributes: { width: "100%" },
              children: [
                {
                  tagName: "mj-text",
                  attributes: { align: "center" },
                  content: "<h1>This week</h1>",
                },
                {
                  tagName: "mj-text",
                  attributes: {},
                  content: "<p>Hello <strong>there</strong>.</p>",
                },
                {
                  tagName: "mj-image",
                  attributes: {
                    src: "https://cdn.test/hero.png",
                    alt: null,
                    width: 600,
                    widthPercent: 100,
                  },
                },
              ],
            },
          ],
        },
        {
          tagName: "mj-section",
          attributes: {},
          children: [
            {
              tagName: "mj-column",
              attributes: { width: "50%" },
              children: [
                {
                  tagName: "mj-button",
                  attributes: { href: "https://x.test" },
                  content: "<p>Read more</p>",
                },
              ],
            },
            {
              tagName: "mj-column",
              attributes: { width: "50%" },
              children: [
                { tagName: "mj-spacer", attributes: { height: 16 } },
                {
                  tagName: "mj-gif",
                  attributes: {
                    src: "https://cdn.test/announcement.gif",
                    width: 300,
                    widthPercent: 50,
                  },
                },
              ],
            },
          ],
        },
        {
          tagName: "mj-section",
          attributes: {},
          children: [
            {
              tagName: "mj-column",
              attributes: { width: "25%" },
              children: [
                {
                  tagName: "mj-divider",
                  attributes: { "border-width": "2px", "padding-top": 4 },
                },
              ],
            },
            {
              tagName: "mj-column",
              attributes: { width: "25%" },
              children: [],
            },
            {
              tagName: "mj-column",
              attributes: { width: "25%" },
              children: [],
            },
            {
              tagName: "mj-column",
              attributes: { width: "25%" },
              children: [
                {
                  tagName: "mj-social",
                  attributes: {
                    display: "facebook:url twitter:url",
                    "facebook-href": "https://fb.test/a",
                    "twitter-href": "https://tw.test/a",
                    "youtube-icon": "https://cdn.test/youtube.png",
                    "icon-size": "32px",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
