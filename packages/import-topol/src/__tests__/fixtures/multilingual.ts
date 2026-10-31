/** Built from https://docs.topol.io/email-editor/guide/multilingual-templates (checked 2026-10-28); not a real export. */
import type { TopolLanguage } from "../../types";

export const multilingual = {
  tagName: "mj-global-style",
  children: [
    {
      tagName: "mj-container",
      children: [
        {
          tagName: "mj-section",
          children: [
            {
              tagName: "mj-column",
              children: [
                {
                  tagName: "mj-text",
                  uid: "heading",
                  content: "<h2>Hello</h2>",
                },
                {
                  tagName: "mj-text",
                  uid: "paragraph",
                  content: "<p>Welcome</p>",
                },
                {
                  tagName: "mj-button",
                  uid: "button",
                  content: "Shop",
                  attributes: { href: "https://example.com/en" },
                },
                {
                  tagName: "mj-image",
                  uid: "image",
                  attributes: {
                    src: "https://example.com/en.png",
                    alt: "Photo",
                    href: "https://example.com/en",
                  },
                },
                { tagName: "mj-image", uid: "empty", attributes: {} },
                { tagName: "mj-unknown", uid: "fallback", content: "Unknown" },
              ],
            },
          ],
        },
      ],
    },
  ],
  langs: [
    {
      key: "en-US",
      primary: true,
      translations: { "mj-preview": { content: "News" } },
    },
    {
      key: "de",
      translations: {
        heading: { content: "<h2>Hallo</h2>" },
        paragraph: { content: "<p>Willkommen</p>" },
        button: {
          content: "Kaufen",
          attributes: { href: "https://example.com/de" },
        },
        image: {
          attributes: {
            alt: "Foto",
            href: "https://example.com/de",
            src: "https://example.com/de.png",
          },
        },
        "mj-preview": { content: "Neuigkeiten" },
      },
    },
  ] as TopolLanguage[],
};
