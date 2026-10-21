import { vi } from "vitest";
import { effectScope } from "@vue/reactivity";
import type {
  CollaborationActor,
  CollaborationProvider,
  CollaborationRemoteChange,
  TemplateContent,
  TemplatesProvider,
} from "@templatical/types";
import { safeClone } from "@templatical/types";
import { useEditor } from "../../src/editor";
import {
  useCollaboration,
  type CollaborationNotice,
  type UseCollaborationOptions,
} from "../../src/collaboration";
import type { FakeCollaborationServer } from "./fake-collaboration-server";

/**
 * A `useCollaboration` controller attached to a real `useEditor`, against a
 * `FakeCollaborationServer`, with what it reports collected for assertions.
 */

/** A title, a two-column section and a divider. */
export const BASE = {
  blocks: [
    { id: "t1", type: "title", content: "Hi" },
    {
      id: "s1",
      type: "section",
      columns: "2",
      children: [
        [{ id: "p1", type: "paragraph", content: "Left" }],
        [{ id: "b1", type: "button", text: "Go" }],
      ],
    },
    { id: "d1", type: "divider" },
  ],
  settings: { width: 600 },
} as unknown as TemplateContent;

/** An agent acting for Ada, with no editor session. */
export const AGENT: CollaborationActor = {
  type: "mcp",
  id: "ada",
  name: "Ada",
  sessionId: null,
  client: "Claude",
};

/** Let promise chains and queued microtasks run. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** The top-level block ids. */
export function ids(content: TemplateContent): string[] {
  return content.blocks.map((block) => block.id);
}

/** A top-level block's `content`. */
export function text(content: TemplateContent, id = "t1"): unknown {
  return (
    content.blocks.find((block) => block.id === id) as unknown as {
      content?: string;
    }
  ).content;
}

/** A promise and the function that resolves it. */
export function gate(): { wait: Promise<void>; open: () => void } {
  let open!: () => void;
  const wait = new Promise<void>((resolve) => (open = resolve));
  return { wait, open };
}

export interface ClientOptions extends Partial<
  Pick<UseCollaborationOptions, "loadTemplate" | "onRemoteChange" | "maxUndo">
> {
  /** In place of `server.provider(name)`. */
  provider?: CollaborationProvider;
  /** In place of `server.templatesProvider()`. */
  templates?: TemplatesProvider;
  /** `false` leaves the template unloaded. */
  load?: boolean;
}

/**
 * Build a controller and an editor in one effect scope, attach them and load
 * the server's template. Notices, remote changes and errors are collected;
 * `handlers()` reads the handlers the server holds for this session.
 */
export async function openClient(
  server: FakeCollaborationServer,
  name: string,
  extra: ClientOptions = {},
) {
  const notices: CollaborationNotice[] = [];
  const remote: CollaborationRemoteChange[] = [];
  const errors: Error[] = [];
  const scope = effectScope();
  const provider = extra.provider ?? server.provider(name);
  const { editor, collaboration } = scope.run(() => {
    const collaboration = useCollaboration({
      provider,
      loadTemplate: extra.loadTemplate ?? (async () => server.template()),
      maxUndo: extra.maxUndo,
      onNotice: (notice) => notices.push(notice),
      onRemoteChange: extra.onRemoteChange ?? ((change) => remote.push(change)),
      onError: (error) => errors.push(error),
    });
    const editor = useEditor({
      content: safeClone(BASE),
      templates: extra.templates ?? server.templatesProvider(),
      lockedBlocks: collaboration.locks,
    });
    collaboration.attach(editor);
    return { editor, collaboration };
  })!;
  if (extra.load !== false) {
    await editor.load(server.templateId);
    await settle();
  }
  const handlers = () => server.clients.get(collaboration.sessionId)!.handlers;
  return {
    editor,
    collaboration,
    notices,
    remote,
    errors,
    scope,
    provider,
    handlers,
  };
}

export type Client = Awaited<ReturnType<typeof openClient>>;

/**
 * Hold the provider's submit until `release()`. With `answerLate`, the server
 * applies and broadcasts the batch at once and only its answer waits, the way
 * a response can trail the broadcast it caused.
 */
export function gateSubmit(
  provider: CollaborationProvider,
  { answerLate = false } = {},
) {
  const held = gate();
  const submit = provider.submit.bind(provider);
  const spy = vi
    .spyOn(provider, "submit")
    .mockImplementation(async (templateId, batch) => {
      if (answerLate) {
        const answer = await submit(templateId, batch);
        await held.wait;
        return answer;
      }
      await held.wait;
      return submit(templateId, batch);
    });
  return { release: held.open, spy };
}
