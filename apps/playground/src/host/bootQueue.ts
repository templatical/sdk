/**
 * Serializes scene boots so generation N+1 starts only after N has finished
 * (and unmounted its own instance if it went stale). Callers must tear down
 * with `editor.unmount()`, never the package's last-instance `unmount()`.
 */
export function createSerializedBoot(): {
  enqueue: (run: (isCurrent: () => boolean) => Promise<void>) => Promise<void>;
  invalidate: () => void;
} {
  let gen = 0;
  let tail = Promise.resolve();

  function invalidate(): void {
    gen += 1;
  }

  function enqueue(
    run: (isCurrent: () => boolean) => Promise<void>,
  ): Promise<void> {
    const thisGen = ++gen;
    const isCurrent = () => thisGen === gen;
    const job = tail.then(() => run(isCurrent));
    tail = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  }

  return { enqueue, invalidate };
}
