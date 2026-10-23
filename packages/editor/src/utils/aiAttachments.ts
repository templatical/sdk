/** Chat file limits, matching the AI wire. */
export const AI_ATTACHMENTS_MAX = 4;
export const AI_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const AI_ATTACHMENTS_TOTAL_MAX_BYTES = 10 * 1024 * 1024;
const TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);
export function validateChatAttachments(
  existing: File[],
  added: File[],
): {
  accepted: File[];
  errors: {
    name: string;
    reason: "tooMany" | "tooLarge" | "totalTooLarge" | "wrongType";
  }[];
} {
  const accepted = [...existing];
  const errors: ReturnType<typeof validateChatAttachments>["errors"] = [];
  let total = existing.reduce((sum, file) => sum + file.size, 0);
  for (const file of added) {
    const reason =
      accepted.length >= AI_ATTACHMENTS_MAX
        ? "tooMany"
        : !TYPES.has(file.type)
          ? "wrongType"
          : file.size > AI_ATTACHMENT_MAX_BYTES
            ? "tooLarge"
            : total + file.size > AI_ATTACHMENTS_TOTAL_MAX_BYTES
              ? "totalTooLarge"
              : null;
    if (reason) errors.push({ name: file.name, reason });
    else {
      accepted.push(file);
      total += file.size;
    }
  }
  return { accepted, errors };
}
