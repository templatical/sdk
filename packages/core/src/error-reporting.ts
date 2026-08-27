/**
 * Turn a thrown value into an `Error`.
 *
 * A `catch` clause's binding is `unknown` — a provider or a consumer's event
 * handler can throw a string, an object, or anything else. `onError` callbacks
 * across this package are typed to take an `Error`, so this is what makes that
 * contract honest at the one place values actually cross it.
 */
export function wrapReportedError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(String(error), { cause: error });
}

/**
 * Run a consumer's event handler without letting it fail the operation it
 * followed.
 *
 * A handler that throws must not turn a completed write into a rejected one —
 * the caller has already succeeded by the time this runs. `onError` is taken
 * as a parameter rather than read from a shared reporter, so every feature
 * module keeps its own `options.onError` wiring and this stays reusable by
 * any module with the same fire-and-forget event shape.
 */
export function notifyHandler(
  onError: ((error: Error) => void) | undefined,
  run: () => void,
): void {
  try {
    run();
  } catch (error) {
    onError?.(wrapReportedError(error));
  }
}
