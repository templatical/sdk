import type {
  TemplateContent,
  CustomBlockDefinition,
} from "@templatical/types";
import {
  createTextBlock,
  createImageBlock,
  createButtonBlock,
  createCustomBlock,
  createDividerBlock,
  createSectionBlock,
  createMenuBlock,
  createSocialIconsBlock,
  createSpacerBlock,
  createTableBlock,
  generateId,
} from "@templatical/types";

// ─── Helpers ─────────────────────────────────────────────────

const pad = (top: number, right: number, bottom: number, left: number) => ({
  padding: { top, right, bottom, left },
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});

const white = (top = 0, right = 0, bottom = 0, left = 0) => ({
  ...pad(top, right, bottom, left),
  backgroundColor: "#ffffff",
});

/** Simulate a network request with configurable delay */
function _simulateFetch<T>(data: T, delayMs = 1500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), delayMs));
}

// ─── Data Source Picker (global, used by onFetch to open a modal) ─

export interface DataSourcePickerItem {
  id: string;
  label: string;
  description: string;
  thumbnail?: string;
  data: Record<string, unknown>;
}

export interface DataSourcePickerRequest {
  title: string;
  endpoint: string;
  items: DataSourcePickerItem[];
}

type PickerResolver = (item: DataSourcePickerItem | null) => void;

let _pickerOpen: ((request: DataSourcePickerRequest) => void) | null = null;
let _pickerResolver: PickerResolver | null = null;

/** Called by App.vue to register itself as the picker host */
export function registerDataSourcePicker(
  open: (request: DataSourcePickerRequest) => void,
): void {
  _pickerOpen = open;
}

/** Called by onFetch to show the picker modal. Returns the selected item or null. */
function openDataSourcePicker(
  request: DataSourcePickerRequest,
): Promise<DataSourcePickerItem | null> {
  return new Promise((resolve) => {
    _pickerResolver = resolve;
    _pickerOpen?.(request);
  });
}

/** Called by App.vue when user picks an item or cancels */
export function resolveDataSourcePicker(
  item: DataSourcePickerItem | null,
): void {
  _pickerResolver?.(item);
  _pickerResolver = null;
}

// ─── Custom Block Definitions ─────────────────────────────────

export const eventDetailsBlock: CustomBlockDefinition = {
  type: "event-details",
  name: "Event Details",
  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
  description: "Displays event date, time, location, and optional map link",
  fields: [
    {
      type: "text",
      key: "eventName",
      label: "Event Name",
      default: "My Event",
      required: true,
    },
    {
      type: "text",
      key: "date",
      label: "Date",
      default: "April 15, 2026",
      placeholder: "e.g. April 15, 2026",
      required: true,
    },
    {
      type: "text",
      key: "time",
      label: "Time",
      default: "9:00 AM – 6:00 PM",
      placeholder: "e.g. 9:00 AM – 6:00 PM",
      required: true,
    },
    {
      type: "text",
      key: "location",
      label: "Location",
      default: "The Moscone Center, San Francisco",
    },
    { type: "text", key: "mapUrl", label: "Map Link (optional)", default: "" },
    {
      type: "color",
      key: "accentColor",
      label: "Accent Color",
      default: "#7c3aed",
    },
  ],
  template: `<div style="border: 2px solid {{ accentColor }}; border-radius: 8px; padding: 20px; text-align: center;">
  <div style="font-size: 18px; font-weight: bold; color: {{ accentColor }}; margin-bottom: 12px;">{{ eventName }}</div>
  <div style="font-size: 14px; color: #4b5563; margin-bottom: 4px;">\ud83d\udcc5 {{ date }}</div>
  <div style="font-size: 14px; color: #4b5563; margin-bottom: 4px;">\u23f0 {{ time }}</div>
  <div style="font-size: 14px; color: #4b5563;">\ud83d\udccd {{ location }}</div>
  {% if mapUrl %}<div style="margin-top: 12px;"><a href="{{ mapUrl }}" style="color: {{ accentColor }}; font-size: 13px;">View on Map \u2192</a></div>{% endif %}
</div>`,
};

export const pricingCardBlock: CustomBlockDefinition = {
  type: "pricing-card",
  name: "Pricing Card",
  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  description: "Displays a pricing plan with name, price, and features list",
  fields: [
    { type: "text", key: "planName", label: "Plan Name", default: "Pro" },
    { type: "text", key: "price", label: "Price", default: "$29/mo" },
    {
      type: "textarea",
      key: "features",
      label: "Features (one per line)",
      default:
        "Unlimited projects\n10 team members\nPriority support\nCustom integrations",
    },
    {
      type: "color",
      key: "accentColor",
      label: "Accent Color",
      default: "#0d9488",
    },
    {
      type: "boolean",
      key: "highlighted",
      label: "Highlighted",
      default: true,
    },
  ],
  template: `<div style="border: {{ highlighted | if: '2px' | else: '1px' }} solid {{ highlighted | if: accentColor | else: '#e5e7eb' }}; border-radius: 8px; padding: 24px; text-align: center; {{ highlighted | if: 'background-color: #f0fdfa;' }}">
  <div style="font-size: 14px; font-weight: 600; color: {{ accentColor }}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">{{ planName }}</div>
  <div style="font-size: 32px; font-weight: bold; color: #111827; margin-bottom: 16px;">{{ price }}</div>
  <div style="text-align: left; font-size: 14px; color: #4b5563; line-height: 1.8;">{{ features | newline_to_br }}</div>
</div>`,
};

export const testimonialBlock: CustomBlockDefinition = {
  type: "testimonial",
  name: "Testimonial",
  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></svg>',
  description: "Customer quote with name and title",
  fields: [
    {
      type: "textarea",
      key: "quote",
      label: "Quote",
      default:
        "This product completely changed how our team works. We shipped 3x faster in the first month.",
      required: true,
    },
    {
      type: "text",
      key: "authorName",
      label: "Author Name",
      default: "Sarah Chen",
      required: true,
    },
    {
      type: "text",
      key: "authorTitle",
      label: "Author Title",
      default: "Head of Product, Acme Corp",
    },
    {
      type: "image",
      key: "avatarUrl",
      label: "Avatar URL (optional)",
      default: "",
    },
  ],
  template: `<div style="padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 3px solid #d1d5db;">
  <div style="font-size: 15px; color: #374151; font-style: italic; line-height: 1.6; margin-bottom: 12px;">\u201c{{ quote }}\u201d</div>
  <div style="display: flex; align-items: center; gap: 10px;">
    {% if avatarUrl %}<img src="{{ avatarUrl }}" width="36" height="36" style="border-radius: 50%;" />{% endif %}
    <div>
      <div style="font-size: 13px; font-weight: 600; color: #111827;">{{ authorName }}</div>
      <div style="font-size: 12px; color: #6b7280;">{{ authorTitle }}</div>
    </div>
  </div>
</div>`,
};

export const productCardBlock: CustomBlockDefinition = {
  type: "product-card",
  name: "Product Card",
  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  description: "Displays a product with image, name, price, and buy link",
  fields: [
    { type: "image", key: "imageUrl", label: "Product Image", default: "" },
    {
      type: "text",
      key: "name",
      label: "Product Name",
      default: "Product Name",
    },
    {
      type: "text",
      key: "originalPrice",
      label: "Original Price",
      default: "",
    },
    { type: "text", key: "salePrice", label: "Sale Price", default: "$49.99" },
    {
      type: "text",
      key: "badge",
      label: "Badge (optional)",
      default: "",
      placeholder: "e.g. -30%, NEW, HOT",
    },
    {
      type: "text",
      key: "url",
      label: "Product URL",
      default: "https://example.com",
    },
    {
      type: "color",
      key: "badgeColor",
      label: "Badge Color",
      default: "#dc2626",
    },
  ],
  template: `<div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; text-align: center;">
  {% if imageUrl %}<img src="{{ imageUrl }}" width="100%" style="display: block; max-height: 200px; object-fit: cover;" />{% else %}<div style="height: 160px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 13px;">No image</div>{% endif %}
  <div style="padding: 14px;">
    {% if badge %}<span style="display: inline-block; background: {{ badgeColor }}; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-bottom: 8px;">{{ badge }}</span>{% endif %}
    <div style="font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 6px;">{{ name }}</div>
    <div style="font-size: 14px; margin-bottom: 10px;">{% if originalPrice %}<span style="text-decoration: line-through; color: #9ca3af; margin-right: 6px;">{{ originalPrice }}</span>{% endif %}<span style="color: #111827; font-weight: 700;">{{ salePrice }}</span></div>
    <a href="{{ url }}" style="display: inline-block; background: #111827; color: #fff; font-size: 13px; font-weight: 600; padding: 8px 20px; border-radius: 6px; text-decoration: none;">Shop Now</a>
  </div>
</div>`,
};

// ─── NEW: Featured Article (with Data Source) ─────────────────

