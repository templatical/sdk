import { createLocalStorageSavedBlocksProvider } from "@templatical/core";
import type {
  DisplayConditionsConfig,
  LogicTagsConfig,
  MergeTag,
} from "@templatical/types";
import {
  createProductLaunchTemplate,
  templates,
  testimonialBlock,
} from "../../templates";
import type { Scene } from "../types";

const SAVED_BLOCKS_KEY = "templatical:saved-blocks:launchpad-launch";

const MERGE_TAGS: MergeTag[] = [
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
    label: "Account ID",
    value: "{{account_id}}",
    sample: "AC-4815162342",
    group: "Account",
    description: "Internal billing account identifier",
  },
  {
    label: "Plan Name",
    value: "{{plan_name}}",
    sample: "Pro",
    group: "Account",
    description: "Subscription tier label",
  },
  {
    label: "Order ID",
    value: "{{order_id}}",
    sample: "TPL-90210",
    group: "Order",
    description: "Order reference for support follow-up",
  },
  {
    label: "Order Total",
    value: "{{order_total}}",
    sample: "$148.00",
    group: "Order",
    description: "Final amount including taxes and shipping",
  },
  {
    label: "Shipping Method",
    value: "{{shipping_method}}",
    sample: "Express (2 days)",
    group: "Order",
    description: "Carrier name and service level",
  },
  {
    label: "Estimated Delivery",
    value: "{{estimated_delivery}}",
    sample: "Thursday, 6 August",
    group: "Order",
    description: "Expected delivery date for the order",
  },
  {
    label: "Tracking URL",
    value: "{{tracking_url}}",
    sample: "https://track.example.com/TPL-90210",
    group: "Order",
    description: "Carrier tracking link for the recipient",
  },
  {
    label: "Unsubscribe URL",
    value: "{{unsubscribe_url}}",
    sample: "https://example.com/unsubscribe",
    group: "System",
    description: "Required by anti-spam legislation",
  },
  {
    label: "Preferences URL",
    value: "{{preferences_url}}",
    group: "System",
    description: "Lets recipients update notification settings",
  },
  {
    label: "Current Date",
    value: "{{current_date}}",
    group: "System",
    description: "Send-time stamp, useful in legal footers",
  },
];

const LOGIC_TAGS: LogicTagsConfig = {
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
    {
      label: "Continue",
      value: "{% continue %}",
      group: "Loops",
      description: "Skip to the next iteration",
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

const DISPLAY_CONDITIONS: DisplayConditionsConfig = {
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
    {
      label: "Enterprise",
      before: '{% if plan == "enterprise" %}',
      after: "{% endif %}",
      group: "Audience",
      description: "Show only to enterprise accounts",
    },
    {
      label: "Beta Testers",
      before: "{% if beta_tester %}",
      after: "{% endif %}",
      group: "Audience",
      description: "Show only to users in the beta program",
    },
    {
      label: "Early Bird",
      before: "{% if early_bird %}",
      after: "{% endif %}",
      group: "Registration",
      description: "Show early bird pricing for early registrants",
    },
    {
      label: "Speakers",
      before: "{% if is_speaker %}",
      after: "{% endif %}",
      group: "Role",
      description: "Show only to confirmed speakers",
    },
  ],
  allowCustom: true,
};

function seedLaunchpadSavedBlocks(): void {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(SAVED_BLOCKS_KEY) !== null) return;
  const seed = templates.find((t) => t.preview === "product")?.savedBlocks;
  if (!seed?.length) return;
  localStorage.setItem(SAVED_BLOCKS_KEY, JSON.stringify(seed));
}

export const exampleLaunchpadLaunch: Scene = {
  id: "example-launchpad-launch",
  title: "Launchpad launch",
  summary:
    "Composed Product Launch: merge tags, logic tags, display conditions, a testimonial custom block, and saved blocks.",
  catalog: "oss",
  group: "examples",
  docs: "/guide/examples#launchpad-launch",
  content: () => createProductLaunchTemplate(),
  config: () => {
    seedLaunchpadSavedBlocks();
    return {
      mergeTags: { syntax: "liquid" as const, tags: MERGE_TAGS },
      logicTags: LOGIC_TAGS,
      displayConditions: DISPLAY_CONDITIONS,
      customBlocks: [testimonialBlock],
      savedBlocks: createLocalStorageSavedBlocksProvider({
        key: SAVED_BLOCKS_KEY,
      }),
    };
  },
  snippet: `import { init, createLocalStorageSavedBlocksProvider } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  mergeTags: {
    syntax: "liquid",
    tags: [
      { label: "First Name", value: "{{first_name}}", sample: "Ada", group: "Recipient", description: "Personalized greeting at the top of the email" },
      { label: "Last Name", value: "{{last_name}}", group: "Recipient", description: "Recipient family name" },
      { label: "Email", value: "{{email}}", sample: "ada@example.com", group: "Recipient", description: "Primary contact address" },
      { label: "Company", value: "{{company}}", sample: "Analytical Engines Ltd", group: "Account", description: "Recipient organization name" },
      { label: "Plan Name", value: "{{plan_name}}", sample: "Pro", group: "Account", description: "Subscription tier label" },
    ],
  },
  logicTags: {
    tags: [
      { label: "Else", value: "{% else %}", group: "Conditions" },
    ],
    pairs: [
      { label: "If VIP", before: "{% if customer.vip %}", after: "{% endif %}", group: "Conditions" },
    ],
  },
  displayConditions: {
    conditions: [
      { label: "VIP Partners", before: "{% if vip_partner %}", after: "{% endif %}", group: "Audience" },
      { label: "Free Users", before: '{% if plan == "free" %}', after: "{% endif %}", group: "Audience" },
    ],
    allowCustom: true,
  },
  customBlocks: [
    {
      type: "testimonial",
      name: "Testimonial",
      fields: [
        { type: "textarea", key: "quote", label: "Quote", required: true },
        { type: "text", key: "authorName", label: "Author Name", required: true },
        { type: "text", key: "authorTitle", label: "Author Title" },
      ],
      template: "<div>{{ quote }} — {{ authorName }}</div>",
    },
  ],
  savedBlocks: createLocalStorageSavedBlocksProvider({
    key: "templatical:saved-blocks:launchpad-launch",
  }),
});`,
};
