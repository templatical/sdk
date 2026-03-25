export class EventEmitter<
  TEvents extends Record<string, unknown> = Record<string, unknown>,
> {
  private handlers = new Map<keyof TEvents, Set<(data: never) => void>>();

  on<K extends keyof TEvents>(
    event: K,
    handler: (data: TEvents[K]) => void,
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    const set = this.handlers.get(event)!;
    set.add(handler as (data: never) => void);

    return () => {
      set.delete(handler as (data: never) => void);
      if (set.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  off<K extends keyof TEvents>(
    event: K,
    handler: (data: TEvents[K]) => void,
  ): void {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }

    set.delete(handler as (data: never) => void);
    if (set.size === 0) {
      this.handlers.delete(event);
    }
  }

  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }

    // Copy to avoid issues with handlers modifying the set during iteration
    for (const handler of [...set]) {
      handler(data as never);
    }
  }

  removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  listenerCount(event: keyof TEvents): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}