export const featuredArticleBlock: CustomBlockDefinition = {
  type: "featured-article",
  name: "Featured Article",
  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2m0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6z"/></svg>',
  description: "Fetches article data from your CMS via data source",
  fields: [
    { type: "text", key: "title", label: "Title", default: "", readOnly: true },
    {
      type: "textarea",
      key: "excerpt",
      label: "Excerpt",
      default: "",
      readOnly: true,
    },
    {
      type: "image",
      key: "imageUrl",
      label: "Cover Image",
      default: "",
    },
    {
      type: "text",
      key: "author",
      label: "Author",
      default: "",
      readOnly: true,
    },
    {
      type: "text",
      key: "readTime",
      label: "Read Time",
      default: "",
      readOnly: true,
    },
    {
      type: "text",
      key: "url",
      label: "Article URL",
      default: "",
      readOnly: true,
    },
    {
      type: "select",
      key: "category",
      label: "Category",
      options: [
        { label: "Engineering", value: "engineering" },
        { label: "Design", value: "design" },
        { label: "Product", value: "product" },
      ],
      default: "engineering",
    },
  ],
  template: `<div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
  {% if imageUrl %}<img src="{{ imageUrl }}" width="100%" style="display: block; max-height: 220px; object-fit: cover;" />{% endif %}
  <div style="padding: 20px;">
    <div style="font-size: 20px; font-weight: bold; color: #111827; line-height: 1.3; margin-bottom: 8px;">{{ title }}</div>
    <div style="font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 12px;">{{ excerpt }}</div>
    <div style="font-size: 12px; color: #9ca3af;">{% if author %}By {{ author }}{% endif %}{% if readTime %} &middot; {{ readTime }}{% endif %}</div>
    {% if url %}<div style="margin-top: 12px;"><a href="{{ url }}" style="color: #dc2626; font-size: 14px; font-weight: 600; text-decoration: none;">Read More &rarr;</a></div>{% endif %}
  </div>
</div>`,
  dataSource: {
    label: "Change article",
    onFetch: async (ctx: {
      fieldValues: Record<string, unknown>;
      blockId: string;
    }) => {
      const category = (ctx.fieldValues.category as string) || "engineering";
      const endpoint = `GET https://api.example.com/v1/articles?category=${category}&featured=true&limit=3`;

      const picked = await openDataSourcePicker({
        title: "Select Featured Article",
        endpoint,
        items: [
          {
            id: "article-1",
            label: "Why Most Design Systems Fail",
            description: "By Elena Martinez \u00b7 8 min read",
            thumbnail: "https://placehold.co/80x60/fef2f2/dc2626?text=DS",
            data: {
              title: "Why Most Design Systems Fail (And How to Fix Yours)",
              excerpt:
                "The problem is not the tokens or the components \u2014 it is adoption. After working with 50+ teams, here are the three patterns that separate the design systems people actually use from the ones that collect dust.",
              imageUrl:
                "https://placehold.co/560x280/fef2f2/dc2626?text=Design+Systems",
              author: "Elena Martinez",
              readTime: "8 min read",
              url: "https://example.com/blog/design-systems",
            },
          },
          {
            id: "article-2",
            label: "Ship Fast, Fix Later",
            description: "By James Park \u00b7 5 min read",
            thumbnail: "https://placehold.co/80x60/eff6ff/2563eb?text=SF",
            data: {
              title: "Ship Fast, Fix Later: When Speed Beats Quality",
              excerpt:
                'Every startup says "move fast and break things" but few actually know when to slow down. Here is a practical framework for deciding when shipping speed matters more than polish.',
              imageUrl:
                "https://placehold.co/560x280/eff6ff/2563eb?text=Ship+Fast",
              author: "James Park",
              readTime: "5 min read",
              url: "https://example.com/blog/ship-fast",
            },
          },
          {
            id: "article-3",
            label: "Accessible Color Palettes",
            description: "By Priya Sharma \u00b7 12 min read",
            thumbnail: "https://placehold.co/80x60/ecfdf5/059669?text=A11y",
            data: {
              title: "A Practical Guide to Accessible Color Palettes",
              excerpt:
                "WCAG AA compliance is not optional \u2014 it is a baseline. This guide walks through OKLch-based palette generation that guarantees contrast ratios while keeping your brand colors intact.",
              imageUrl:
                "https://placehold.co/560x280/ecfdf5/059669?text=Color+A11y",
              author: "Priya Sharma",
              readTime: "12 min read",
              url: "https://example.com/blog/accessible-colors",
            },
          },
        ],
      });

      return picked?.data ?? null;
    },
  },
};

// ─── NEW: Product Showcase (Repeatable Fields + Data Source) ──

export const productShowcaseBlock: CustomBlockDefinition = {
  type: "product-showcase",
  name: "Product Showcase",
  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>',
  description: "Fetches trending products from your catalog API",
  fields: [
    {
      type: "text",
      key: "heading",
      label: "Section Heading",
      default: "Trending Now",
    },
    {
      type: "select",
      key: "productCategory",
      label: "Category",
      options: [
        { label: "All", value: "all" },
        { label: "Electronics", value: "electronics" },
        { label: "Apparel", value: "apparel" },
        { label: "Accessories", value: "accessories" },
      ],
      default: "electronics",
    },
    {
      type: "color",
      key: "accentColor",
      label: "Accent Color",
      default: "#dc2626",
    },
    {
      type: "repeatable",
      key: "products",
      label: "Products",
      minItems: 1,
      maxItems: 4,
      fields: [
        { type: "text", key: "name", label: "Name", default: "Product" },
        { type: "text", key: "price", label: "Price", default: "$0" },
        { type: "image", key: "image", label: "Image", default: "" },
        { type: "text", key: "badge", label: "Badge", default: "" },
        {
          type: "text",
          key: "url",
          label: "URL",
          default: "https://example.com",
        },
      ],
      default: [],
    },
  ],
  template: `<div style="text-align: center;">
  <div style="font-size: 20px; font-weight: bold; color: #111827; margin-bottom: 16px;">{{ heading }}</div>
  <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
    {% for product in products %}
    <div style="flex: 1; min-width: 140px; max-width: 180px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; text-align: center;">
      {% if product.image %}<img src="{{ product.image }}" width="100%" style="display: block; height: 120px; object-fit: cover;" />{% else %}<div style="height: 100px; background: #f3f4f6;"></div>{% endif %}
      <div style="padding: 10px;">
        {% if product.badge %}<span style="display: inline-block; background: {{ accentColor }}; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 3px; margin-bottom: 6px;">{{ product.badge }}</span>{% endif %}
        <div style="font-size: 13px; font-weight: 600; color: #111827;">{{ product.name }}</div>
        <div style="font-size: 13px; font-weight: 700; color: #111827; margin-top: 4px;">{{ product.price }}</div>
      </div>
    </div>
    {% endfor %}
  </div>
</div>`,
  dataSource: {
    label: "Change collection",
    onFetch: async (ctx: {
      fieldValues: Record<string, unknown>;
      blockId: string;
    }) => {
      const category =
        (ctx.fieldValues.productCategory as string) || "electronics";
      const endpoint = `GET https://api.example.com/v1/collections?category=${category}&sort=trending`;

      const picked = await openDataSourcePicker({
        title: "Select Product Collection",
        endpoint,
        items: [
          {
            id: "collection-bestsellers",
            label: "Best Sellers",
            description: "3 items \u00b7 Electronics",
            thumbnail: "https://placehold.co/80x60/f3f4f6/6b7280?text=Best",
            data: {
              products: [
                {
                  name: "Wireless Pro Max",
                  price: "$99",
                  image:
                    "https://placehold.co/200x160/f3f4f6/6b7280?text=Headphones",
                  badge: "-50%",
                  url: "https://example.com/headphones",
                },
                {
                  name: "Boom Speaker",
                  price: "$59",
                  image:
                    "https://placehold.co/200x160/f3f4f6/6b7280?text=Speaker",
                  badge: "-34%",
                  url: "https://example.com/speaker",
                },
                {
                  name: "Chrono Smart",
                  price: "$249",
                  image:
                    "https://placehold.co/200x160/f3f4f6/6b7280?text=Watch",
                  badge: "NEW",
                  url: "https://example.com/watch",
                },
              ],
            },
          },
          {
            id: "collection-new-arrivals",
            label: "New Arrivals",
            description: "3 items \u00b7 Fresh drops",
            thumbnail: "https://placehold.co/80x60/eff6ff/2563eb?text=New",
            data: {
              products: [
                {
                  name: "AirPods Ultra",
                  price: "$179",
                  image:
                    "https://placehold.co/200x160/f3f4f6/6b7280?text=AirPods",
                  badge: "NEW",
                  url: "https://example.com/airpods",
                },
                {
                  name: "Smart Ring",
                  price: "$299",
                  image: "https://placehold.co/200x160/f3f4f6/6b7280?text=Ring",
                  badge: "NEW",
                  url: "https://example.com/ring",
                },
                {
                  name: "Nano Charger",
                  price: "$39",
                  image:
                    "https://placehold.co/200x160/f3f4f6/6b7280?text=Charger",
                  badge: "",
                  url: "https://example.com/charger",
                },
              ],
            },
          },
          {
            id: "collection-clearance",
            label: "Clearance Sale",
            description: "3 items \u00b7 Up to 60% off",
            thumbnail: "https://placehold.co/80x60/fef2f2/dc2626?text=Sale",
            data: {
              products: [
                {
                  name: "Classic Buds",
                  price: "$29",
                  image: "https://placehold.co/200x160/f3f4f6/6b7280?text=Buds",
                  badge: "-60%",
                  url: "https://example.com/buds",
                },
                {
                  name: "Travel Case",
                  price: "$15",
                  image: "https://placehold.co/200x160/f3f4f6/6b7280?text=Case",
                  badge: "-40%",
                  url: "https://example.com/case",
                },
                {
                  name: "USB Hub Pro",
                  price: "$19",
                  image: "https://placehold.co/200x160/f3f4f6/6b7280?text=Hub",
                  badge: "-55%",
                  url: "https://example.com/hub",
                },
              ],
            },
          },
        ],
      });

      return picked?.data ?? null;
    },
  },
};

