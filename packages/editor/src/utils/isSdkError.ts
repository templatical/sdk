/** SDK errors cross bundles, so their constructor identity is not shared. */
export function isSdkError(error: unknown): error is Error & {
  statusCode: number;
  code?: string;
  details?: Record<string, unknown>;
} {
  if (!(error instanceof Error)) return false;
  const shaped = error as Error & {
    statusCode?: unknown;
    code?: unknown;
    details?: unknown;
  };
  return (
    typeof shaped.statusCode === "number" &&
    (shaped.code === undefined || typeof shaped.code === "string") &&
    (shaped.details === undefined ||
      (typeof shaped.details === "object" && shaped.details !== null))
  );
}
