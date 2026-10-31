/** Built from https://docs.beefree.io/beefree-sdk/ai-and-mcp/ai-addons/deepl (checked 2026-10-28); not a real export. */
// Language locations: https://docs.beefree.io/beefree-sdk/other-customizations/multi-language-templates
// Translatable fields: https://docs.beefree.io/end-user-guide/design-for-any-language/multi-language-templates
export const multilingual = {
  page: {
    body: { language: { label: "English", value: "en-US" } },
    rows: [
      {
        columns: [
          {
            modules: [
              {
                type: "mailup-bee-newsletter-modules-heading",
                descriptor: {
                  heading: {
                    text: "Hello",
                    translations: { "es-ES": { text: "Hola" } },
                  },
                },
              },
              {
                type: "mailup-bee-newsletter-modules-paragraph",
                descriptor: {
                  paragraph: {
                    html: "<p>Welcome</p>",
                    translations: { "es-ES": { html: "<p>Bienvenido</p>" } },
                  },
                },
              },
              {
                type: "mailup-bee-newsletter-modules-list",
                descriptor: {
                  list: {
                    html: "<ul><li>One</li></ul>",
                    translations: {
                      "es-ES": { html: "<ul><li>Uno</li></ul>" },
                    },
                  },
                },
              },
              {
                type: "mailup-bee-newsletter-modules-button",
                descriptor: {
                  button: {
                    label: "Shop",
                    translations: { "es-ES": { label: "Comprar" } },
                  },
                },
              },
              {
                type: "mailup-bee-newsletter-modules-image",
                descriptor: {
                  image: {
                    src: "https://example.com/en.png",
                    alt: "Photo",
                    translations: { "es-ES": { alt: "Foto" } },
                  },
                },
              },
              {
                type: "mailup-bee-newsletter-modules-video",
                descriptor: {
                  video: {
                    src: "https://example.com/video",
                    thumbAlt: "Preview",
                    translations: { "es-ES": { thumbAlt: "Vista previa" } },
                  },
                },
              },
              {
                type: "mailup-bee-newsletter-modules-menu",
                descriptor: {
                  menu: {
                    items: [{ text: "Home" }, { text: "About" }],
                    translations: {
                      "es-ES": {
                        items: [{ text: "Inicio" }, { text: "Nosotros" }],
                      },
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
  head: {
    meta: {
      preheader: "News",
      translations: { "es-ES": { preheader: "Noticias" } },
    },
  },
};
