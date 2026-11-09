import { describe, expect, it } from "vitest";
import { decodeEntities } from "../block-mapper";
import { expectLinear } from "./expectLinear";

function oldDecodeEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "&") {
      const semi = text.indexOf(";", i + 1);
      if (semi !== -1 && semi - i <= 6) {
        const mapped = entities[text.slice(i, semi + 1)];
        if (mapped !== undefined) {
          out += mapped;
          i = semi + 1;
          continue;
        }
      }
    }
    out += text[i];
    i++;
  }
  return out;
}

describe("button entity decoding", () => {
  it.each([
    ["Tom &amp; Jerry", "Tom & Jerry"],
    ["&lt;b&gt;&quot;Hi&quot;&lt;/b&gt;", '<b>"Hi"</b>'],
    ["&#39;&apos;&nbsp;", "'' "],
    ["&unknown; &amplong; &", "&unknown; &amplong; &"],
    ["&amp;&lt;", "&<"],
  ])("decodes %s to %s", (input, expected) => {
    expect(decodeEntities(input)).toBe(expected);
  });

  it("agrees with the previous decoder over seeded strings", () => {
    let seed = 0x87654321;
    const alphabet = "&;amp lt#x39qotb";
    for (let i = 0; i < 3_000; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const length = (seed >>> 4) % 80;
      let input = "";
      for (let j = 0; j < length; j++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        input += alphabet[seed % alphabet.length];
      }
      expect(decodeEntities(input)).toBe(oldDecodeEntities(input));
    }
  });

  it("scales ampersands without semicolons linearly", () => {
    expectLinear((n) => {
      const input = "&".repeat(n);
      return () => decodeEntities(input);
    }, 16_000);
  });
});
