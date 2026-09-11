import { describe, expect, it } from "vitest";
import { detectFormat } from "../src/cli/commands/import";

// Ported with the converters themselves when the skill's scripts/ moved into
// this package. Most of these are negative cases on purpose: the detector is a
// heuristic with a deliberate precedence order — MJML before the extension
// check, Stripo before the generic html branch, Unlayer before Chamaileon —
// and every one of those orderings is only observable as "X is not mistaken
// for Y". A detector that returns the right answer for its own format and the
// wrong one for its neighbour passes a positive-only suite.

describe("detectFormat", () => {
  it("detects html by extension", () => {
    expect(detectFormat("email.html", "anything")).toBe("html");
    expect(detectFormat("email.htm", "x")).toBe("html");
  });
  it("detects html by a leading angle bracket", () => {
    expect(detectFormat("export.txt", "  <table></table>")).toBe("html");
  });
  it("detects unlayer by body.rows", () => {
    expect(
      detectFormat("design.json", JSON.stringify({ body: { rows: [] } })),
    ).toBe("unlayer");
  });
  it("detects beefree by page.rows", () => {
    expect(
      detectFormat("template.json", JSON.stringify({ page: { rows: [] } })),
    ).toBe("beefree");
  });
  it("returns null when it can't tell", () => {
    expect(detectFormat("x.json", JSON.stringify({ foo: 1 }))).toBe(null);
    expect(detectFormat("x.json", "not json at all")).toBe(null);
  });
  it("detects mjml from the file extension", () => {
    expect(detectFormat("welcome.mjml", "<mjml><mj-body /></mjml>")).toBe("mjml");
  });
  it("detects mjml from an <mjml> root even with an .html extension", () => {
    expect(detectFormat("weird.html", "<mjml><mj-body /></mjml>")).toBe("mjml");
  });
  it("detects mjml from an mj-body when the root tag is missing", () => {
    expect(detectFormat("frag.txt", "<mj-body><mj-section /></mj-body>")).toBe("mjml");
  });
  it("still detects plain html as html", () => {
    expect(detectFormat("mail.html", "<html><body><table></table></body></html>")).toBe("html");
  });
  it("does not mistake html mentioning mjml in prose for mjml", () => {
    expect(
      detectFormat("mail.html", "<html><body><p>Built with mjml</p></body></html>"),
    ).toBe("html");
  });
  it("detects topol from the design root tagName", () => {
    expect(detectFormat("design.json", JSON.stringify({ tagName: "mj-global-style", children: [] })))
      .toBe("topol");
  });
  it("detects topol regardless of file name", () => {
    expect(detectFormat("whatever.txt", JSON.stringify({ tagName: "mj-global-style" })))
      .toBe("topol");
  });
  it("does not mistake an unlayer design for topol", () => {
    expect(detectFormat("design.json", JSON.stringify({ body: { rows: [] } }))).toBe("unlayer");
  });
  it("does not mistake a beefree template for topol", () => {
    expect(detectFormat("page.json", JSON.stringify({ page: { rows: [] } }))).toBe("beefree");
  });
  it("does not mistake MJML markup for topol", () => {
    expect(detectFormat("welcome.mjml", "<mjml><mj-body /></mjml>")).toBe("mjml");
  });
  it("detects stripo compiled HTML even with an .html extension", () => {
    expect(
      detectFormat(
        "export.html",
        '<table class="es-wrapper"><tr><td>x</td></tr></table>',
      ),
    ).toBe("stripo");
  });
  it("detects stripo editor HTML from an esd-stripe class", () => {
    expect(detectFormat("plugin.html", '<td class="esd-stripe">x</td>')).toBe(
      "stripo",
    );
  });
  it("detects stripo plugin JSON from getTemplateData html", () => {
    expect(
      detectFormat(
        "data.json",
        JSON.stringify({ html: '<td class="esd-block-text">x</td>', css: "p{}" }),
      ),
    ).toBe("stripo");
  });
  it("does not treat a stylesheet-only esd leftover as stripo", () => {
    expect(
      detectFormat(
        "mail.html",
        "<html><head><style>.esd-block-html table { width:auto }</style></head><body><table></table></body></html>",
      ),
    ).toBe("html");
  });
  it("strips script/style even when the closing tag has extra attributes", () => {
    expect(
      detectFormat(
        "mail.html",
        `<html><body><script>var x = 'class="esd-stripe"'</script foo="bar"><table></table></body></html>`,
      ),
    ).toBe("html");
  });
  it("ignores class attributes buried in a long run of incomplete style closers", () => {
    expect(
      detectFormat(
        "mail.html",
        `<style>${"</style".repeat(40)} class="esd-stripe"</style><table></table>`,
      ),
    ).toBe("html");
  });
  it("still detects plain html as html when no stripo class attributes exist", () => {
    expect(
      detectFormat("mail.html", "<html><body><table></table></body></html>"),
    ).toBe("html");
  });
  it("detects chamaileon from body.type", () => {
    expect(
      detectFormat("doc.json", JSON.stringify({ body: { type: "body", eid: "root", children: [] } })),
    ).toBe("chamaileon");
  });
  it("detects chamaileon regardless of file name", () => {
    expect(
      detectFormat("whatever.txt", JSON.stringify({ body: { type: "body" } })),
    ).toBe("chamaileon");
  });
  it("does not mistake an unlayer design for chamaileon", () => {
    expect(detectFormat("design.json", JSON.stringify({ body: { rows: [] } }))).toBe("unlayer");
  });
  it("does not mistake a topol design for chamaileon", () => {
    expect(detectFormat("design.json", JSON.stringify({ tagName: "mj-global-style" }))).toBe("topol");
  });
  it("does not mistake stripo html for chamaileon", () => {
    expect(
      detectFormat("x.html", '<table class="es-wrapper"><td class="es-content-body"></td></table>'),
    ).toBe("stripo");
  });
  it("detects easy-email-pro from content.type page plus standard-section", () => {
    expect(
      detectFormat(
        "doc.json",
        JSON.stringify({
          subject: "Hi",
          content: {
            type: "page",
            children: [{ type: "standard-section", children: [] }],
          },
        }),
      ),
    ).toBe("easy-email-pro");
  });

  it("detects a bare page element", () => {
    expect(
      detectFormat(
        "whatever.txt",
        JSON.stringify({
          type: "page",
          children: [{ type: "standard-section", children: [] }],
        }),
      ),
    ).toBe("easy-email-pro");
  });

  it("does not mistake OSS Easy Email for easy-email-pro", () => {
    expect(
      detectFormat(
        "doc.json",
        JSON.stringify({
          content: { type: "page", children: [{ type: "section", children: [] }] },
        }),
      ),
    ).toBe(null);
  });

  it("does not mistake an unlayer design for easy-email-pro", () => {
    expect(detectFormat("design.json", JSON.stringify({ body: { rows: [] } }))).toBe(
      "unlayer",
    );
  });

  it("does not mistake chamaileon for easy-email-pro", () => {
    expect(
      detectFormat("doc.json", JSON.stringify({ body: { type: "body", eid: "root" } })),
    ).toBe("chamaileon");
  });

  it("does not mistake beefree for easy-email-pro", () => {
    expect(detectFormat("doc.json", JSON.stringify({ page: { rows: [] } }))).toBe(
      "beefree",
    );
  });
});