// ─── NEW: Stats Row (with Data Source) ────────────────────────

export const shippingTrackerBlock: CustomBlockDefinition = {
  type: "shipping-tracker",
  name: "Shipping Tracker",
  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
  description: "Displays shipping status with carrier info and tracking link",
  fields: [
    {
      type: "select",
      key: "status",
      label: "Status",
      options: [
        { label: "Order Placed", value: "placed" },
        { label: "Shipped", value: "shipped" },
        { label: "In Transit", value: "transit" },
        { label: "Delivered", value: "delivered" },
      ],
      default: "shipped",
    },
    {
      type: "text",
      key: "carrier",
      label: "Carrier",
      default: "FedEx",
      readOnly: true,
    },
    {
      type: "text",
      key: "trackingNumber",
      label: "Tracking Number",
      default: "7489 2034 8561",
      readOnly: true,
    },
    {
      type: "text",
      key: "estimatedDelivery",
      label: "Estimated Delivery",
      default: "{{estimated_delivery}}",
      readOnly: true,
    },
    {
      type: "text",
      key: "trackingUrl",
      label: "Tracking URL",
      default: "{{tracking_url}}",
      readOnly: true,
    },
    {
      type: "color",
      key: "accentColor",
      label: "Accent Color",
      default: "#059669",
    },
  ],
  template: `<div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
    <div style="font-size: 14px; font-weight: 600; color: #111827;">Shipping Status</div>
    <div style="font-size: 12px; font-weight: 600; color: {{ accentColor }}; background: {{ accentColor }}1a; padding: 3px 10px; border-radius: 99px;">{% if status == "placed" %}Order Placed{% elsif status == "shipped" %}Shipped{% elsif status == "transit" %}In Transit{% elsif status == "delivered" %}Delivered{% endif %}</div>
  </div>
  <div style="background: #f3f4f6; border-radius: 99px; height: 6px; margin-bottom: 16px;">
    <div style="background: {{ accentColor }}; border-radius: 99px; height: 6px; width: {% if status == 'placed' %}15%{% elsif status == 'shipped' %}40%{% elsif status == 'transit' %}70%{% elsif status == 'delivered' %}100%{% endif %};"></div>
  </div>
  <div style="font-size: 13px; color: #4b5563; line-height: 1.8;">
    <div><strong>{{ carrier }}</strong> &middot; {{ trackingNumber }}</div>
    <div>Estimated delivery: <strong>{{ estimatedDelivery }}</strong></div>
  </div>
  {% if trackingUrl %}<div style="margin-top: 14px;"><a href="{{ trackingUrl }}" style="display: inline-block; background: {{ accentColor }}; color: #ffffff; font-size: 13px; font-weight: 600; padding: 10px 24px; border-radius: 6px; text-decoration: none;">Track Your Order</a></div>{% endif %}
</div>`,
};

export const customBlockDefinitions: CustomBlockDefinition[] = [
  eventDetailsBlock,
  pricingCardBlock,
  testimonialBlock,
  productCardBlock,
  featuredArticleBlock,
  productShowcaseBlock,
];

// ─── Product Launch ───────────────────────────────────────────
// Showcases: Display Conditions (3 audience segments), Merge Tags, Custom Block

export function createProductLaunchTemplate(): TemplateContent {
  return {
    settings: {
      width: 600,
      backgroundColor: "#ffffff",
      fontFamily: "Arial, sans-serif",
      preheaderText: "Introducing Launchpad v2.0 — rebuilt from the ground up.",
    },
    blocks: [
      createMenuBlock({
        items: [
          {
            id: generateId(),
            text: "Product",
            url: "https://example.com/product",
            openInNewTab: false,
            bold: false,
            underline: false,
          },
          {
            id: generateId(),
            text: "Pricing",
            url: "https://example.com/pricing",
            openInNewTab: false,
            bold: false,
            underline: false,
          },
          {
            id: generateId(),
            text: "Docs",
            url: "https://example.com/docs",
            openInNewTab: false,
            bold: false,
            underline: false,
          },
          {
            id: generateId(),
            text: "Blog",
            url: "https://example.com/blog",
            openInNewTab: false,
            bold: false,
            underline: false,
          },
        ],
        fontSize: 15,
        color: "#6b7280",
        separator: "\u00b7",
        separatorColor: "#d1d5db",
        spacing: 16,
        textAlign: "center",
        styles: white(14, 20, 14, 20),
      }),
      createTextBlock({
        content: "<p>\u25b2 launchpad</p>",
        fontSize: 26,
        fontWeight: "bold",
        color: "#0d9488",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
        styles: white(15, 15, 15, 15),
      }),
      createTextBlock({
        content: "<p>Introducing Launchpad v2.0</p>",
        fontSize: 30,
        fontWeight: "bold",
        color: "#111827",
        textAlign: "center",
        styles: white(0, 40, 8, 40),
      }),
      createTextBlock({
        content:
          '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span>,</p><p>We have been working on something big. Today we are launching Launchpad v2.0 \u2014 completely rebuilt with a new interface, faster performance, and the features you have been asking for.</p>',
        fontSize: 16,
        color: "#4b5563",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(15, 15, 15, 15),
      }),
      createButtonBlock({
        text: "See What\u2019s New",
        url: "https://example.com/whats-new",
        backgroundColor: "#0d9488",
        textColor: "#ffffff",
        borderRadius: 6,
        fontSize: 16,
        buttonPadding: { top: 14, right: 32, bottom: 14, left: 32 },
        styles: white(15, 15, 15, 15),
      }),
      createImageBlock({
        src: "https://placehold.co/560x300/f0fdfa/0d9488?text=Dashboard+Preview",
        alt: "Launchpad v2.0 dashboard",
        width: "full",
        align: "center",
        styles: white(0, 0, 0, 0),
      }),
      createSpacerBlock({ height: 32, styles: white() }),
      createTextBlock({
        content: "<p>What\u2019s new in v2.0</p>",
        fontSize: 22,
        fontWeight: "bold",
        color: "#111827",
        textAlign: "center",
        styles: white(0, 20, 20, 20),
      }),
      createSectionBlock({
        columns: "2",
        children: [
          [
            createTextBlock({
              content:
                "<p><strong>Redesigned Dashboard</strong></p><p>A cleaner, faster workspace that puts your most important metrics front and center.</p>",
              fontSize: 14,
              color: "#4b5563",
              textAlign: "left",
              fontWeight: "normal",
              styles: pad(0, 16, 16, 4),
            }),
          ],
          [
            createTextBlock({
              content:
                "<p><strong>Team Collaboration</strong></p><p>Invite your team, assign roles, and work together in real-time with live cursors.</p>",
              fontSize: 14,
              color: "#4b5563",
              textAlign: "left",
              fontWeight: "normal",
              styles: pad(0, 4, 16, 16),
            }),
          ],
        ],
        styles: white(0, 20, 0, 20),
      }),
      createSectionBlock({
        columns: "2",
        children: [
          [
            createTextBlock({
              content:
                "<p><strong>API v3</strong></p><p>New REST and webhook endpoints with better rate limits, pagination, and error handling.</p>",
              fontSize: 14,
              color: "#4b5563",
              textAlign: "left",
              fontWeight: "normal",
              styles: pad(0, 16, 16, 4),
            }),
          ],
          [
            createTextBlock({
              content:
                "<p><strong>Advanced Analytics</strong></p><p>Track opens, clicks, and conversions with our new built-in analytics dashboard.</p>",
              fontSize: 14,
              color: "#4b5563",
              textAlign: "left",
              fontWeight: "normal",
              styles: pad(0, 4, 16, 16),
            }),
          ],
        ],
        styles: white(0, 20, 0, 20),
      }),
      // Custom block: Testimonial
      {
        ...createCustomBlock(testimonialBlock),
        fieldValues: {
          quote:
            "Launchpad v2 is the upgrade we didn\u2019t know we needed. Our team onboarded in minutes.",
          authorName: "Maria Santos",
          authorTitle: "VP of Engineering, NovaTech",
          avatarUrl: "",
        },
        styles: white(16, 24, 16, 24),
      },
      createDividerBlock({
        lineStyle: "solid",
        color: "#e5e7eb",
        thickness: 1,
        width: "full",
        styles: white(0, 40, 0, 40),
      }),

      // ── Display Condition: VIP Partners ──
      createTextBlock({
        content:
          "<p><strong>Exclusive for VIP Partners:</strong> Get 6 months free on any v2.0 plan. Use code <strong>VIP2026</strong> at checkout.</p>",
        fontSize: 14,
        color: "#7c3aed",
        textAlign: "center",
        fontWeight: "normal",
        styles: { ...pad(16, 32, 16, 32), backgroundColor: "#f5f3ff" },
        displayCondition: {
          label: "VIP Partners",
          before: "{% if vip_partner %}",
          after: "{% endif %}",
          group: "Audience",
          description: "Show only to VIP partner accounts",
        },
      }),

      // ── Display Condition: Free Users ──
      createTextBlock({
        content:
          "<p>You\u2019re currently on the <strong>Free</strong> plan. Upgrade to v2.0 Pro and get <strong>50% off your first 3 months</strong>.</p>",
        fontSize: 14,
        color: "#059669",
        textAlign: "center",
        fontWeight: "normal",
        styles: { ...pad(16, 32, 16, 32), backgroundColor: "#ecfdf5" },
        displayCondition: {
          label: "Free Users",
          before: '{% if plan == "free" %}',
          after: "{% endif %}",
          group: "Audience",
          description: "Show only to free plan users",
        },
      }),

      // ── Display Condition: Beta Testers ──
      createTextBlock({
        content:
          "<p>As a beta tester, you also get early access to Launchpad AI \u2014 our new assistant that drafts content for you.</p>",
        fontSize: 14,
        color: "#0d9488",
        textAlign: "center",
        fontWeight: "normal",
        styles: { ...pad(16, 32, 16, 32), backgroundColor: "#f0fdfa" },
        displayCondition: {
          label: "Beta Testers",
          before: "{% if beta_tester %}",
          after: "{% endif %}",
          group: "Audience",
          description: "Show only to users in the beta program",
        },
      }),

      createTextBlock({
        content:
          "<p>Ready to upgrade? Your existing data will be automatically migrated \u2014 no action needed.</p>",
        fontSize: 15,
        color: "#4b5563",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(24, 40, 16, 40),
      }),
      createButtonBlock({
        text: "Open Your Dashboard",
        url: "https://example.com/dashboard",
        backgroundColor: "#111827",
        textColor: "#ffffff",
        borderRadius: 6,
        fontSize: 15,
        buttonPadding: { top: 14, right: 28, bottom: 14, left: 28 },
        styles: white(15, 15, 15, 15),
      }),
      createSocialIconsBlock({
        icons: [
          {
            id: generateId(),
            platform: "twitter",
            url: "https://twitter.com/acme",
          },
          {
            id: generateId(),
            platform: "github",
            url: "https://github.com/acme",
          },
          {
            id: generateId(),
            platform: "linkedin",
            url: "https://linkedin.com/company/acme",
          },
        ],
        iconStyle: "solid",
        iconSize: "small",
        spacing: 16,
        align: "center",
        styles: pad(20, 20, 10, 20),
      }),
      createTextBlock({
        content:
          '<p>Launchpad Inc. \u00b7 123 Main St, San Francisco, CA 94105<br/><a href="{{unsubscribe_url}}">Unsubscribe</a> \u00b7 <a href="{{preferences_url}}">Manage preferences</a></p>',
        fontSize: 12,
        color: "#9ca3af",
        textAlign: "center",
        fontWeight: "normal",
        styles: pad(8, 20, 32, 20),
      }),
    ],
  };
}

