import type { Comment, CommentsProvider } from "@templatical/types";
import type { TemplateOption } from "@/templates";
import { PLAYGROUND_USER } from "./identity";
import { SCRATCH_TEMPLATE_NAME, slugFor } from "./template-name";

/**
 * Demo comments store: one localStorage array per template, memoised per template
 * name — the rule every provider here follows, because `init()` re-runs on a locale
 * or config change and a fresh provider each time would be churn around one stored
 * conversation.
 *
 * There is deliberately **no `subscribe`**: the playground is one browser tab with
 * no backend, so a realtime transport would have nothing to carry. Its absence is
 * the point — comments work identically without it, which is exactly what the
 * contract promises.
 */
const commentsProviders = new Map<string, CommentsProvider>();

export function commentsProviderFor(
  template?: TemplateOption,
): CommentsProvider {
  const name = template?.name ?? SCRATCH_TEMPLATE_NAME;
  const cached = commentsProviders.get(name);
  if (cached) return cached;

  const key = `templatical:comments:${slugFor(name)}`;

  function read(): Comment[] {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Comment[]) : [];
    } catch {
      return [];
    }
  }

  function write(threads: Comment[]): void {
    localStorage.setItem(key, JSON.stringify(threads));
  }

  /** Roots and replies, flat, so an id can be located wherever it lives. */
  function locate(
    threads: Comment[],
    commentId: string,
  ): { thread: Comment; reply?: Comment } | null {
    for (const thread of threads) {
      if (thread.id === commentId) return { thread };
      for (const reply of thread.replies ?? []) {
        if (reply.id === commentId) return { thread, reply };
      }
    }
    return null;
  }

  function nextId(): string {
    return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const base: CommentsProvider = {
    list: async () => read(),

    create: async (_templateId, input) => {
      const threads = read();
      const comment: Comment = {
        id: nextId(),
        body: input.body,
        author: { ...PLAYGROUND_USER },
        createdAt: new Date().toISOString(),
        blockId: input.blockId ?? null,
        parentId: input.parentId ?? null,
        resolvedAt: null,
      };

      if (input.parentId) {
        const found = locate(threads, input.parentId);
        if (!found)
          throw new Error(`No thread stored under "${input.parentId}"`);
        found.thread.replies = [...(found.thread.replies ?? []), comment];
      } else {
        threads.push(comment);
      }
      write(threads);
      return comment;
    },

    update: async (_templateId, commentId, patch) => {
      const threads = read();
      const found = locate(threads, commentId);
      if (!found) throw new Error(`No comment stored under "${commentId}"`);
      const target = found.reply ?? found.thread;
      if (patch.body !== undefined) target.body = patch.body;
      // Stamped only on a real edit, which is what makes the "(edited)" marker
      // mean something — a store that sets it on creation marks everything edited.
      target.updatedAt = new Date().toISOString();
      write(threads);
      return target;
    },

    delete: async (_templateId, commentId) => {
      const threads = read();
      const found = locate(threads, commentId);
      if (!found) return;
      if (found.reply) {
        found.thread.replies = (found.thread.replies ?? []).filter(
          (r) => r.id !== commentId,
        );
        write(threads);
        return;
      }
      write(threads.filter((t) => t.id !== commentId));
    },

    setResolved: async (_templateId, commentId, resolved) => {
      const threads = read();
      const found = locate(threads, commentId);
      if (!found) throw new Error(`No comment stored under "${commentId}"`);
      const target = found.reply ?? found.thread;
      // The target state is applied, not toggled — the contract's whole reason for
      // taking a boolean rather than flipping whatever it finds.
      target.resolvedAt = resolved ? new Date().toISOString() : null;
      target.resolvedBy = resolved ? { ...PLAYGROUND_USER } : null;
      write(threads);
      return target;
    },
  };

  commentsProviders.set(name, base);
  return base;
}
