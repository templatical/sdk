import type { BeeFreeeModule } from "../../types";

// The menu, table and video descriptors BeeFree writes, as typed by
// `IPluginModuleMenu`, `IPluginModuleTable` and `IPluginModuleVideo` in
// https://github.com/BeefreeSDK/beefree-sdk-npm-official/blob/master/src/types/bee.ts
// (checked 2026-11-09). Key structure is copied from real exports; values are
// sample data.

/**
 * The menu in `v3 Page Templates/furniture-shop.json` of
 * https://github.com/BeefreeSDK/beefree-sdk-assets-templates (05bc0b87).
 * `computedStyle.separator` is not in `bee.ts`; 3 of the corpus's 7 menus
 * write it, and the other 4 draw no separator.
 */
export function realMenu(): BeeFreeeModule {
  const item = (text: string) => ({
    link: { href: "https://www.example.com", target: "_self", title: "" },
    text,
  });
  return {
    type: "mailup-bee-newsletter-modules-menu",
    uuid: "menu-1",
    descriptor: {
      computedStyle: {
        hamburger: {
          backgroundColor: "#000000",
          foregroundColor: "#ffffff",
          iconSize: "36px",
          iconType: "normal",
          mobile: false,
        },
        hideContentOnDesktop: false,
        hideContentOnMobile: false,
        layout: "horizontal",
        linkColor: "#323e49",
        menuItemsSpacing: {
          "padding-bottom": "5px",
          "padding-left": "15px",
          "padding-right": "15px",
          "padding-top": "5px",
        },
      },
      menuItemsList: {
        items: [
          item("NEW COLLECTION"),
          item("FURNITURE"),
          item("DECOR"),
          item("ACCESSORIES"),
          item("BLOG"),
        ],
      },
      style: {
        color: "#323e49",
        "font-family": "inherit",
        "font-size": "14px",
        "padding-bottom": "0px",
        "padding-left": "0px",
        "padding-right": "0px",
        "padding-top": "0px",
        "text-align": "center",
      },
    },
  };
}

/**
 * The table in BeeFree's own email-to-page sample,
 * `.gitbook/assets/email-to-page-conversion.yaml` of
 * https://github.com/BeefreeSDK/beefree-sdk-docs (799613dc).
 */
export function realTable(): BeeFreeeModule {
  const row = (...cells: string[]) => ({
    cells: cells.map((html) => ({ html })),
  });
  return {
    type: "mailup-bee-newsletter-modules-table",
    uuid: "table-1",
    descriptor: {
      table: {
        content: {
          headers: [row("Size", "Width", "Price")],
          rows: [row("Small", "40cm", "$20"), row("", "", ""), row("", "", "")],
        },
        style: {
          color: "#000000",
          "font-size": "14px",
          "font-family": "inherit",
          "font-weight": "400",
          "line-height": "120%",
          "text-align": "left",
          direction: "ltr",
          "letter-spacing": "0px",
          "background-color": "transparent",
          "border-top": "1px solid #dddddd",
          "border-right": "1px solid #dddddd",
          "border-bottom": "1px solid #dddddd",
          "border-left": "1px solid #dddddd",
        },
        computedStyle: {
          linkColor: "#0068A5",
          headersFontSize: "14px",
          headersFontWeight: "400",
          headersTextAlign: "left",
          headersBackgroundColor: "#EAEAEA",
          headersColor: "#505659",
        },
      },
      style: {
        "padding-top": "10px",
        "padding-right": "10px",
        "padding-bottom": "10px",
        "padding-left": "10px",
      },
      computedStyle: {
        hideContentOnAmp: false,
        hideContentOnHtml: false,
        hideContentOnDesktop: false,
        hideContentOnMobile: false,
      },
    },
  };
}

/**
 * A thumbnail-mode video, the shape of
 * `test/testing-bee-templates/separated-blocks/video.json` in
 * https://github.com/Ecomailcz/bee-to-topol (aeac68f0), a real BeeFree export.
 * The width is a percentage and the alignment is `computedStyle.class`.
 */
export function realVideo(): BeeFreeeModule {
  return {
    type: "mailup-bee-newsletter-modules-video",
    uuid: "video-1",
    descriptor: {
      video: {
        src: "https://www.youtube.com/watch?v=abcdefghijk",
        thumbSrc: "https://img.youtube.com/vi/abcdefghijk/maxresdefault.jpg",
        thumbRatio: "16-9",
        iconSrc:
          "https://app-rsrc.getbee.io/public/resources/components/widgetBar/video-content-icon-sets/dark/type-02.png",
        iconType: 2,
        iconSize: 60,
        iconColor1: "#000000",
        iconColor2: "#ffffff",
        mode: "thumbnail",
        thumbAlt: "Product tour",
      },
      style: {
        width: "100%",
        "padding-top": "10px",
        "padding-right": "10px",
        "padding-bottom": "10px",
        "padding-left": "10px",
      },
      computedStyle: {
        class: "center",
        width: "100%",
        hideContentOnMobile: false,
      },
    },
  };
}
