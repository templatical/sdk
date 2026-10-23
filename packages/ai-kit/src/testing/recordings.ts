import type { AiChatRequest, TemplateContent } from "@templatical/types";
import {
  createButtonBlock,
  createParagraphBlock,
  createTitleBlock,
} from "@templatical/types";
import { walkBlocks } from "../server/content-rules";
import type { AiMockScript, AiRecordedEvent } from "./mock-provider";

const text = (value: string): AiRecordedEvent => ({
  type: "text",
  text: value,
});
const done: AiRecordedEvent = { type: "done", messageId: null };

function firstOfType(
  content: TemplateContent,
  type: string,
): { id: string } | undefined {
  return walkBlocks(content.blocks).find((block) => block.type === type) as
    { id: string } | undefined;
}

function lastTopLevelId(content: TemplateContent): string | null {
  return content.blocks.at(-1)?.id ?? null;
}

/**
 * Scripted turns for any template: the playground's AI scene and the
 * conformance suite's self-test play them. Chat answers "dark", "title" and
 * "fail" specially and otherwise adds a closing paragraph.
 */
export const AI_RECORDINGS: AiMockScript = {
  delayMs: 40,
  chatAttachments: true,
  chat: [
    {
      match: /attached design/i,
      events: (request) => [
        text("Built the email from your design."),
        {
          type: "operations",
          ops: [
            {
              op: "setContent",
              content: {
                blocks: [
                  createTitleBlock({
                    content: "<p>Built from your design</p>",
                  }),
                  createParagraphBlock({
                    content: "<p>A short introduction, as in the image.</p>",
                  }),
                  createButtonBlock({
                    text: "Learn more",
                    url: "https://example.com",
                  }),
                ],
                settings: request.content.settings,
              },
            },
          ],
        },
        text(" Pictures are placeholders."),
        done,
      ],
    },
    {
      match: /fail|error/i,
      events: [
        text("Let me try that."),
        {
          type: "error",
          code: "ai_provider_error",
          message: "AI is unavailable right now. Try again later.",
        },
      ],
    },
    {
      match: /dark/i,
      events: [
        text("Switching the email to a dark background."),
        {
          type: "operations",
          ops: [
            {
              op: "updateSettings",
              set: { backgroundColor: "#111827", textColor: "#f9fafb" },
            },
          ],
        },
        text(" Done: a dark background with light text."),
        done,
      ],
    },
    {
      match: /title|headline|heading/i,
      events: (request: AiChatRequest) => {
        const title = firstOfType(request.content, "title");
        return title
          ? [
              text("Updating the title."),
              {
                type: "operations",
                ops: [
                  {
                    op: "updateBlock",
                    blockId: title.id,
                    set: { content: "<p>Hello there</p>" },
                  },
                ],
              },
              text(" It now reads “Hello there”."),
              done,
            ]
          : [text("This template has no title to change."), done];
      },
    },
    {
      events: (request: AiChatRequest) => [
        text("Adding a closing line at the end."),
        {
          type: "operations",
          ops: [
            {
              op: "addBlock",
              block: createParagraphBlock({
                content: "<p>Thanks for reading. See you next week.</p>",
              }),
              parent: null,
              after: lastTopLevelId(request.content),
            },
          ],
        },
        text(" I added it below the last block."),
        done,
      ],
    },
  ],
  fixFinding: (request) => {
    const target = request.finding.blockId;
    const block = target
      ? walkBlocks(request.content.blocks).find(
          (candidate) => candidate.id === target,
        )
      : undefined;
    const label =
      request.finding.ruleId === "a11y.link-vague-text"
        ? "Read the March update"
        : request.finding.ruleId === "deliverability.link-text-domain-mismatch"
          ? "Visit Acme"
          : null;
    if (
      label &&
      block &&
      (block.type === "paragraph" || block.type === "title")
    ) {
      return [
        text("Updating the link text."),
        {
          type: "operations",
          ops: [
            {
              op: "updateBlock",
              blockId: target as string,
              set: {
                content: (block.content as string).replace(
                  /(<a\b[^>]*>)[\s\S]*?(<\/a>)/i,
                  `$1${label}$2`,
                ),
              },
            },
          ],
        },
        text(" Fixed."),
        done,
      ];
    }
    return block && (block.type === "paragraph" || block.type === "title")
      ? [
          text("Shortening that block."),
          {
            type: "operations",
            ops: [
              {
                op: "updateBlock",
                blockId: target as string,
                set: { content: "<p>A shorter, clearer line.</p>" },
              },
            ],
          },
          text(" Fixed."),
          done,
        ]
      : [
          text("Adding a preheader."),
          {
            type: "operations",
            ops: [
              {
                op: "updateSettings",
                set: { preheaderText: "Your update from Acme" },
              },
            ],
          },
          text(" Fixed."),
          done,
        ];
  },
  altText: (request) => [
    { type: "done", alt: "Shop new arrivals".slice(0, request.maxLength) },
  ],
  rewrite: (request) => {
    const html = request.html.replace(/^(<p[^>]*>)/, "$1✨ ");
    return [text("✨ "), text("Rewritten"), { type: "done", html }];
  },
};
