import { defineConfig, type DefaultTheme } from "vitepress";

const enNav: DefaultTheme.NavItem[] = [
  { text: "Guide", link: "/getting-started/installation" },
  { text: "API", link: "/api/editor" },
  { text: "Cloud", link: "/cloud/" },
  { text: "Compare", link: "/comparison" },
  { text: "Playground", link: "https://play.templatical.com" },
];

const enSidebar: DefaultTheme.SidebarMulti = {
  "/cloud/": [
    {
      text: "Cloud",
      items: [
        { text: "Overview", link: "/cloud/" },
        { text: "Getting Started", link: "/cloud/getting-started" },
        { text: "Authentication", link: "/cloud/authentication" },
      ],
    },
    {
      text: "Features",
      items: [
        { text: "AI Assistant", link: "/cloud/ai" },
        { text: "Collaboration", link: "/cloud/collaboration" },
        { text: "Comments", link: "/cloud/comments" },
        { text: "Media Library", link: "/cloud/media-library" },
        { text: "Template Scoring", link: "/cloud/template-scoring" },
        { text: "Saved Modules", link: "/cloud/saved-modules" },
        { text: "Test Emails", link: "/cloud/test-emails" },
        { text: "Snapshots", link: "/cloud/snapshots" },
      ],
    },
    {
      text: "Advanced",
      items: [
        { text: "MCP Integration", link: "/cloud/mcp" },
        { text: "Multi-Tenant", link: "/cloud/multi-tenant" },
        { text: "Headless API", link: "/cloud/headless-api" },
      ],
    },
  ],
  "/": [
    {
      text: "Getting Started",
      items: [
        { text: "Installation", link: "/getting-started/installation" },
        { text: "Quick Start", link: "/getting-started/quick-start" },
        {
          text: "How Rendering Works",
          link: "/getting-started/how-rendering-works",
        },
      ],
    },
    {
      text: "Guide",
      items: [
        { text: "Merge Tags", link: "/guide/merge-tags" },
        { text: "Display Conditions", link: "/guide/display-conditions" },
        { text: "Custom Blocks", link: "/guide/custom-blocks" },
        { text: "Images", link: "/guide/images" },
      ],
    },
    {
      text: "Customization",
      items: [
        { text: "Theming", link: "/guide/theming" },
        { text: "Block & Template Defaults", link: "/guide/defaults" },
        { text: "Custom Fonts", link: "/guide/fonts" },
        { text: "Internationalization", link: "/guide/i18n" },
      ],
    },
    {
      text: "Reference",
      items: [
        { text: "Block Types", link: "/guide/blocks" },
        { text: "Sections & Columns", link: "/guide/sections-and-columns" },
        { text: "Styling", link: "/guide/styling" },
        {
          text: "Programmatic Templates",
          link: "/guide/programmatic-templates",
        },
      ],
    },
    {
      text: "API Reference",
      items: [
        { text: "Editor", link: "/api/editor" },
        { text: "Types", link: "/api/types" },
        { text: "Renderer", link: "/api/renderer-typescript" },
        { text: "Events", link: "/api/events" },
      ],
    },
    {
      text: "Migration",
      items: [
        { text: "From BeeFree", link: "/guide/migration-from-beefree" },
        { text: "From Unlayer", link: "/guide/migration-from-unlayer" },
        { text: "From hand-written MJML", link: "/guide/migration-from-mjml" },
      ],
    },
    {
      text: "Resources",
      items: [
        { text: "Showcase", link: "/showcase" },
        { text: "Comparison", link: "/comparison" },
        { text: "License FAQ", link: "/license-faq" },
      ],
    },
  ],
};

const deNav: DefaultTheme.NavItem[] = [
  { text: "Anleitung", link: "/de/getting-started/installation" },
  { text: "API", link: "/de/api/editor" },
  { text: "Cloud", link: "/de/cloud/" },
  { text: "Vergleich", link: "/de/comparison" },
  { text: "Playground", link: "https://play.templatical.com" },
];

