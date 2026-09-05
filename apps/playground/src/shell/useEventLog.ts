import { shallowRef, type ShallowRef } from "vue";
import type { CapabilityEventInput } from "@/config/types";

/** One recorded event, as the feed renders it. */
export interface CapabilityEvent {
  /** Monotonic within one log. Distinct even when two land in the same ms. */
  id: number;
  /** `Date.now()` at the moment it was recorded. */
  at: number;
  /** Which capability reported it, bound by `buildCapabilityConfig`. */
  capabilityId: string;
  handler: string;
  summary: string;
  origin: "local" | "remote";
  payload: unknown;
}

/**
 * How many events the feed keeps. A session left open all afternoon would
 * otherwise grow without bound, and nobody scrolls past a few screens.
 */
export const EVENT_LOG_LIMIT = 200;

export interface EventLog {
  /**
   * Newest first — the order the pane renders.
   *
   * Shallow: every write replaces the whole array, so nothing is lost by not
   * proxying inside it, and `payload` reaches a reader as the object the SDK
   * handed the handler rather than a reactive copy of it.
   */
  events: ShallowRef<CapabilityEvent[]>;
  record: (capabilityId: string, event: CapabilityEventInput) => void;
  clear: () => void;
}

/**
 * The drawer's event feed.
 *
 * Held here rather than inside the config a capability builds: the config is
 * rebuilt on every control change, so a log living in it would reset each time
 * — and watching a toggle wipe the record of what the toggle just did is the
 * opposite of what the tab is for.
 */
export function useEventLog(): EventLog {
  const events = shallowRef<CapabilityEvent[]>([]);
  let nextId = 1;

  function record(capabilityId: string, event: CapabilityEventInput): void {
    const entry: CapabilityEvent = {
      id: nextId,
      at: Date.now(),
      capabilityId,
      handler: event.handler,
      summary: event.summary,
      // Everything this playground can produce is local. `origin` is carried
      // rather than assumed so a capability whose contract states one — the
      // comments provider does — reports what the SDK gave it, and a genuine
      // remote event stays distinguishable if a transport ever exists.
      origin: event.origin ?? "local",
      payload: event.payload,
    };
    nextId += 1;
    events.value = [entry, ...events.value].slice(0, EVENT_LOG_LIMIT);
  }

  function clear(): void {
    events.value = [];
  }

  return { events, record, clear };
}
