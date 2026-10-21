import { describe, expect, it, vi } from "vitest";
import type {
  Template,
  TemplateContent,
  TemplatePatch,
  TemplatesProvider,
} from "@templatical/types";
import { withCollaborativeSave } from "../src/utils/withCollaborativeSave";

const STORED = {
  blocks: [],
  settings: { width: 600 },
} as unknown as TemplateContent;

describe("withCollaborativeSave with a provider that can't create", () => {
  it("keeps create disabled, and still saves through the batches", async () => {
    const provider = {
      load: vi.fn(async (id: string): Promise<Template> => ({
        id,
        name: "Welcome",
        content: STORED,
      })),
      create: false as const,
      save: vi.fn(
        async (id: string, patch: TemplatePatch): Promise<Template> => ({
          id,
          name: patch.name,
          content: STORED,
        }),
      ),
    };
    const settle = vi.fn(async () => {});

    const wrapped = withCollaborativeSave(
      provider as unknown as TemplatesProvider,
      { settle },
      () => null,
    );
    await wrapped.load("tpl-1");
    const saved = await (
      wrapped.save as (id: string, patch: TemplatePatch) => Promise<Template>
    )("tpl-1", { name: "Spring sale", content: STORED });

    expect(wrapped.create).toBe(false);
    expect(settle).toHaveBeenCalledOnce();
    expect(provider.save).toHaveBeenCalledWith("tpl-1", {
      name: "Spring sale",
    });
    expect(saved.name).toBe("Spring sale");
  });
});
