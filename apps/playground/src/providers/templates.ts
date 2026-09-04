import type {
  TemplateContent,
  TemplatesProvider,
  TemplateSaveTrigger,
} from "@templatical/types";
import type { TemplateOption } from "@/templates";
import { SCRATCH_TEMPLATE_NAME, slugFor } from "./template-name";
import { versionStoreFor } from "./version-store";

/** Storage key per template, so each template is its own stored document. */
export function templatesKeyFor(templateName: string): string {
  return `templatical:template:${slugFor(templateName)}`;
}

/** What the demo store keeps under that key — exactly the `Template` shape. */
export interface StoredTemplate {
  id: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  content: TemplateContent;
}

/**
 * Demo templates provider: one localStorage record per template, standing in for
 * the API a real consumer would call.
 *
 * Memoised per template **name**, not per `init()` call — same rule as
 * `savedBlocksProviderFor`, and for the same reason: `init()` re-runs whenever
 * the locale or config changes, and a fresh provider each time would be pointless
 * churn around a single stored document. Switching template switches document.
 */
const templatesProviders = new Map<string, TemplatesProvider>();

export function templatesProviderFor(
  template?: TemplateOption,
): TemplatesProvider {
  const name = template?.name ?? SCRATCH_TEMPLATE_NAME;
  const cached = templatesProviders.get(name);
  if (cached) return cached;

  const key = templatesKeyFor(name);

  function read(): StoredTemplate | null {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as StoredTemplate;
    } catch {
      // A corrupt record reads as "nothing stored", so the next create() heals it
      // rather than wedging the demo.
      return null;
    }
  }

  function write(stored: StoredTemplate): StoredTemplate {
    localStorage.setItem(key, JSON.stringify(stored));
    return stored;
  }

  function requireStored(templateId: string): StoredTemplate {
    const stored = read();
    if (!stored || stored.id !== templateId) {
      throw new Error(`No template stored under "${templateId}"`);
    }
    return stored;
  }

  const versions = versionStoreFor(name);

  const base: TemplatesProvider = {
    load: async (templateId) => requireStored(templateId),
    create: async (input) => {
      // A store stamps its own writes, so the demo does too — that is what the
      // header's write time reads, and the editor never sends either field.
      //
      // `createdAt` only. Stamping `updatedAt` here too would claim an update
      // that never happened, and the header believes the store: it prefers
      // `updatedAt` and labels it "Updated", so a brand-new template read
      // "Updated just now" before anyone had edited anything. Leaving it unset
      // is what lets the header fall back to "Created", which is the whole point
      // of the timestamp carrying which field it came from. `save()` below is
      // the first thing that can honestly set it.
      //
      // Worth copying in a real backend: a column default of
      // `updated_at = created_at` produces the same lie.
      return write({
        id: slugFor(name),
        name: input.name,
        content: input.content,
        createdAt: new Date().toISOString(),
      });
    },
    save: async (templateId, patch) => {
      const stored = write({
        ...requireStored(templateId),
        ...patch,
        updatedAt: new Date().toISOString(),
      });
      // The contract puts automatic versions on whoever implements `save` — the
      // side that knows what storage costs. Cloud throttles here; the demo
      // records one per save, because a demo you have to wait out demonstrates
      // nothing. A rename patch carries no content and records nothing.
      if (patch.content) versions.append(patch.content, true);
      return stored;
    },
    onSaved: (_template, { trigger }) => {
      // Recorded on `window` rather than rendered: a visible trigger log would be
      // test-only UI in front of every visitor. e2e reads it with page.evaluate.
      const w = window as unknown as {
        __tplPlaygroundSaveTriggers?: TemplateSaveTrigger[];
      };
      (w.__tplPlaygroundSaveTriggers ??= []).push(trigger);
    },
  };

  templatesProviders.set(name, base);
  return base;
}
