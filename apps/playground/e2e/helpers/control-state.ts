import type { Page } from "@playwright/test";

/** Mirrors `CONTROL_STATE_KEY` in `apps/playground/src/config/state.ts`. */
export const CONTROL_STATE_KEY = "tpl-playground-config";

/**
 * Seed capability control state before navigation.
 *
 * Merges into whatever is already stored rather than replacing it: one key now
 * carries every capability's controls, so two callers that each `setItem` the
 * whole object would silently drop each other's keys.
 *
 * Must run before `goto()` — the app reads control state at mount.
 */
export async function seedControlState(
  page: Page,
  controls: Record<string, unknown>,
): Promise<void> {
  await page.addInitScript(
    ([key, partial]) => {
      const raw = localStorage.getItem(key as string);
      let existing: Record<string, unknown> = {};
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            existing = parsed as Record<string, unknown>;
          }
        } catch {
          existing = {};
        }
      }
      localStorage.setItem(
        key as string,
        JSON.stringify({ ...existing, ...(partial as object) }),
      );
    },
    [CONTROL_STATE_KEY, controls] as const,
  );
}
