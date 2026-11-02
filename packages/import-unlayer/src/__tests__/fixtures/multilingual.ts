/** Built from https://docs.unlayer.com/builder/templates/multi-language (checked 2026-10-28); not a real export. */
export const lexical = (text: string) => ({
  root: {
    type: "root",
    children: [
      { type: "paragraph", children: [{ type: "text", text, format: 0 }] },
    ],
  },
});
export const multilingual = {
  body: {
    values: {},
    rows: [
      {
        cells: [1],
        values: {
          backgroundImage: {
            url: "https://example.com/en-bg.png",
            fullWidth: false,
          },
          _languages: {
            es_ES: {
              backgroundImage: {
                url: "https://example.com/es-bg.png",
                fullWidth: false,
              },
            },
          },
        },
        columns: [
          {
            values: {},
            contents: [
              {
                type: "text",
                values: {
                  text: "<p>Hello</p>",
                  _languages: { es_ES: { text: "<p>Hola</p>" } },
                },
              },
              {
                type: "paragraph",
                values: {
                  textJson: lexical("Welcome"),
                  _languages: { es_ES: { textJson: lexical("Bienvenido") } },
                },
              },
              {
                type: "heading",
                values: {
                  text: "Title",
                  _languages: { es_ES: { text: "Título" } },
                },
              },
              {
                type: "button",
                values: {
                  text: "Shop",
                  _languages: { es_ES: { text: "Comprar" } },
                },
              },
              {
                type: "image",
                values: {
                  src: { url: "https://example.com/en.png" },
                  altText: "Photo",
                  _languages: {
                    es_ES: {
                      altText: "Foto",
                      src: { url: "https://example.com/es.png" },
                    },
                  },
                },
              },
              {
                type: "menu",
                values: {
                  menu: { items: [{ text: "Home" }, { text: "About" }] },
                  _languages: {
                    es_ES: {
                      menu: {
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
};