// ─── Newsletter ───────────────────────────────────────────────
// Showcases: Custom Block with Data Source (Featured Article fetched from CMS)

export function createNewsletterTemplate(): TemplateContent {
  return {
    settings: {
      width: 600,
      backgroundColor: "#ffffff",
      fontFamily: "Georgia, serif",
      preheaderText:
        "This week: design systems, shipping fast, and staying sane.",
    },
    blocks: [
      createTextBlock({
        content: "<p>The Weekly Brief</p>",
        fontSize: 24,
        fontWeight: "bold",
        color: "#111827",
        textAlign: "center",
        styles: white(32, 20, 4, 20),
      }),
      createTextBlock({
        content: "<p>March 24, 2026 \u00b7 Issue #42</p>",
        fontSize: 13,
        color: "#9ca3af",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(0, 20, 20, 20),
      }),
      createDividerBlock({
        lineStyle: "solid",
        color: "#e5e7eb",
        thickness: 1,
        width: "full",
        styles: white(0, 40, 0, 40),
      }),

      // Featured article — Custom Block with Data Source (pre-populated)
      {
        ...createCustomBlock(featuredArticleBlock),
        dataSourceFetched: true,
        fieldValues: {
          title: "Why Most Design Systems Fail (And How to Fix Yours)",
          excerpt:
            "The problem is not the tokens or the components \u2014 it is adoption. After working with 50+ teams, here are the three patterns that separate the design systems people actually use from the ones that collect dust.",
          imageUrl:
            "https://placehold.co/560x280/fef2f2/dc2626?text=Design+Systems",
          author: "Elena Martinez",
          readTime: "8 min read",
          url: "https://example.com/blog/design-systems",
          category: "design",
        },
        styles: white(20, 24, 16, 24),
      },

      createDividerBlock({
        lineStyle: "solid",
        color: "#e5e7eb",
        thickness: 1,
        width: "full",
        styles: white(0, 24, 0, 24),
      }),

      // Quick links section
      createTextBlock({
        content: "<p>Quick Links</p>",
        fontSize: 14,
        fontWeight: "bold",
        color: "#9ca3af",
        textAlign: "left",
        styles: white(20, 24, 12, 24),
      }),
      createTextBlock({
        content:
          '<p><a href="https://example.com/link-1">Ship Fast, Fix Later: When Speed Beats Quality</a></p><p><a href="https://example.com/link-2">The State of Email in 2026</a></p><p><a href="https://example.com/link-3">A Practical Guide to Accessible Color Palettes</a></p>',
        fontSize: 15,
        color: "#4b5563",
        textAlign: "left",
        fontWeight: "normal",
        styles: white(0, 24, 24, 24),
      }),

      createDividerBlock({
        lineStyle: "solid",
        color: "#e5e7eb",
        thickness: 1,
        width: "full",
        styles: white(0, 24, 0, 24),
      }),

      // Footer
      createTextBlock({
        content:
          '<p>You are receiving this because you subscribed to The Weekly Brief.<br/><a href="{{unsubscribe_url}}">Unsubscribe</a> \u00b7 <a href="{{preferences_url}}">Update preferences</a></p>',
        fontSize: 12,
        color: "#9ca3af",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(20, 24, 32, 24),
      }),
    ],
  };
}

// ─── Welcome / Onboarding ─────────────────────────────────────
// Showcases: Logic Merge Tags (plan-aware onboarding), Merge Tags throughout