const deSidebar: DefaultTheme.SidebarMulti = {
  "/de/cloud/": [
    {
      text: "Cloud",
      items: [
        { text: "Überblick", link: "/de/cloud/" },
        { text: "Erste Schritte", link: "/de/cloud/getting-started" },
        { text: "Authentifizierung", link: "/de/cloud/authentication" },
      ],
    },
    {
      text: "Funktionen",
      items: [
        { text: "KI-Assistent", link: "/de/cloud/ai" },
        { text: "Zusammenarbeit", link: "/de/cloud/collaboration" },
        { text: "Kommentare", link: "/de/cloud/comments" },
        { text: "Medienbibliothek", link: "/de/cloud/media-library" },
        { text: "Template-Bewertung", link: "/de/cloud/template-scoring" },
        { text: "Gespeicherte Module", link: "/de/cloud/saved-modules" },
        { text: "Test-E-Mails", link: "/de/cloud/test-emails" },
        { text: "Snapshots", link: "/de/cloud/snapshots" },
      ],
    },
    {
      text: "Fortgeschritten",
      items: [
        { text: "MCP-Integration", link: "/de/cloud/mcp" },
        { text: "Multi-Tenant", link: "/de/cloud/multi-tenant" },
        { text: "Headless-API", link: "/de/cloud/headless-api" },
      ],
    },
  ],
  "/de/": [
    {
      text: "Erste Schritte",
      items: [
        { text: "Installation", link: "/de/getting-started/installation" },
        { text: "Schnellstart", link: "/de/getting-started/quick-start" },
        {
          text: "So funktioniert das Rendering",
          link: "/de/getting-started/how-rendering-works",
        },
      ],
    },
    {
      text: "Anleitung",
      items: [
        { text: "Merge-Tags", link: "/de/guide/merge-tags" },
        { text: "Anzeigebedingungen", link: "/de/guide/display-conditions" },
        { text: "Benutzerdefinierte Blöcke", link: "/de/guide/custom-blocks" },
        { text: "Bilder", link: "/de/guide/images" },
      ],
    },
    {
      text: "Anpassung",
      items: [
        { text: "Theming", link: "/de/guide/theming" },
        { text: "Block- & Template-Standards", link: "/de/guide/defaults" },
        { text: "Benutzerdefinierte Schriften", link: "/de/guide/fonts" },
        { text: "Internationalisierung", link: "/de/guide/i18n" },
      ],
    },
    {
      text: "Referenz",
      items: [
        { text: "Blocktypen", link: "/de/guide/blocks" },
        { text: "Sektionen & Spalten", link: "/de/guide/sections-and-columns" },
        { text: "Styling", link: "/de/guide/styling" },
        {
          text: "Programmatische Templates",
          link: "/de/guide/programmatic-templates",
        },
      ],
    },
    {
      text: "API-Referenz",
      items: [
        { text: "Editor", link: "/de/api/editor" },
        { text: "Typen", link: "/de/api/types" },
        { text: "Renderer", link: "/de/api/renderer-typescript" },
        { text: "Ereignisse", link: "/de/api/events" },
      ],
    },
    {
      text: "Migration",
      items: [
        { text: "Von BeeFree", link: "/de/guide/migration-from-beefree" },
        { text: "Von Unlayer", link: "/de/guide/migration-from-unlayer" },
        {
          text: "Von handgeschriebenem MJML",
          link: "/de/guide/migration-from-mjml",
        },
      ],
    },
    {
      text: "Ressourcen",
      items: [
        { text: "Showcase", link: "/de/showcase" },
        { text: "Vergleich", link: "/de/comparison" },
        { text: "Lizenz-FAQ", link: "/de/license-faq" },
      ],
    },
  ],
};

export default defineConfig({
  title: "Templatical",
  description: "Open-source drag-and-drop email editor for modern apps",
  cleanUrls: true,
  head: [
    [
      "link",
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "https://templatical.com/logo-small.svg",
      },
    ],
    ["meta", { name: "author", content: "Templatical" }],
    [
      "meta",
      {
        property: "og:title",
        content: "Templatical — Open-Source Email Editor",
      },
    ],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Production-ready drag-and-drop email editor. 13 block types, merge tags, custom blocks, dark mode, and client-side export.",
      },
    ],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:url", content: "https://docs.templatical.com" }],
    [
      "meta",
      {
        property: "og:image",
        content: "https://docs.templatical.com/og-image.png",
      },
    ],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    [
      "meta",
      {
        name: "twitter:title",
        content: "Templatical — Open-Source Email Editor",
      },
    ],
    [
      "meta",
      {
        name: "twitter:description",
        content:
          "Production-ready drag-and-drop email editor. 13 block types, merge tags, custom blocks, dark mode, and client-side export.",
      },
    ],
    [
      "meta",
      {
        name: "twitter:image",
        content: "https://docs.templatical.com/og-image.png",
      },
    ],
    ["link", { rel: "canonical", href: "https://docs.templatical.com" }],
  ],
  themeConfig: {
    logo: "https://templatical.com/logo.svg",
    siteTitle: "Templatical",

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/templatical/sdk",
      },
    ],

    search: {
      provider: "local",
    },
  },
  locales: {
    root: {
      label: "English",
      lang: "en",
      title: "Templatical",
      description: "Open-source drag-and-drop email editor for modern apps",
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
        editLink: {
          pattern:
            "https://github.com/templatical/sdk/edit/main/apps/docs/:path",
          text: "Edit this page on GitHub",
        },
        footer: {
          message:
            'Released under the <a href="https://github.com/templatical/sdk/blob/main/LICENSE">FSL-1.1-MIT License</a>.',
          copyright: "Copyright © 2026-present Templatical",
        },
      },
    },
    de: {
      label: "Deutsch",
      lang: "de",
      title: "Templatical",
      description:
        "Open-Source Drag-and-Drop-E-Mail-Editor für moderne Anwendungen",
      themeConfig: {
        nav: deNav,
        sidebar: deSidebar,
        editLink: {
          pattern:
            "https://github.com/templatical/sdk/edit/main/apps/docs/:path",
          text: "Diese Seite auf GitHub bearbeiten",
        },
        footer: {
          message:
            'Veröffentlicht unter der <a href="https://github.com/templatical/sdk/blob/main/LICENSE">FSL-1.1-MIT-Lizenz</a>.',
          copyright: "Copyright © 2026-present Templatical",
        },
        docFooter: {
          prev: "Vorherige Seite",
          next: "Nächste Seite",
        },
        outline: {
          label: "Auf dieser Seite",
        },
        lastUpdated: {
          text: "Zuletzt aktualisiert",
        },
        darkModeSwitchLabel: "Erscheinungsbild",
        lightModeSwitchTitle: "Zum hellen Modus wechseln",
        darkModeSwitchTitle: "Zum dunklen Modus wechseln",
        sidebarMenuLabel: "Menü",
        returnToTopLabel: "Nach oben",
        langMenuLabel: "Sprache ändern",
      },
    },
  },
});
