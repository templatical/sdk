import type { AiDoneEvent } from "../src/wire";

const turn: AiDoneEvent = { type: "done", messageId: null };
const rewrite: AiDoneEvent = { type: "done", html: "<p>Hello</p>" };
// @ts-expect-error A turn cannot omit messageId and provide no other route result.
const missing: AiDoneEvent = { type: "done" };
void [turn, rewrite, missing];