export function createWelcomeTemplate(): TemplateContent {
  return {
    settings: {
      width: 600,
      backgroundColor: "#ffffff",
      fontFamily: "Arial, sans-serif",
      preheaderText:
        "Welcome to Flowwork — here is everything you need to get started.",
    },
    blocks: [
      createTextBlock({
        content: "<p>\u2726 flowwork</p>",
        fontSize: 36,
        fontWeight: "bold",
        color: "#2563eb",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
        styles: white(15, 15, 15, 15),
      }),
      createTextBlock({
        content:
          '<p>Welcome to Flowwork, <span data-merge-tag="{{first_name}}">First Name</span>!</p>',
        fontSize: 26,
        fontWeight: "bold",
        color: "#111827",
        textAlign: "center",
        styles: white(0, 40, 8, 40),
      }),
      createTextBlock({
        content:
          '<p>You\u2019re signed up on the <strong><span data-merge-tag="{{plan_name}}">Plan</span></strong> plan. We\u2019re thrilled to have you on board. Here are three things to do first:</p>',
        fontSize: 16,
        color: "#4b5563",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(0, 40, 28, 40),
      }),

      // Step 1
      createSectionBlock({
        columns: "1-2",
        children: [
          [
            createTextBlock({
              content:
                '<p style="font-size: 32px; font-weight: bold; color: #2563eb; text-align: center;">1</p>',
              fontSize: 32,
              fontWeight: "bold",
              color: "#2563eb",
              textAlign: "center",
              styles: pad(8, 8, 8, 8),
            }),
          ],
          [
            createTextBlock({
              content:
                "<p><strong>Complete your profile</strong></p><p>Add your name, photo, and timezone so your team knows who you are.</p>",
              fontSize: 14,
              color: "#4b5563",
              textAlign: "left",
              fontWeight: "normal",
              styles: pad(8, 16, 8, 0),
            }),
          ],
        ],
        styles: white(0, 24, 0, 24),
      }),

      // Step 2
      createSectionBlock({
        columns: "1-2",
        children: [
          [
            createTextBlock({
              content:
                '<p style="font-size: 32px; font-weight: bold; color: #2563eb; text-align: center;">2</p>',
              fontSize: 32,
              fontWeight: "bold",
              color: "#2563eb",
              textAlign: "center",
              styles: pad(8, 8, 8, 8),
            }),
          ],
          [
            createTextBlock({
              content:
                "<p><strong>Create your first project</strong></p><p>Projects are where your work lives. Start with one and you can always add more later.</p>",
              fontSize: 14,
              color: "#4b5563",
              textAlign: "left",
              fontWeight: "normal",
              styles: pad(8, 16, 8, 0),
            }),
          ],
        ],
        styles: white(0, 24, 0, 24),
      }),

      // Step 3
      createSectionBlock({
        columns: "1-2",
        children: [
          [
            createTextBlock({
              content:
                '<p style="font-size: 32px; font-weight: bold; color: #2563eb; text-align: center;">3</p>',
              fontSize: 32,
              fontWeight: "bold",
              color: "#2563eb",
              textAlign: "center",
              styles: pad(8, 8, 8, 8),
            }),
          ],
          [
            createTextBlock({
              content:
                "<p><strong>Invite your team</strong></p><p>Flowwork works best with your whole team. Invite colleagues from Settings \u2192 Team.</p>",
              fontSize: 14,
              color: "#4b5563",
              textAlign: "left",
              fontWeight: "normal",
              styles: pad(8, 16, 8, 0),
            }),
          ],
        ],
        styles: white(0, 24, 0, 24),
      }),

      createSpacerBlock({ height: 16, styles: white() }),

      // ── Logic Merge Tag: plan-specific CTA ──
      createTextBlock({
        content:
          '<p><span data-logic-merge-tag="{% if plan_name == \'pro\' %}" data-logic-type="open"></span><strong>Pro tip:</strong> You have access to advanced integrations. <a href="https://example.com/integrations">Set up your first integration</a> to get the most out of Flowwork.<span data-logic-merge-tag="{% endif %}" data-logic-type="close"></span><span data-logic-merge-tag="{% if plan_name == \'free\' %}" data-logic-type="open"></span>Want more features? <a href="https://example.com/upgrade">Upgrade to Pro</a> for advanced integrations, priority support, and unlimited projects.<span data-logic-merge-tag="{% endif %}" data-logic-type="close"></span></p>',
        fontSize: 14,
        color: "#2563eb",
        textAlign: "center",
        fontWeight: "normal",
        styles: { ...pad(16, 32, 16, 32), backgroundColor: "#eff6ff" },
      }),

      createButtonBlock({
        text: "Go to Your Dashboard",
        url: "https://example.com/dashboard",
        backgroundColor: "#2563eb",
        textColor: "#ffffff",
        borderRadius: 6,
        fontSize: 16,
        buttonPadding: { top: 14, right: 32, bottom: 14, left: 32 },
        styles: white(0, 20, 32, 20),
      }),

      createDividerBlock({
        lineStyle: "solid",
        color: "#e5e7eb",
        thickness: 1,
        width: "full",
        styles: white(0, 40, 0, 40),
      }),

      createTextBlock({
        content:
          '<p>Need help? Reply to this email or visit our <a href="https://example.com/docs">documentation</a>.</p>',
        fontSize: 14,
        color: "#6b7280",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(16, 32, 16, 32),
      }),

      createTextBlock({
        content:
          '<p>Flowwork Inc. \u00b7 456 Market St, San Francisco, CA 94105<br/><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
        fontSize: 12,
        color: "#9ca3af",
        textAlign: "center",
        fontWeight: "normal",
        styles: pad(8, 20, 32, 20),
      }),
    ],
  };
}

// ─── Order Confirmation ───────────────────────────────────────
// Showcases: Heavy Merge Tags, Logic Merge Tags (shipping-aware), Display Condition

export function createOrderConfirmationTemplate(): TemplateContent {
  return {
    settings: {
      width: 600,
      backgroundColor: "#ffffff",
      fontFamily: "Arial, sans-serif",
      preheaderText: "Your order #{{order_id}} has been confirmed.",
    },
    blocks: [
      createTextBlock({
        content: "<p>\u25cf shopfront</p>",
        fontSize: 22,
        fontWeight: "bold",
        color: "#059669",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
        styles: white(28, 20, 16, 20),
      }),

      createTextBlock({
        content: "<p>Order Confirmed</p>",
        fontSize: 26,
        fontWeight: "bold",
        color: "#111827",
        textAlign: "center",
        styles: white(0, 20, 8, 20),
      }),
      createTextBlock({
        content:
          '<p>Thanks <span data-merge-tag="{{first_name}}">First Name</span>, your order <strong>#<span data-merge-tag="{{order_id}}">1042</span></strong> is confirmed and being prepared.</p>',
        fontSize: 15,
        color: "#4b5563",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(0, 40, 8, 40),
      }),

      // ── Logic Merge Tag: shipping method message ──
      createTextBlock({
        content:
          '<p><span data-logic-merge-tag="{% if shipping_method == \'express\' %}" data-logic-type="open"></span>\ud83d\ude80 <strong>Express Shipping:</strong> Your order arrives tomorrow!<span data-logic-merge-tag="{% else %}" data-logic-type="else"></span>\ud83d\udce6 <strong>Standard Shipping:</strong> Estimated delivery in 3\u20135 business days.<span data-logic-merge-tag="{% endif %}" data-logic-type="close"></span></p>',
        fontSize: 14,
        color: "#059669",
        textAlign: "center",
        fontWeight: "normal",
        styles: { ...pad(12, 32, 12, 32), backgroundColor: "#ecfdf5" },
      }),

      createDividerBlock({
        lineStyle: "solid",
        color: "#e5e7eb",
        thickness: 1,
        width: "full",
        styles: white(16, 24, 0, 24),
      }),

      createTextBlock({
        content: "<p>Order Summary</p>",
        fontSize: 16,
        fontWeight: "bold",
        color: "#111827",
        textAlign: "left",
        styles: white(16, 24, 12, 24),
      }),

      createTableBlock({
        rows: [
          {
            id: generateId(),
            cells: [
              { id: generateId(), content: "Item" },
              { id: generateId(), content: "Qty" },
              { id: generateId(), content: "Price" },
            ],
          },
          {
            id: generateId(),
            cells: [
              { id: generateId(), content: "Wireless Headphones" },
              { id: generateId(), content: "1" },
              { id: generateId(), content: "$89.00" },
            ],
          },
          {
            id: generateId(),
            cells: [
              { id: generateId(), content: "USB-C Cable (2m)" },
              { id: generateId(), content: "2" },
              { id: generateId(), content: "$24.00" },
            ],
          },
          {
            id: generateId(),
            cells: [
              { id: generateId(), content: "Phone Case" },
              { id: generateId(), content: "1" },
              { id: generateId(), content: "$19.00" },
            ],
          },
        ],
        hasHeaderRow: true,
        headerBackgroundColor: "#f9fafb",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        cellPadding: 10,
        fontSize: 14,
        color: "#374151",
        textAlign: "left",
        styles: white(0, 24, 0, 24),
      }),

      createSectionBlock({
        columns: "2",
        children: [
          [
            createTextBlock({
              content:
                '<p><strong>Shipping Address</strong></p><p><span data-merge-tag="{{first_name}}">Jane</span> <span data-merge-tag="{{last_name}}">Doe</span><br/>123 Main St, Apt 4B<br/>San Francisco, CA 94105</p>',
              fontSize: 13,
              color: "#4b5563",
              textAlign: "left",
              fontWeight: "normal",
              styles: pad(16, 8, 16, 0),
            }),
          ],
          [
            createTextBlock({
              content:
                '<p><strong>Order Total</strong></p><p>Subtotal: $132.00<br/>Shipping: $5.99<br/><strong>Total: <span data-merge-tag="{{order_total}}">$137.99</span></strong></p>',
              fontSize: 13,
              color: "#4b5563",
              textAlign: "right",
              fontWeight: "normal",
              styles: pad(16, 0, 16, 8),
            }),
          ],
        ],
        styles: white(0, 24, 0, 24),
      }),

      // ── Logic Merge Tag: free shipping unlocked ──
      createTextBlock({
        content:
          '<p><span data-logic-merge-tag="{% if order_total > 100 %}" data-logic-type="open"></span>\u2705 You unlocked <strong>free shipping</strong> on your next order! Orders over $100 always ship free.<span data-logic-merge-tag="{% endif %}" data-logic-type="close"></span></p>',
        fontSize: 13,
        color: "#059669",
        textAlign: "center",
        fontWeight: "normal",
        styles: { ...pad(12, 32, 12, 32), backgroundColor: "#f0fdf4" },
      }),

      createDividerBlock({
        lineStyle: "solid",
        color: "#e5e7eb",
        thickness: 1,
        width: "full",
        styles: white(0, 24, 0, 24),
      }),

      // Custom block: Shipping Tracker (read-only fields populated by backend)
      {
        ...createCustomBlock(shippingTrackerBlock),
        fieldValues: {
          status: "shipped",
          carrier: "FedEx",
          trackingNumber: "7489 2034 8561",
          estimatedDelivery: "{{estimated_delivery}}",
          trackingUrl: "{{tracking_url}}",
          accentColor: "#059669",
        },
        styles: white(16, 24, 24, 24),
      },

      // ── Display Condition: VIP loyalty offer ──
      createTextBlock({
        content:
          "<p>\u2b50 As a <strong>VIP member</strong>, enjoy an extra <strong>10% off</strong> your next order. Use code <strong>VIPLOVE</strong> at checkout.</p>",
        fontSize: 13,
        color: "#7c3aed",
        textAlign: "center",
        fontWeight: "normal",
        styles: { ...pad(12, 32, 12, 32), backgroundColor: "#f5f3ff" },
        displayCondition: {
          label: "VIP Partners",
          before: "{% if vip_partner %}",
          after: "{% endif %}",
          group: "Audience",
          description: "Show only to VIP partner accounts",
        },
      }),

      createTextBlock({
        content:
          '<p>Questions about your order? <a href="https://example.com/support">Contact Support</a></p>',
        fontSize: 13,
        color: "#6b7280",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(0, 24, 8, 24),
      }),

      createTextBlock({
        content:
          '<p>Shopfront \u00b7 456 Commerce Ave, San Francisco, CA 94105<br/><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
        fontSize: 12,
        color: "#9ca3af",
        textAlign: "center",
        fontWeight: "normal",
        styles: pad(16, 20, 32, 20),
      }),
    ],
  };
}

