import { describe, expect, it } from "vitest";
import { createOrderConfirmationTemplate } from "../src/templates";

describe("Sable order kit", () => {
  const json = JSON.stringify(createOrderConfirmationTemplate());

  it("paints VIP rust/cream, not Northstage violet", () => {
    expect(json).toContain("#9a3412");
    expect(json).toContain("#faf8f5");
    expect(json).not.toContain("#7c3aed");
    expect(json).not.toContain("#f5f3ff");
  });

  it("ships to Portland on Stone Row, matching the footer", () => {
    expect(json).toContain("210 Stone Row, Apt 4B");
    expect(json).toContain("Portland, OR 97209");
    expect(json).not.toContain("San Francisco");
    expect(json).not.toContain("123 Main St");
  });

  it("names line items after the Sable catalog", () => {
    expect(json).toContain("Wireless Pro Max");
    expect(json).toContain("Ceramic Buds");
    expect(json).toContain("Travel Case");
    expect(json).not.toContain("Wireless Headphones");
    expect(json).not.toContain("USB-C Cable");
    expect(json).not.toContain("Phone Case");
  });

  it("keeps the Delivery contact bare-token fixture", () => {
    expect(json).toContain(
      "{{first_name}} {{last_name}} — {{customer_tier}} member",
    );
  });
});
