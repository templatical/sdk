import {
  computed,
  ref,
  shallowRef,
  type ComputedRef,
  type ShallowRef,
} from "vue";
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
  /**
   * Events recorded since the last {@link markRead} (or since the log was
   * created, if it never has been). Counted against the newest read event's
   * id rather than decremented on every read: the log is capped at
   * {@link EVENT_LOG_LIMIT}, so old entries are dropped from `events`, and a
   * counter that ticks down per read would go negative the moment the cap
   * starts discarding events nobody ever marked read.
   */
  unreadCount: ComputedRef<number>;
  record: (capabilityId: string, event: CapabilityEventInput) => void;
  /** Marks every event recorded so far as read. */
  markRead: () => void;
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

  // The id of the newest event the reader has seen. `0` is lower than every
  // real id (`nextId` starts at 1), so a log nobody has ever read counts all
  // of it as unread.
  const lastReadId = ref(0);

  const unreadCount = computed(
    () => events.value.filter((event) => event.id > lastReadId.value).length,
  );

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

  /** The newest event at the moment of the call becomes the read watermark. */
  function markRead(): void {
    lastReadId.value = events.value[0]?.id ?? lastReadId.value;
  }

  function clear(): void {
    events.value = [];
    // Nothing left to be unread about. Without this, a watermark set below
    // `nextId` before the clear would count every future event again from a
    // log that looks empty to the reader.
    lastReadId.value = nextId - 1;
  }

  return { events, unreadCount, record, markRead, clear };
}