// ─── Event Invitation ─────────────────────────────────────────
// Showcases: Custom Block, Display Conditions (Early Bird, Speaker)

export function createEventInvitationTemplate(): TemplateContent {
  return {
    settings: {
      width: 600,
      backgroundColor: "#ffffff",
      fontFamily: "Arial, sans-serif",
      preheaderText: "You are invited — join us for Config 2026 on April 15.",
    },
    blocks: [
      createTextBlock({
        content: "<p>\u25c6 config 2026</p>",
        fontSize: 24,
        fontWeight: "bold",
        color: "#7c3aed",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
        styles: white(32, 20, 8, 20),
      }),
      createTextBlock({
        content: "<p>You\u2019re Invited</p>",
        fontSize: 32,
        fontWeight: "bold",
        color: "#111827",
        textAlign: "center",
        styles: white(0, 40, 8, 40),
      }),
      createTextBlock({
        content:
          "<p>Join designers, engineers, and product leaders for a full day of talks, workshops, and networking.</p>",
        fontSize: 16,
        color: "#4b5563",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(0, 48, 28, 48),
      }),

      createImageBlock({
        src: "https://placehold.co/560x260/f5f3ff/7c3aed?text=Config+2026",
        alt: "Config 2026 event banner",
        width: "full",
        align: "center",
        styles: white(0, 0, 0, 0),
      }),

      createSpacerBlock({ height: 24, styles: white() }),

      // Custom block: Event Details
      {
        ...createCustomBlock(eventDetailsBlock),
        fieldValues: {
          eventName: "Config 2026",
          date: "April 15, 2026",
          time: "9:00 AM \u2013 6:00 PM PT",
          location: "The Moscone Center, San Francisco",
          mapUrl: "https://maps.google.com/?q=Moscone+Center",
          accentColor: "#7c3aed",
        },
        styles: white(0, 24, 8, 24),
      },

      // ── Display Condition: Early Bird ──
      createTextBlock({
        content:
          "<p>\ud83c\udf1f <strong>Early bird pricing:</strong> Register before March 31 and save 40%. Use code <strong>EARLYBIRD</strong>.</p>",
        fontSize: 14,
        color: "#b45309",
        textAlign: "center",
        fontWeight: "normal",
        styles: { ...pad(12, 32, 12, 32), backgroundColor: "#fffbeb" },
        displayCondition: {
          label: "Early Bird",
          before: "{% if early_bird %}",
          after: "{% endif %}",
          group: "Registration",
          description: "Show early bird pricing for early registrants",
        },
      }),

      // ── Display Condition: Speakers ──
      createTextBlock({
        content:
          '<p>\ud83c\udfa4 <strong>Speaker info:</strong> Please arrive by 8:00 AM for sound check. Your backstage pass and speaker kit will be at the registration desk. <a href="https://example.com/speaker-guide">View speaker guide</a>.</p>',
        fontSize: 14,
        color: "#7c3aed",
        textAlign: "center",
        fontWeight: "normal",
        styles: { ...pad(12, 32, 12, 32), backgroundColor: "#f5f3ff" },
        displayCondition: {
          label: "Speakers",
          before: "{% if is_speaker %}",
          after: "{% endif %}",
          group: "Role",
          description: "Show only to confirmed speakers",
        },
      }),

      createButtonBlock({
        text: "RSVP Now",
        url: "https://example.com/rsvp",
        backgroundColor: "#7c3aed",
        textColor: "#ffffff",
        borderRadius: 6,
        fontSize: 16,
        buttonPadding: { top: 14, right: 40, bottom: 14, left: 40 },
        styles: white(8, 20, 8, 20),
      }),
      createTextBlock({
        content: "<p>Free admission \u00b7 Limited spots available</p>",
        fontSize: 13,
        color: "#9ca3af",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(0, 20, 24, 20),
      }),

      createDividerBlock({
        lineStyle: "solid",
        color: "#e5e7eb",
        thickness: 1,
        width: "full",
        styles: white(0, 40, 0, 40),
      }),

      createTextBlock({
        content: "<p><strong>What to Expect</strong></p>",
        fontSize: 18,
        fontWeight: "bold",
        color: "#111827",
        textAlign: "center",
        styles: white(16, 20, 16, 20),
      }),

      createSectionBlock({
        columns: "2",
        children: [
          [
            createTextBlock({
              content:
                "<p><strong>Keynote Talks</strong></p><p>Industry leaders share insights on the future of design and development.</p>",
              fontSize: 14,
              color: "#4b5563",
              textAlign: "left",
              fontWeight: "normal",
              styles: pad(0, 16, 12, 4),
            }),
          ],
          [
            createTextBlock({
              content:
                "<p><strong>Hands-on Workshops</strong></p><p>Small-group sessions where you build real projects with expert guidance.</p>",
              fontSize: 14,
              color: "#4b5563",
              textAlign: "left",
              fontWeight: "normal",
              styles: pad(0, 4, 12, 16),
            }),
          ],
        ],
        styles: white(0, 20, 0, 20),
      }),

      createTextBlock({
        content:
          '<p>Can\u2019t make it in person? <a href="https://example.com/livestream">Watch the livestream</a></p>',
        fontSize: 14,
        color: "#6b7280",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(8, 24, 8, 24),
      }),

      createSocialIconsBlock({
        icons: [
          {
            id: generateId(),
            platform: "twitter",
            url: "https://twitter.com/config",
          },
          {
            id: generateId(),
            platform: "linkedin",
            url: "https://linkedin.com/company/config",
          },
          {
            id: generateId(),
            platform: "instagram",
            url: "https://instagram.com/config",
          },
        ],
        iconStyle: "solid",
        iconSize: "small",
        spacing: 16,
        align: "center",
        styles: pad(16, 20, 8, 20),
      }),

      createTextBlock({
        content:
          '<p>Config Events \u00b7 San Francisco, CA<br/><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
        fontSize: 12,
        color: "#9ca3af",
        textAlign: "center",
        fontWeight: "normal",
        styles: pad(8, 20, 32, 20),
      }),
    ],
  };
}

// ─── Password Reset ───────────────────────────────────────────
// Showcases: Merge Tags, Responsive Visibility (desktop vs mobile tips)

