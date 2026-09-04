import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";
import { describe, expect, it } from "vitest";
import { childElements, findByTag, tagOf } from "../attribute-resolver";
import { isLogicTagOnly, planSiblings } from "../display-condition";

function siblingsOf(markup: string): {
  units: ReturnType<typeof planSiblings>;
  $: CheerioAPI;
} {
  const $: CheerioAPI = load(`<mjml><mj-body>${markup}</mj-body></mjml>`, {
    xml: { xmlMode: false, recognizeSelfClosing: true },
  });
  const $body = findByTag($, "mj-body").first();
  return { units: planSiblings(childElements($body, $)), $ };
}

describe("isLogicTagOnly", () => {
  it("recognises a liquid if", () => {
    expect(isLogicTagOnly("{% if plan == 'pro' %}")).toBe(true);
  });

  it("recognises a liquid endif", () => {
    expect(isLogicTagOnly("{% endif %}")).toBe(true);
  });

  it("recognises a handlebars block open and close", () => {
    expect(isLogicTagOnly("{{#if pro}}")).toBe(true);
    expect(isLogicTagOnly("{{/if}}")).toBe(true);
  });

  it("recognises an ampscript block", () => {
    expect(isLogicTagOnly("%%[ IF pro == 1 THEN ]%%")).toBe(true);
  });

  it("rejects an MSO conditional comment", () => {
    expect(isLogicTagOnly("<!--[if mso]><table><![endif]-->")).toBe(false);
  });

  it("rejects a value merge tag", () => {
    expect(isLogicTagOnly("{{ first_name }}")).toBe(false);
  });

  it("rejects a logic tag with surrounding prose", () => {
    expect(isLogicTagOnly("hello {% if x %}")).toBe(false);
  });

  it("rejects empty text", () => {
    expect(isLogicTagOnly("   ")).toBe(false);
  });
});

describe("planSiblings", () => {
  it("attaches a bracketing pair to the element between them", () => {
    const { units } = siblingsOf(
      "<mj-raw>{% if pro %}</mj-raw><mj-section /><mj-raw>{% endif %}</mj-raw>",
    );

    expect(units).toHaveLength(1);
    expect(tagOf(units[0].$el[0])).toBe("mj-section");
    expect(units[0].displayCondition).toEqual({
      label: "{% if pro %}",
      before: "{% if pro %}",
      after: "{% endif %}",
    });
  });

  it("leaves an unpaired mj-raw as its own unit", () => {
    const { units } = siblingsOf("<mj-raw>{% if pro %}</mj-raw><mj-section />");

    expect(units).toHaveLength(2);
    expect(tagOf(units[0].$el[0])).toBe("mj-raw");
    expect(units[0].displayCondition).toBeUndefined();
    expect(units[1].displayCondition).toBeUndefined();
  });

  it("leaves a non-logic mj-raw pair alone", () => {
    const { units } = siblingsOf(
      "<mj-raw><!--[if mso]>a<![endif]--></mj-raw><mj-section /><mj-raw><!--[if mso]>b<![endif]--></mj-raw>",
    );

    expect(units).toHaveLength(3);
    expect(units.every((u) => u.displayCondition === undefined)).toBe(true);
  });

  it("does not pair two adjacent logic raws with no element between them", () => {
    const { units } = siblingsOf(
      "<mj-raw>{% if a %}</mj-raw><mj-raw>{% endif %}</mj-raw>",
    );

    expect(units).toHaveLength(2);
    expect(units.every((u) => u.displayCondition === undefined)).toBe(true);
  });

  it("handles several conditions in a row", () => {
    const { units } = siblingsOf(`
      <mj-raw>{% if a %}</mj-raw><mj-section id="a" /><mj-raw>{% endif %}</mj-raw>
      <mj-section id="plain" />
      <mj-raw>{% if b %}</mj-raw><mj-section id="b" /><mj-raw>{% endif %}</mj-raw>`);

    expect(units).toHaveLength(3);
    expect(units.map((u) => u.$el.attr("id"))).toEqual(["a", "plain", "b"]);
    expect(units[0].displayCondition?.before).toBe("{% if a %}");
    expect(units[1].displayCondition).toBeUndefined();
    expect(units[2].displayCondition?.before).toBe("{% if b %}");
  });

  it("truncates a long condition when synthesising the label", () => {
    const long = `{% if customer.subscription.plan_name == 'enterprise_annual_with_support' %}`;
    const { units } = siblingsOf(
      `<mj-raw>${long}</mj-raw><mj-section /><mj-raw>{% endif %}</mj-raw>`,
    );

    expect(units[0].displayCondition?.before).toBe(long);
    expect(units[0].displayCondition?.label).toBe(
      "{% if customer.subscription.plan_name == 'ente…",
    );
  });

  it("returns every element unchanged when there are no raws", () => {
    const { units } = siblingsOf("<mj-section /><mj-spacer />");

    expect(units.map((u) => tagOf(u.$el[0]))).toEqual([
      "mj-section",
      "mj-spacer",
    ]);
    expect(units.every((u) => u.displayCondition === undefined)).toBe(true);
  });
});
