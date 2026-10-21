import type { AiChatMessage, AiMessageKind, Operation, TemplateContent } from "../../src";
import { AI_ERROR_MESSAGES, CollaborationConflict, SdkError } from "../../src";
import { invertOperations } from "@templatical/types";
import {
  aiErrorResponse,
  aiEventStream,
  aiJsonResponse,
  blockIds,
  buildChatRequest,
  buildDesignRequest,
  buildFixRequest,
  buildRewritePrompt,
  buildRewriteRepairPrompt,
  buildScorePrompt,
  buildSuggestionsPrompt,
  checkRewrite,
  editingInstructions,
  normalizeScoringResult,
  parseSuggestions,
  readAiRequest,
  rewriteInstructions,
  runEditingTurn,
  scoreInstructions,
  suggestionsInstructions,
  type AiModelAdapter,
} from "../../src/server";

/** One adapter for every route: it answers by the system prompt it gets. */
export function referenceModel(): AiModelAdapter {
  return {
    async *stream({ system, messages, signal }) {
      signal?.throwIfAborted();
      if (system === editingInstructions) {
        if (messages.at(-1)?.role === "tool") {
          yield { type: "text", text: " The background is light grey now." };
          return;
        }
        yield { type: "text", text: "Making the background light grey." };
        yield {
          type: "tool-call",
          id: "c1",
          name: "apply_operations",
          input: {
            ops: JSON.stringify([
              { op: "updateSettings", set: { backgroundColor: "#f3f4f6" } },
            ]),
          },
        };
        yield { type: "usage", inputTokens: 10, outputTokens: 5 };
        return;
      }
      if (system === rewriteInstructions) {
        yield { type: "text", text: "<p>Hello " };
        yield { type: "text", text: "there.</p>" };
        return;
      }
      if (system === scoreInstructions) {
        yield {
          type: "text",
          text: JSON.stringify({
            score: 82,
            categories: {
              spam: { score: 90, findings: [] },
              readability: {
                score: 75,
                findings: [
                  {
                    id: "r1",
                    severity: "medium",
                    message: "The intro is long.",
                    blockId: "intro",
                    suggestion: "Shorten it.",
                  },
                ],
              },
              bestPractices: { score: 80, findings: [] },
            },
          }),
        };
        return;
      }
      if (system === suggestionsInstructions) {
        yield {
          type: "text",
          text: '{"suggestions":["Shorten the intro","Add a second button"]}',
        };
      }
    },
  };
}

interface Stored {
  message: AiChatMessage;
  /** The turn's inverse, last batch first. */
  inverse: Operation[];
  /** The template after the turn, for Redo's guarded batch. */
  after: TemplateContent | null;
}

async function textOf(
  model: AiModelAdapter,
  system: string,
  prompt: string,
  signal: AbortSignal,
  onText?: (text: string) => void,
): Promise<string> {
  let output = "";
  for await (const part of model.stream({
    system,
    messages: [{ role: "user", content: prompt }],
    tools: [],
    signal,
  })) {
    if (part.type === "text") {
      output += part.text;
      onText?.(part.text);
    }
  }
  return output;
}