export function createPasswordResetTemplate(): TemplateContent {
  return {
    settings: {
      width: 600,
      backgroundColor: "#ffffff",
      fontFamily: "Arial, sans-serif",
      preheaderText: "Reset your password \u2014 this link expires in 1 hour.",
    },
    blocks: [
      createTextBlock({
        content: "<p>\u25a0 vaultkey</p>",
        fontSize: 22,
        fontWeight: "bold",
        color: "#111827",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
        styles: white(32, 20, 24, 20),
      }),

      createTextBlock({
        content: "<p>Reset Your Password</p>",
        fontSize: 24,
        fontWeight: "bold",
        color: "#111827",
        textAlign: "center",
        styles: white(0, 40, 8, 40),
      }),
      createTextBlock({
        content:
          '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span>,</p><p>We received a request to reset the password for your account (<span data-merge-tag="{{email}}">email@example.com</span>). Click the button below to choose a new password. This link will expire in 1 hour.</p>',
        fontSize: 15,
        color: "#4b5563",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(0, 48, 24, 48),
      }),

      createButtonBlock({
        text: "Reset Password",
        url: "https://example.com/reset?token=abc123",
        backgroundColor: "#111827",
        textColor: "#ffffff",
        borderRadius: 6,
        fontSize: 16,
        buttonPadding: { top: 14, right: 36, bottom: 14, left: 36 },
        styles: white(0, 20, 24, 20),
      }),

      createTextBlock({
        content:
          '<p>If the button doesn\u2019t work, copy and paste this link into your browser:</p><p><a href="https://example.com/reset?token=abc123">https://example.com/reset?token=abc123</a></p>',
        fontSize: 13,
        color: "#9ca3af",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(0, 40, 24, 40),
      }),

      createDividerBlock({
        lineStyle: "solid",
        color: "#e5e7eb",
        thickness: 1,
        width: "full",
        styles: white(0, 40, 0, 40),
      }),

      // ── Responsive: Desktop-only detailed security tips ──
      createTextBlock({
        content:
          "<p><strong>Security Tips</strong></p><p>\u2022 Never share your password with anyone<br/>\u2022 Use a unique password for each service<br/>\u2022 Enable two-factor authentication for extra protection<br/>\u2022 Check that the URL starts with https://vaultkey.com before entering credentials</p>",
        fontSize: 13,
        color: "#6b7280",
        textAlign: "left",
        fontWeight: "normal",
        styles: white(16, 40, 16, 40),
        visibility: { desktop: true, tablet: true, mobile: false },
      }),

      // ── Responsive: Mobile-only short security note ──
      createTextBlock({
        content:
          "<p>\ud83d\udd12 Protect your account: never share this link and enable two-factor authentication.</p>",
        fontSize: 13,
        color: "#6b7280",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(16, 32, 16, 32),
        visibility: { desktop: false, tablet: false, mobile: true },
      }),

      createTextBlock({
        content:
          "<p>If you didn\u2019t request this, you can safely ignore this email. Your password will not be changed.</p>",
        fontSize: 13,
        color: "#6b7280",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(16, 40, 16, 40),
      }),

      createTextBlock({
        content:
          '<p>VaultKey Security \u00b7 <a href="https://example.com/support">Help Center</a></p>',
        fontSize: 12,
        color: "#9ca3af",
        textAlign: "center",
        fontWeight: "normal",
        styles: pad(8, 20, 32, 20),
      }),
    ],
  };
}

// ─── Black Friday Sale ────────────────────────────────────────
// Showcases: Custom Block with Repeatable Fields + Data Source, Display Condition

export function createBlackFridayTemplate(): TemplateContent {
  return {
    settings: {
      width: 600,
      backgroundColor: "#111827",
      fontFamily: "Arial, sans-serif",
      preheaderText: "Up to 50% off everything \u2014 Black Friday starts now.",
    },
    blocks: [
      createTextBlock({
        content: "<p>\u26a1 NEONSHOP</p>",
        fontSize: 22,
        fontWeight: "bold",
        color: "#fbbf24",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
        styles: { ...pad(28, 20, 12, 20), backgroundColor: "#111827" },
      }),
      createTextBlock({
        content: "<p>BLACK FRIDAY</p>",
        fontSize: 40,
        fontWeight: "bold",
        color: "#ffffff",
        textAlign: "center",
        styles: { ...pad(0, 20, 0, 20), backgroundColor: "#111827" },
      }),
      createTextBlock({
        content: "<p>Up to 50% off everything</p>",
        fontSize: 18,
        color: "#fbbf24",
        textAlign: "center",
        fontWeight: "bold",
        styles: { ...pad(4, 20, 8, 20), backgroundColor: "#111827" },
      }),
      createTextBlock({
        content:
          "<p>Use code <strong>BF2026</strong> at checkout. Ends Monday at midnight.</p>",
        fontSize: 15,
        color: "#d1d5db",
        textAlign: "center",
        fontWeight: "normal",
        styles: { ...pad(0, 40, 12, 40), backgroundColor: "#111827" },
      }),

      createButtonBlock({
        text: "Shop the Sale",
        url: "https://example.com/sale",
        backgroundColor: "#fbbf24",
        textColor: "#111827",
        borderRadius: 6,
        fontSize: 16,
        buttonPadding: { top: 14, right: 36, bottom: 14, left: 36 },
        styles: { ...pad(8, 20, 28, 20), backgroundColor: "#111827" },
      }),

      // ── Display Condition: Enterprise special ──
      createTextBlock({
        content:
          '<p><strong>Enterprise exclusive:</strong> Bulk orders of 10+ units get an additional 15% off. <a href="https://example.com/enterprise" style="color: #fbbf24;">Contact sales</a></p>',
        fontSize: 13,
        color: "#d1d5db",
        textAlign: "center",
        fontWeight: "normal",
        styles: { ...pad(12, 32, 12, 32), backgroundColor: "#1f2937" },
        displayCondition: {
          label: "Enterprise",
          before: '{% if plan == "enterprise" %}',
          after: "{% endif %}",
          group: "Audience",
          description: "Show only to enterprise accounts",
        },
      }),

      // Product Showcase — Custom Block with Repeatable + Data Source (pre-populated)
      {
        ...createCustomBlock(productShowcaseBlock),
        dataSourceFetched: true,
        fieldValues: {
          heading: "Top Picks for You",
          productCategory: "electronics",
          accentColor: "#dc2626",
          products: [
            {
              name: "Wireless Pro Max",
              price: "$99",
              image:
                "https://placehold.co/200x160/f3f4f6/6b7280?text=Headphones",
              badge: "-50%",
              url: "https://example.com/headphones",
            },
            {
              name: "Boom Speaker",
              price: "$59",
              image: "https://placehold.co/200x160/f3f4f6/6b7280?text=Speaker",
              badge: "-34%",
              url: "https://example.com/speaker",
            },
            {
              name: "Chrono Smart",
              price: "$249",
              image: "https://placehold.co/200x160/f3f4f6/6b7280?text=Watch",
              badge: "NEW",
              url: "https://example.com/watch",
            },
          ],
        },
        styles: white(24, 16, 0, 16),
      },

      createButtonBlock({
        text: "View All Deals \u2192",
        url: "https://example.com/sale",
        backgroundColor: "#111827",
        textColor: "#ffffff",
        borderRadius: 6,
        fontSize: 15,
        buttonPadding: { top: 12, right: 28, bottom: 12, left: 28 },
        styles: white(16, 20, 24, 20),
      }),

      createDividerBlock({
        lineStyle: "solid",
        color: "#e5e7eb",
        thickness: 1,
        width: "full",
        styles: white(0, 24, 0, 24),
      }),

      createTextBlock({
        content:
          "<p>Deal expires <strong>Monday, Nov 30 at 11:59 PM PT</strong>. Cannot be combined with other offers.</p>",
        fontSize: 13,
        color: "#6b7280",
        textAlign: "center",
        fontWeight: "normal",
        styles: white(12, 32, 12, 32),
      }),

      createSocialIconsBlock({
        icons: [
          {
            id: generateId(),
            platform: "twitter",
            url: "https://twitter.com/neonshop",
          },
          {
            id: generateId(),
            platform: "instagram",
            url: "https://instagram.com/neonshop",
          },
          {
            id: generateId(),
            platform: "tiktok",
            url: "https://tiktok.com/@neonshop",
          },
        ],
        iconStyle: "solid",
        iconSize: "small",
        spacing: 16,
        align: "center",
        styles: pad(16, 20, 8, 20),
      }),

      createTextBlock({
        content:
          '<p>NeonShop \u00b7 789 Retail Blvd, Los Angeles, CA 90012<br/><a href="{{unsubscribe_url}}">Unsubscribe</a> \u00b7 <a href="{{preferences_url}}">Preferences</a></p>',
        fontSize: 12,
        color: "#9ca3af",
        textAlign: "center",
        fontWeight: "normal",
        styles: pad(8, 20, 32, 20),
      }),
    ],
  };
}

// ─── Template Registry ───────────────────────────────────────

export type FeatureIcon =
  | "merge-tag"
  | "display-condition"
  | "data-source"
  | "custom-block"
  | "responsive";

export interface TemplateFeature {
  label: string;
  description: string;
  icon?: FeatureIcon;
}

export interface TemplateOption {
  name: string;
  description: string;
  create: () => TemplateContent;
  preview: string;
  customBlocks?: CustomBlockDefinition[];
  /** Features showcased by this template, displayed in the overlay */
  features?: TemplateFeature[];
}

