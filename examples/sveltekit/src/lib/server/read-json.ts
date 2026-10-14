import { error } from "@sveltejs/kit";

/**
 * The request body as JSON, or null when it is not JSON. adapter-node fails the
 * read of a body larger than BODY_SIZE_LIMIT (512K by default), and that
 * answers 413 with a message naming the setting, not a 400 blaming the body.
 */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (cause) {
    if (typeof cause === "object" && cause !== null && "status" in cause && cause.status === 413) {
      error(413, "The request body is larger than BODY_SIZE_LIMIT allows (512K by default).");
    }
    return null;
  }
}
