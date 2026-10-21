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
const ON_CANVAS = {
  blocks: [{ id: "t1", type: "title", content: "Hi" }],
  settings: { width: 600 },
} as unknown as TemplateContent;

type Save = (id: string, patch: TemplatePatch) => Promise<Template>;
type Create = (input: {
  name?: string;
  content: TemplateContent;
}) => Promise<Template>;

function setup() {
  const order: string[] = [];
  const provider = {
    load: vi.fn(async (id: string): Promise<Template> => ({
      id,
      name: "Welcome",
      content: STORED,
    })),
    create: vi.fn(async (input: { name?: string }): Promise<Template> => ({
      id: "tpl-2",
      name: input.name,
      content: STORED,
    })),
    save: vi.fn(async (id: string, patch: TemplatePatch): Promise<Template> => {
      order.push("save");
      return { id, name: patch.name, content: STORED };
    }),
  };
  const collaboration = {
    settle: vi.fn(async () => {
      order.push("settle");
    }),
  };
  let open: Template | null = null;
  const wrapped = withCollaborativeSave(
    provider as unknown as TemplatesProvider,
    collaboration,
    () => open,
  );
  return {
    provider,
    collaboration,
    order,
    load: (id: string) => wrapped.load(id),
    create: wrapped.create as Create,
    save: wrapped.save as Save,
    setOpen: (template: Template | null) => {
      open = template;
    },
  };
}

describe("withCollaborativeSave", () => {
  it("waits for the batches, then answers with what is open and sends nothing", async () => {
    const s = setup();
    const loaded = await s.load("tpl-1");
    const current = { ...loaded, content: ON_CANVAS };
    s.setOpen(current);

    const saved = await s.save("tpl-1", {
      name: "Welcome",
      content: ON_CANVAS,
    });

    expect(s.order).toEqual(["settle"]);
    expect(s.provider.save).not.toHaveBeenCalled();
    expect(saved).toBe(current);
  });

  it("sends only a new name, after the batches settle", async () => {
    const s = setup();
    s.setOpen(await s.load("tpl-1"));

    const saved = await s.save("tpl-1", {
      name: "Spring sale",
      content: ON_CANVAS,
    });

    expect(s.order).toEqual(["settle", "save"]);
    expect(s.provider.save).toHaveBeenCalledWith("tpl-1", {
      name: "Spring sale",
    });
    expect(saved.name).toBe("Spring sale");
  });

  it("remembers a saved name, so saving it again sends nothing", async () => {
    const s = setup();
    s.setOpen(await s.load("tpl-1"));
    await s.save("tpl-1", { name: "Spring sale", content: ON_CANVAS });

    await s.save("tpl-1", { name: "Spring sale", content: ON_CANVAS });

    expect(s.provider.save).toHaveBeenCalledTimes(1);
  });

  it("remembers the name a template was created with", async () => {
    const s = setup();
    s.setOpen(await s.create({ name: "Draft", content: STORED }));

    await s.save("tpl-2", { name: "Draft", content: ON_CANVAS });

    expect(s.provider.save).not.toHaveBeenCalled();
  });

  it("answers with the stored template when another one was opened meanwhile", async () => {
    const s = setup();
    s.setOpen({ id: "tpl-9", content: STORED });

    const saved = await s.save("tpl-1", { content: ON_CANVAS });

    expect(s.provider.save).not.toHaveBeenCalled();
    expect(s.provider.load).toHaveBeenCalledWith("tpl-1");
    expect(saved).toEqual({ id: "tpl-1", name: "Welcome", content: STORED });
  });

  it("passes a failed settle on and saves nothing", async () => {
    const s = setup();
    s.collaboration.settle.mockRejectedValueOnce(new Error("offline"));

    await expect(
      s.save("tpl-1", { name: "x", content: ON_CANVAS }),
    ).rejects.toThrow("offline");
    expect(s.provider.save).not.toHaveBeenCalled();
  });

  it("returns a provider that can't save unchanged", () => {
    const provider = {
      load: vi.fn(),
      create: false,
      save: false,
    } as unknown as TemplatesProvider;

    expect(
      withCollaborativeSave(provider, { settle: vi.fn() }, () => null),
    ).toBe(provider);
  });
});