export const templates: TemplateOption[] = [
  {
    name: "Product Launch",
    description: "Announcement with hero, features, and CTA",
    create: createProductLaunchTemplate,
    preview: "product",
    customBlocks: [testimonialBlock],
    features: [
      {
        label: "Display Conditions",
        icon: "display-condition",
        description:
          'This template has 3 blocks that target different audience segments: VIP Partners, Free Users, and Beta Testers. Each one is wrapped in a condition like {% if vip_partner %}.\nTo try it: select any colored block near the bottom and open the Settings tab. Look for "Display Condition" \u2014 you\u2019ll see which audience it targets.\nYou can also add conditions to any other block, or write your own custom conditions using the "Custom condition" option in the dropdown.',
      },
      {
        label: "Merge Tags",
        icon: "merge-tag",
        description:
          'The greeting says "Hi {{first_name}}" \u2014 this gets replaced with the recipient\u2019s actual name at send time. The footer uses {{unsubscribe_url}} and {{preferences_url}} for dynamic links.\nTo try it: click inside any text block, then look for the merge tag button ({ }) in the text toolbar. You can also type {{ to trigger autocomplete with all available tags.',
      },
      {
        label: "Custom Block",
        icon: "custom-block",
        description:
          "The Testimonial near the bottom is a custom block with its own fields: quote, author name, title, and an optional avatar.\nTo try it: click the testimonial and check the right sidebar \u2014 you\u2019ll see custom field editors instead of the usual text toolbar. Edit any field and watch the block update instantly.\nThe Quote and Author Name fields are marked as required \u2014 they show a red asterisk and cannot be left empty. The avatar is optional and uses {% if avatarUrl %} in the Liquid template to conditionally render.\nCustom blocks use Liquid templates, so developers can add conditional logic directly in the markup.",
      },
    ],
  },
  {
    name: "Newsletter",
    description: "Weekly digest with featured article and links",
    create: createNewsletterTemplate,
    preview: "newsletter",
    customBlocks: [featuredArticleBlock],
    features: [
      {
        label: "Custom Block with Data Source",
        icon: "data-source",
        description:
          "The Featured Article block is pre-populated with content loaded from a simulated CMS API. The article title, excerpt, author, and other metadata were all fetched automatically.\nTo try it: click the article block and look at the right sidebar. Most fields are read-only (grayed out) because they came from the data source \u2014 but the Cover Image is editable, letting marketers override the image while keeping the rest locked.\nThis shows how developers can mix read-only and editable fields on the same block, giving marketers flexibility where it matters while protecting data integrity on API-sourced content.",
      },
      {
        label: "Data Source: Change Content",
        icon: "data-source",
        description:
          'Want to swap the article? Click the Featured Article block, then press "Change article" in the sidebar.\nA modal opens with a 3-second loading animation showing the simulated API endpoint. After loading, you\u2019ll see 3 different articles to choose from. Pick one and all fields update instantly.\nThis demonstrates how marketers can pull content from your CMS without manually editing each field.',
      },
      {
        label: "Merge Tags",
        icon: "merge-tag",
        description:
          "The footer uses {{unsubscribe_url}} and {{preferences_url}} merge tags that get replaced with real URLs when sent through your ESP.\nTo explore: open the Config panel (top toolbar) to see all available merge tags and how they\u2019re defined with label/value pairs.",
      },
    ],
  },
  {
    name: "Welcome Email",
    description: "Onboarding steps for new users",
    create: createWelcomeTemplate,
    preview: "welcome",
    customBlocks: [],
    features: [
      {
        label: "Logic Merge Tags (If/Else)",
        icon: "merge-tag",
        description:
          'Scroll down to the blue highlighted block below the onboarding steps. It contains conditional logic that adapts based on the subscriber\u2019s plan.\nPro users see: "You have access to advanced integrations" with a setup link.\nFree users see: "Want more features? Upgrade to Pro" with an upgrade CTA.\nTo try it: click the block to see {% if plan_name == "pro" %} and {% if plan_name == "free" %} tags rendered inline. This lets you build one template that works for multiple audience segments.',
      },
      {
        label: "Merge Tags Throughout",
        icon: "merge-tag",
        description:
          "This template uses merge tags heavily for personalization. The heading greets the user with {{first_name}}, and the intro shows their plan via {{plan_name}}.\nTo try it: click any text with a colored chip to see the merge tag. These are configured in the mergeTags option passed to init().\nOpen the Config panel to see how tags are defined with label/value pairs and the Liquid syntax preset.",
      },
    ],
  },
  {
    name: "Order Confirmation",
    description: "Order summary with items and shipping",
    create: createOrderConfirmationTemplate,
    preview: "order",
    customBlocks: [shippingTrackerBlock],
    features: [
      {
        label: "Custom Block with Read-Only Fields",
        icon: "custom-block",
        description:
          "The Shipping Tracker card shows carrier info, tracking number, estimated delivery, and a progress bar that adapts to the shipping status.\nTo try it: click the tracker and check the sidebar. The carrier, tracking number, estimated delivery, and tracking URL are all read-only \u2014 grayed out and non-editable because the backend populates them at send time. But the Status dropdown and Accent Color are editable, showing how developers can mix locked and editable fields on the same block.\nTry changing the Status dropdown to see the progress bar and status badge update instantly.",
      },
      {
        label: "Logic Merge Tags (If/Else)",
        icon: "merge-tag",
        description:
          'This template has two blocks with conditional logic.\nThe green banner uses {% if shipping_method == "express" %} to show "arrives tomorrow" for express, or "3\u20135 business days" for standard shipping.\nFurther down, {% if order_total > 100 %} reveals a "free shipping unlocked" message.\nTo try it: click either block to see the if/else logic inline in the editor. These conditions are evaluated by your backend at send time.',
      },
      {
        label: "Merge Tags (Transactional)",
        icon: "merge-tag",
        description:
          "A fully dynamic transactional email with multiple merge tags: {{order_id}} in the header, {{first_name}} and {{last_name}} in the shipping address, and {{order_total}} for the amount.\nTo try it: click any text with a colored chip to see the merge tag. These are configured in the mergeTags option passed to init().",
      },
      {
        label: "Display Condition",
        icon: "display-condition",
        description:
          "Near the bottom, the purple VIP loyalty block is only visible to VIP partner accounts.\nTo try it: select the block and open Settings \u2192 Display Condition to see {% if vip_partner %} applied. Non-VIP recipients never see this block in the final email.",
      },
    ],
  },
  {
    name: "Event Invitation",
    description: "Event details with date, time, and RSVP",
    create: createEventInvitationTemplate,
    preview: "event",
    customBlocks: [eventDetailsBlock],
    features: [
      {
        label: "Display Conditions (Multiple Groups)",
        icon: "display-condition",
        description:
          'This template uses display conditions organized into different groups.\nThe amber "Early Bird" block uses {% if early_bird %} in the "Registration" group. The purple "Speaker" block uses {% if is_speaker %} in the "Role" group.\nTo try it: select either block, open Settings, and check the Display Condition dropdown. Groups keep conditions organized when you have many. Try removing a condition and re-adding it to see all available options.',
      },
      {
        label: "Custom Block",
        icon: "custom-block",
        description:
          'The Event Details card is a custom block with 6 editable fields: event name, date, time, location, map link, and accent color.\nTo try it: click the card and edit fields in the sidebar \u2014 changes render instantly. Try clearing the map link to see the "View on Map" link disappear (it uses {% if mapUrl %} in the Liquid template).\nNotice that Event Name, Date, and Time are marked as required fields \u2014 they show a red asterisk and cannot be left empty. This shows how developers can enforce data integrity on custom blocks using the required option.\nThis shows how custom blocks combine structured data entry with conditional rendering logic.',
      },
    ],
  },
  {
    name: "Password Reset",
    description: "Simple transactional reset link email",
    create: createPasswordResetTemplate,
    preview: "reset",
    customBlocks: [],
    features: [
      {
        label: "Responsive Visibility",
        icon: "responsive",
        description:
          "This template has two versions of security tips that swap based on device size.\nDesktop/tablet: a detailed list with 4 bullet points. Mobile: a condensed single-line note.\nTo try it: select either block and open Settings \u2192 Display to see the visibility toggles for desktop, tablet, and mobile.\nThen switch the viewport preview in the top toolbar between Desktop and Mobile to watch the blocks swap live on the canvas.",
      },
      {
        label: "Merge Tags",
        icon: "merge-tag",
        description:
          "The greeting uses {{first_name}} and the body shows {{email}} so the recipient can verify which account the reset is for \u2014 an important trust signal.\nTo try it: click the text to see merge tag chips highlighted inline. Both tags are inserted as visual chips in the editor, making them easy to spot and edit.",
      },
    ],
  },
  {
    name: "Black Friday Sale",
    description: "Promo with product picks and discount code",
    create: createBlackFridayTemplate,
    preview: "sale",
    customBlocks: [productShowcaseBlock],
    features: [
      {
        label: "Custom Block with Repeatable Fields + Data Source",
        icon: "data-source",
        description:
          'The "Top Picks for You" section is a Product Showcase custom block that combines two powerful features: repeatable fields and a data source.\nThe "products" field is a repeatable array \u2014 each item has name, price, image, badge, and URL. The data was loaded from a simulated product catalog API.\nTo try it: click the block and scroll through the sidebar. You\u2019ll see each product as an expandable row. Try reordering, adding, or removing products manually.',
      },
      {
        label: "Data Source: Swap Product Collection",
        icon: "data-source",
        description:
          'Click the Product Showcase block, then press "Change collection" in the sidebar.\nA picker modal opens with a 3-second loading animation showing the simulated API endpoint. After loading, choose from 3 collections: Best Sellers, New Arrivals, or Clearance Sale.\nSelecting one replaces all product items at once. This is how e-commerce platforms let marketers swap curated product sets without touching individual fields.',
      },
      {
        label: "Display Condition",
        icon: "display-condition",
        description:
          'The dark-themed banner after the sale countdown has an Enterprise-only block offering 15% off bulk orders.\nTo try it: select the block and check Settings \u2192 Display Condition \u2014 it uses {% if plan == "enterprise" %}. Only enterprise customers see this in the final email.',
      },
    ],
  },
];
