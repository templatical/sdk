import { describe, expect, it } from "vitest";
import type { Template } from "@templatical/types";
import { collectSavedBlockIds } from "../src/cloud/collectSavedBlockIds";

describe("collectSavedBlockIds", () => {
  it("returns empty when there is no template", () => {
    expect(collectSavedBlockIds(null)).toEqual(new Set());
    expect(collectSavedBlockIds(undefined)).toEqual(new Set());
  });

  it("collects top-level ids", () => {
    expect(
      collectSavedBlockIds({
        content: { blocks: [{ id: "t1", type: "title" }] },
      }),
    ).toEqual(new Set(["t1"]));
  });

  it("walks section columns", () => {
    expect(
      collectSavedBlockIds({
        content: {
          blocks: [
            {
              id: "s1",
              type: "section",
              children: [[{ id: "p1", type: "paragraph" }]],
            },
          ],
        },
      }),
    ).toEqual(new Set(["s1", "p1"]));
  });

  it("walks a layout wrapper's flat children", () => {
    expect(
      collectSavedBlockIds({
        content: {
          blocks: [
            {
              id: "w1",
              type: "wrapper",
              children: [{ id: "t1", type: "title" }],
            },
          ],
        },
      }),
    ).toEqual(new Set(["w1", "t1"]));
  });

  it("accepts DeepReadonly Template from editor.state", () => {
    const template = {
      id: "tmpl",
      content: {
        blocks: [
          {
            id: "w1",
            type: "wrapper" as const,
            children: [
              {
                id: "s1",
                type: "section" as const,
                columns: "1" as const,
                children: [
                  [
                    {
                      id: "t1",
                      type: "title" as const,
                      content: "Hi",
                      level: 1 as const,
                      textAlign: "left" as const,
                      styles: {
                        padding: { top: 0, right: 0, bottom: 0, left: 0 },
                      },
                    },
                  ],
                ],
                styles: {
                  padding: { top: 0, right: 0, bottom: 0, left: 0 },
                },
              },
            ],
            styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
          },
        ],
        settings: {
          width: 600,
          backgroundColor: "#fff",
          textColor: "#000",
          linkUnderline: true,
          fontFamily: "Arial",
          locale: "en",
        },
      },
    } satisfies Template;

    expect(collectSavedBlockIds(template)).toEqual(new Set(["w1", "s1", "t1"]));
  });
});
