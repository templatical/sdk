import type {
  CustomBlockDefinition,
  DisplayConditionsConfig,
  LogicTagsConfig,
  MergeTag,
  PreviewResolveContext,
  TemplateContent,
} from "@templatical/types";
import {
  createCustomBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
} from "@templatical/types";
import { createProductLaunchTemplate } from "../../templates";

/** Quiet merge-tag list: grouped, partly sampled, first-tag description is load-bearing for e2e. */
export const AUTHOR_MERGE_TAGS: MergeTag[] = [
  {
    label: "First Name",
    value: "{{first_name}}",
    sample: "Ada",
    group: "Recipient",
    description: "Personalized greeting at the top of the email",
  },
  {
    label: "Last Name",
    value: "{{last_name}}",
    group: "Recipient",
    description: "Recipient family name",
  },
  {
    label: "Email",
    value: "{{email}}",
    sample: "ada@example.com",
    group: "Recipient",
    description: "Primary contact address",
  },
  {
    label: "Company",
    value: "{{company}}",
    sample: "Analytical Engines Ltd",
    group: "Account",
    description: "Recipient organization name",
  },
  {
    label: "Plan Name",
    value: "{{plan_name}}",
    sample: "Pro",
    group: "Account",
    description: "Subscription tier label",
  },
  {
    label: "Unsubscribe URL",
    value: "{{unsubscribe_url}}",
    sample: "https://example.com/unsubscribe",
    group: "System",
    description: "Required by anti-spam legislation",
  },
];

export const AUTHOR_LOGIC_TAGS: LogicTagsConfig = {
  tags: [
    {
      label: "Else",
      value: "{% else %}",
      group: "Conditions",
      description: "Alternate branch for the current condition",
    },
    {
      label: "Break",
      value: "{% break %}",
      group: "Loops",
      description: "Stop the loop early",
    },
  ],
  pairs: [
    {
      label: "If VIP",
      before: "{% if customer.vip %}",
      after: "{% endif %}",
      group: "Conditions",
      description: "Show the wrapped content only to VIP customers",
    },
    {
      label: "Loop items",
      before: "{% for item in order.items %}",
      after: "{% endfor %}",
      group: "Loops",
      description: "Repeat the wrapped content for each order line item",
    },
  ],
};

export const AUTHOR_DISPLAY_CONDITIONS: DisplayConditionsConfig = {
  conditions: [
    {
      label: "VIP Partners",
      before: "{% if vip_partner %}",
      after: "{% endif %}",
      group: "Audience",
      description: "Show only to VIP partner accounts",
    },
    {
      label: "Free Users",
      before: '{% if plan == "free" %}',
      after: "{% endif %}",
      group: "Audience",
      description: "Show only to free plan users",
    },
  ],
  allowCustom: true,
};

export const AUTHOR_TESTIMONIAL: CustomBlockDefinition = {
  type: "testimonial",
  name: "Testimonial",
  fields: [
    {
      type: "textarea",
      key: "quote",
      label: "Quote",
      required: true,
      default: "Quiet quote for the custom-blocks scene.",
    },
    {
      type: "text",
      key: "authorName",
      label: "Author Name",
      required: true,
      default: "Ada Lovelace",
    },
  ],
  template: "<div>{{ quote }} — {{ authorName }}</div>",
};

export function emptyCanvas(locale = "en"): TemplateContent {
  return createDefaultTemplateContent(undefined, { locale });
}

const MERGE_TAG_SPAN = /<span data-merge-tag="[^"]*">[^<]*<\/span>/g;

/**
 * The Launchpad email reduced to plain blocks, for setup scenes that act on a
 * finished template but register none of its features. The testimonial
 * custom block and the display-conditioned rows are dropped (a scene that
 * does not register them renders them broken) and the greeting's merge tag
 * becomes plain text.
 */
export function setupBaseCanvas(): TemplateContent {
  const content = createProductLaunchTemplate();
  content.blocks = content.blocks
    .filter((block) => block.type !== "custom" && !block.displayCondition)
    .map((block) =>
      block.type === "paragraph"
        ? { ...block, content: block.content.replace(MERGE_TAG_SPAN, "there") }
        : block,
    );
  return content;
}

/**
 * The base email with two real findings planted so the Issues tab opens with
 * work in it: the hero image loses its alt text (error) and the first button
 * says "Click here" (warning).
 */
export function issuesCanvas(): TemplateContent {
  const content = setupBaseCanvas();
  let plantedLabel = false;
  content.blocks = content.blocks.map((block) => {
    if (block.type === "image") return { ...block, alt: "" };
    if (block.type === "button" && !plantedLabel) {
      plantedLabel = true;
      return { ...block, text: "Click here" };
    }
    return block;
  });
  return content;
}

export function paragraphCanvas(html = "<p>Hello.</p>"): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = [
    createTitleBlock({ content: "<p>Greeting</p>", level: 2 }),
    createParagraphBlock({ content: html }),
  ];
  return content;
}

export function samplesCanvas(): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = [
    createParagraphBlock({
      content:
        '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span> <span data-merge-tag="{{last_name}}">Last Name</span>.</p>',
    }),
    createParagraphBlock({
      content:
        "<p><strong>Delivery contact</strong></p>" +
        "<p>{{first_name}} {{last_name}} — {{customer_tier}} member. " +
        '<a href="{{unsubscribe_url}}">Manage notifications</a></p>',
    }),
  ];
  return content;
}

