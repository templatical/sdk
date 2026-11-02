import {
  aiErrorResponse,
  aiJsonResponse,
  readTranslationRequest,
  translateFields,
  type AiModelAdapter,
} from "@templatical/ai-kit/server";

// Mount at POST /templates/{template}/translate after authentication and authorization.
export async function handleTranslation(
  request: Request,
  model: AiModelAdapter,
): Promise<Response> {
  try {
    const body = await readTranslationRequest(request);
    const result = await translateFields({
      request: body,
      model,
      signal: request.signal,
    });
    return aiJsonResponse(result);
  } catch (error) {
    if (
      request.signal.aborted ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;
    return aiErrorResponse(error);
  }
}