/** A complete wire backend (A1 §4) from the kit, with history in memory. */
export function createReferenceHandler(
  model: AiModelAdapter = referenceModel(),
): (request: Request) => Promise<Response> {
  const conversations = new Map<string, Stored[]>();
  const pending = new Map<string, { template: string; message: string; entry: Stored; direction: "undo" | "redo"; sessionId: string | null }>();
  const now = () => new Date().toISOString();

  return async (request) => {
    let read;
    try {
      read = await readAiRequest(request);
    } catch (error) {
      return aiErrorResponse(error);
    }
    if (!read) return aiJsonResponse({ message: "Not found.", code: "not_found" }, 404);
    const history = conversations.get(read.template) ?? [];
    conversations.set(read.template, history);

    switch (read.route) {
      case "generate":
      case "fixFinding":
      case "generateFromDesign": {
        const turn = read;
        const kind: AiMessageKind =
          turn.route === "generate" ? "chat" : turn.route === "fixFinding" ? "fix" : "design";
        const requestText =
          turn.route === "generate"
            ? buildChatRequest(turn.body.message)
            : turn.route === "fixFinding"
              ? buildFixRequest(turn.body.finding)
              : buildDesignRequest(turn.body.prompt);
        const userText =
          turn.route === "generate"
            ? turn.body.message
            : turn.route === "fixFinding"
              ? `Fix: ${turn.body.finding.message}`
              : `Built from design${turn.body.prompt ? `\n${turn.body.prompt}` : ""}`;
        return aiEventStream(async (stream) => {
          const result = await runEditingTurn({
            request: {
              content: turn.body.content,
              revision: turn.body.revision,
              mergeTags: turn.body.mergeTags,
              selectedBlockId: turn.route === "generate" ? turn.body.selectedBlockId : null,
              request: requestText,
              sessionId: turn.sessionId,
              ...(turn.route === "generateFromDesign"
                ? {
                    attachments: [
                      {
                        kind: turn.body.fileKind,
                        mediaType: turn.body.file.type,
                        data: turn.body.file,
                      },
                    ],
                  }
                : {}),
            },
            model,
            write: stream.send,
            signal: stream.signal,
          });
          history.push({
            message: {
              id: crypto.randomUUID(),
              role: "user",
              kind,
              text: userText,
              batches: [],
              undone: false,
              createdAt: now(),
            },
            inverse: [],
            after: null,
          });
          const assistant: AiChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            kind,
            text: result.text,
            // The editor applied these itself: no backend revision.
            batches: result.batches.map((batch) => ({
              batchId: crypto.randomUUID(),
              revision: null,
              operationCount: batch.ops.length,
            })),
            undone: false,
            createdAt: now(),
          };
          history.push({
            message: assistant,
            inverse: [...result.batches].reverse().flatMap((batch) => batch.inverse),
            after: result.content,
          });
          stream.send({ type: "done", messageId: assistant.id });
        });
      }
      case "rewriteText": {
        const body = read.body;
        const prompt = buildRewritePrompt(body);
        return aiEventStream(async (stream) => {
          let check = checkRewrite(
            await textOf(model, rewriteInstructions, prompt, stream.signal, (text) =>
              stream.send({ type: "text", text }),
            ),
            body.html,
            body.mergeTags,
          );
          if (!check.ok) {
            check = checkRewrite(
              await textOf(
                model,
                rewriteInstructions,
                buildRewriteRepairPrompt(prompt, check.reason),
                stream.signal,
              ),
              body.html,
              body.mergeTags,
            );
          }
          if (!check.ok) {
            throw new SdkError(AI_ERROR_MESSAGES.ai_output_invalid, 422, "ai_output_invalid");
          }
          stream.send({ type: "done", html: check.html });
        });
      }
      case "score": {
        const body = read.body;
        return aiEventStream(async (stream) => {
          const answer = await textOf(model, scoreInstructions, buildScorePrompt(body), stream.signal);
          stream.send({
            type: "done",
            result: normalizeScoringResult(answer, blockIds(body.content.blocks)),
          });
        });
      }
      case "suggestions": {
        const body = read.body;
        return aiEventStream(async (stream) => {
          const answer = await textOf(
            model,
            suggestionsInstructions,
            buildSuggestionsPrompt(body),
            stream.signal,
          );
          stream.send({ type: "done", suggestions: parseSuggestions(answer) });
        });
      }
      case "conversationMessages":
        return aiJsonResponse({ data: history.map((entry) => entry.message) });
      case "clearConversation":
        conversations.delete(read.template);
        for (const [id, replay] of pending) if (replay.template === read.template) pending.delete(id);
        return aiJsonResponse(null, 204);
      case "settleReplay": {
        const replay = pending.get(read.replayId);
        if (replay && replay.template === read.template && replay.message === read.message && replay.direction === read.body.direction && replay.sessionId === read.sessionId) {
          pending.delete(read.replayId);
          if (read.body.applied) replay.entry.message.undone = read.body.direction === "undo";
        }
        return aiJsonResponse(null, 204);
      }
      case "undoMessage":
      case "redoMessage": {
        const undo = read.route === "undoMessage";
        const entry = history.find(
          (stored) => stored.message.id === read.message && stored.message.role === "assistant",
        );
        if (!entry) {
          return aiErrorResponse(
            new SdkError("That message isn't in this conversation.", 404, "not_found"),
          );
        }
        if (entry.inverse.length === 0 || entry.after === null || entry.message.undone === undo) {
          return aiErrorResponse(
            new CollaborationConflict(
              undo ? "This change is already undone." : "This change isn't undone.",
              { code: "precondition_failed" },
            ),
          );
        }
        const replayId = crypto.randomUUID();
        pending.set(replayId, { template: read.template, message: read.message, entry, direction: undo ? "undo" : "redo", sessionId: read.sessionId });
        // Redo is the inverse of the Undo batch, so it is guarded too (D13).
        const operations = undo ? entry.inverse : invertOperations(entry.after, entry.inverse);
        return aiJsonResponse({ data: { operations, replayId } });
      }
    }
  };
}