export function resolvePreviewCanvas(): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = [
    createParagraphBlock({
      content:
        '<p>Hello, <span data-merge-tag="{{first_name}}">First Name</span>.</p>',
    }),
    createParagraphBlock({
      content:
        '<p><span data-logic-merge-tag="{% if plan_name == \'pro\' %}" data-logic-type="open"></span><strong>Pro tip</strong>: advanced integrations are on.<span data-logic-merge-tag="{% endif %}" data-logic-type="close"></span><span data-logic-merge-tag="{% if plan_name == \'free\' %}" data-logic-type="open"></span>Want more features? Upgrade to Pro.<span data-logic-merge-tag="{% endif %}" data-logic-type="close"></span></p>',
    }),
  ];
  return content;
}

export function logicCanvas(): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = [
    createParagraphBlock({
      content:
        '<p><span data-logic-merge-tag="{% if customer.vip %}" data-logic-type="open"></span>VIP copy<span data-logic-merge-tag="{% endif %}" data-logic-type="close"></span></p>',
    }),
  ];
  return content;
}

export function displayConditionCanvas(): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = [
    createParagraphBlock({ content: "<p>Audience block.</p>" }),
    createParagraphBlock({ content: "<p>Always visible.</p>" }),
  ];
  return content;
}

export function customBlockCanvas(): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = [createCustomBlock(AUTHOR_TESTIMONIAL)];
  return content;
}

/**
 * Consumer-owned merge-tag chooser. Mounts on `document.body` so it stays
 * outside the editor shadow tree — same contract as the leftover App.vue modal.
 */
export function createOnRequestMergeTag(
  tags: MergeTag[],
): () => Promise<MergeTag | null> {
  return () =>
    new Promise((resolve) => {
      document.querySelector("[data-merge-tag-on-request]")?.remove();

      const backdrop = document.createElement("div");
      backdrop.setAttribute("data-merge-tag-on-request", "");
      backdrop.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:10000";

      const finish = (tag: MergeTag | null) => {
        window.removeEventListener("keydown", onKey);
        backdrop.remove();
        resolve(tag);
      };

      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") finish(null);
      };
      window.addEventListener("keydown", onKey);
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) finish(null);
      });

      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("data-testid", "playground-merge-tag-modal");
      dialog.style.cssText =
        "background:#fff;color:#111;min-width:280px;max-height:480px;overflow:auto;padding:12px;border-radius:8px";

      const close = document.createElement("button");
      close.type = "button";
      close.setAttribute("aria-label", "Close");
      close.textContent = "×";
      close.addEventListener("click", () => finish(null));
      dialog.append(close);

      for (const tag of tags) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = tag.label;
        button.addEventListener("click", () => finish(tag));
        dialog.append(button);
      }

      backdrop.append(dialog);
      document.body.append(backdrop);
    });
}

const FAKE_RESOLVE_LATENCY_MS = 400;

const FAKE_RECIPIENTS: Record<string, Record<string, string>> = {
  "you@example.com": { first_name: "Grace", plan_name: "pro" },
  "teammate@example.com": { first_name: "Marie", plan_name: "free" },
};
const FAKE_DEFAULT: Record<string, string> = {
  first_name: "Grace",
  plan_name: "pro",
};

function evaluateLiquidLogic(
  html: string,
  data: Record<string, string>,
): string {
  const IF_BLOCK =
    /<span data-logic-merge-tag="\{%\s*if\s+([^"%]+?)\s*%\}"[^>]*>.*?<\/span>([\s\S]*?)<span data-logic-merge-tag="\{%\s*endif\s*%\}"[^>]*>.*?<\/span>/g;

  return html.replace(IF_BLOCK, (_m, condition: string, body: string) => {
    const QUOTE = "(?:&#0?39;|&#x27;|&quot;|[\"'])?";
    const comparison = condition.match(
      new RegExp(`^([\\w.]+)\\s*(==|!=)\\s*${QUOTE}(.*?)${QUOTE}$`),
    );

    if (comparison) {
      const [, name, op, expected] = comparison;
      const matches = data[name!] === expected;
      return (op === "==" ? matches : !matches) ? body : "";
    }

    return data[condition.trim()] ? body : "";
  });
}

/** Demo resolver: delay + substitute values + evaluate `{% if %}` branches. */
export async function resolvePreviewDemo({
  content,
  recipient,
}: PreviewResolveContext): Promise<TemplateContent> {
  await new Promise((r) => setTimeout(r, FAKE_RESOLVE_LATENCY_MS));

  const data = (recipient && FAKE_RECIPIENTS[recipient]) || FAKE_DEFAULT;

  const resolveHtml = (html: string): string => {
    let out = evaluateLiquidLogic(html, data);
    out = out.replace(
      /<span data-merge-tag="\{\{(\w+)\}\}"[^>]*>.*?<\/span>/g,
      (m, name: string) => data[name] ?? m,
    );
    for (const [key, value] of Object.entries(data)) {
      out = out.split(`{{${key}}}`).join(value);
    }
    return out;
  };

  const walk = (blocks: TemplateContent["blocks"]): TemplateContent["blocks"] =>
    blocks.map((block) => {
      if (block.type === "section") {
        return { ...block, children: block.children.map(walk) };
      }
      if (block.type === "wrapper") {
        return { ...block, children: walk(block.children) };
      }
      if (block.type === "title" || block.type === "paragraph") {
        return { ...block, content: resolveHtml(block.content) };
      }
      return block;
    });

  return { ...content, blocks: walk(content.blocks) };
}
