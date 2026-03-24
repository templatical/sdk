import type { TemplateContent, CustomBlockDefinition } from '@templatical/types';
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
} from '@templatical/types';

// ─── Custom Block Definitions ─────────────────────────────────

export const eventDetailsBlock: CustomBlockDefinition = {
    type: 'event-details',
    name: 'Event Details',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
    description: 'Displays event date, time, location, and optional map link',
    fields: [
        { type: 'text', key: 'eventName', label: 'Event Name', default: 'My Event' },
        { type: 'text', key: 'date', label: 'Date', default: 'April 15, 2026', placeholder: 'e.g. April 15, 2026' },
        { type: 'text', key: 'time', label: 'Time', default: '9:00 AM – 6:00 PM', placeholder: 'e.g. 9:00 AM – 6:00 PM' },
        { type: 'text', key: 'location', label: 'Location', default: 'The Moscone Center, San Francisco' },
        { type: 'text', key: 'mapUrl', label: 'Map Link (optional)', default: '' },
        { type: 'color', key: 'accentColor', label: 'Accent Color', default: '#7c3aed' },
    ],
    template: `<div style="border: 2px solid {{ accentColor }}; border-radius: 8px; padding: 20px; text-align: center;">
  <div style="font-size: 18px; font-weight: bold; color: {{ accentColor }}; margin-bottom: 12px;">{{ eventName }}</div>
  <div style="font-size: 14px; color: #4b5563; margin-bottom: 4px;">\ud83d\udcc5 {{ date }}</div>
  <div style="font-size: 14px; color: #4b5563; margin-bottom: 4px;">\u23f0 {{ time }}</div>
  <div style="font-size: 14px; color: #4b5563;">📍 {{ location }}</div>
  {% if mapUrl %}<div style="margin-top: 12px;"><a href="{{ mapUrl }}" style="color: {{ accentColor }}; font-size: 13px;">View on Map \u2192</a></div>{% endif %}
</div>`,
};

export const pricingCardBlock: CustomBlockDefinition = {
    type: 'pricing-card',
    name: 'Pricing Card',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    description: 'Displays a pricing plan with name, price, and features list',
    fields: [
        { type: 'text', key: 'planName', label: 'Plan Name', default: 'Pro' },
        { type: 'text', key: 'price', label: 'Price', default: '$29/mo' },
        { type: 'textarea', key: 'features', label: 'Features (one per line)', default: 'Unlimited projects\n10 team members\nPriority support\nCustom integrations' },
        { type: 'color', key: 'accentColor', label: 'Accent Color', default: '#0d9488' },
        { type: 'boolean', key: 'highlighted', label: 'Highlighted', default: true },
    ],
    template: `<div style="border: {{ highlighted | if: '2px' | else: '1px' }} solid {{ highlighted | if: accentColor | else: '#e5e7eb' }}; border-radius: 8px; padding: 24px; text-align: center; {{ highlighted | if: 'background-color: #f0fdfa;' }}">
  <div style="font-size: 14px; font-weight: 600; color: {{ accentColor }}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">{{ planName }}</div>
  <div style="font-size: 32px; font-weight: bold; color: #111827; margin-bottom: 16px;">{{ price }}</div>
  <div style="text-align: left; font-size: 14px; color: #4b5563; line-height: 1.8;">{{ features | newline_to_br }}</div>
</div>`,
};

export const testimonialBlock: CustomBlockDefinition = {
    type: 'testimonial',
    name: 'Testimonial',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></svg>',
    description: 'Customer quote with name and title',
    fields: [
        { type: 'textarea', key: 'quote', label: 'Quote', default: 'This product completely changed how our team works. We shipped 3x faster in the first month.' },
        { type: 'text', key: 'authorName', label: 'Author Name', default: 'Sarah Chen' },
        { type: 'text', key: 'authorTitle', label: 'Author Title', default: 'Head of Product, Acme Corp' },
        { type: 'image', key: 'avatarUrl', label: 'Avatar URL (optional)', default: '' },
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
    type: 'product-card',
    name: 'Product Card',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    description: 'Displays a product with image, name, price, and buy link',
    fields: [
        { type: 'image', key: 'imageUrl', label: 'Product Image', default: '' },
        { type: 'text', key: 'name', label: 'Product Name', default: 'Product Name' },
        { type: 'text', key: 'originalPrice', label: 'Original Price', default: '' },
        { type: 'text', key: 'salePrice', label: 'Sale Price', default: '$49.99' },
        { type: 'text', key: 'badge', label: 'Badge (optional)', default: '', placeholder: 'e.g. -30%, NEW, HOT' },
        { type: 'text', key: 'url', label: 'Product URL', default: 'https://example.com' },
        { type: 'color', key: 'badgeColor', label: 'Badge Color', default: '#dc2626' },
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

export const customBlockDefinitions: CustomBlockDefinition[] = [
    eventDetailsBlock,
    pricingCardBlock,
    testimonialBlock,
    productCardBlock,
];

const pad = (top: number, right: number, bottom: number, left: number) => ({
    padding: { top, right, bottom, left },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
});

const white = (top = 0, right = 0, bottom = 0, left = 0) => ({
    ...pad(top, right, bottom, left),
    backgroundColor: '#ffffff',
});

// ─── Product Launch ───────────────────────────────────────────

export function createProductLaunchTemplate(): TemplateContent {
    return {
        settings: {
            width: 600,
            backgroundColor: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            preheaderText: 'Introducing Launchpad v2.0 — rebuilt from the ground up.',
        },
        blocks: [
            createMenuBlock({
                items: [
                    { id: generateId(), text: 'Product', url: 'https://example.com/product', openInNewTab: false, bold: false, underline: false },
                    { id: generateId(), text: 'Pricing', url: 'https://example.com/pricing', openInNewTab: false, bold: false, underline: false },
                    { id: generateId(), text: 'Docs', url: 'https://example.com/docs', openInNewTab: false, bold: false, underline: false },
                    { id: generateId(), text: 'Blog', url: 'https://example.com/blog', openInNewTab: false, bold: false, underline: false },
                ],
                fontSize: 15,
                color: '#6b7280',
                separator: '\u00b7',
                separatorColor: '#d1d5db',
                spacing: 16,
                textAlign: 'center',
                styles: white(14, 20, 14, 20),
            }),
            createTextBlock({
                content: '<p>\u25b2 launchpad</p>',
                fontSize: 26,
                fontWeight: 'bold',
                color: '#0d9488',
                textAlign: 'center',
                fontFamily: 'Arial, sans-serif',
                styles: white(15, 15, 15, 15),
            }),
            createTextBlock({
                content: '<p>Introducing Launchpad v2.0</p>',
                fontSize: 30,
                fontWeight: 'bold',
                color: '#111827',
                textAlign: 'center',
                styles: white(0, 40, 8, 40),
            }),
            createTextBlock({
                content: '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span>,</p><p>We have been working on something big. Today we are launching Launchpad v2.0 — completely rebuilt with a new interface, faster performance, and the features you have been asking for.</p>',
                fontSize: 16,
                color: '#4b5563',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: white(15, 15, 15, 15),
            }),
            createButtonBlock({
                text: 'See What\u2019s New',
                url: 'https://example.com/whats-new',
                backgroundColor: '#0d9488',
                textColor: '#ffffff',
                borderRadius: 6,
                fontSize: 16,
                buttonPadding: { top: 14, right: 32, bottom: 14, left: 32 },
                styles: white(15, 15, 15, 15),
            }),
            createImageBlock({
                src: 'https://placehold.co/560x300/f0fdfa/0d9488?text=Dashboard+Preview',
                alt: 'Launchpad v2.0 dashboard',
                width: 'full',
                align: 'center',
                styles: white(0, 0, 0, 0),
            }),
            createSpacerBlock({ height: 32, styles: white() }),
            createTextBlock({
                content: '<p>What\u2019s new in v2.0</p>',
                fontSize: 22,
                fontWeight: 'bold',
                color: '#111827',
                textAlign: 'center',
                styles: white(0, 20, 20, 20),
            }),
            createSectionBlock({
                columns: '2',
                children: [
                    [
                        createTextBlock({
                            content: '<p><strong>Redesigned Dashboard</strong></p><p>A cleaner, faster workspace that puts your most important metrics front and center.</p>',
                            fontSize: 14, color: '#4b5563', textAlign: 'left', fontWeight: 'normal',
                            styles: pad(0, 16, 16, 4),
                        }),
                    ],
                    [
                        createTextBlock({
                            content: '<p><strong>Team Collaboration</strong></p><p>Invite your team, assign roles, and work together in real-time with live cursors.</p>',
                            fontSize: 14, color: '#4b5563', textAlign: 'left', fontWeight: 'normal',
                            styles: pad(0, 4, 16, 16),
                        }),
                    ],
                ],
                styles: white(0, 20, 0, 20),
            }),
            createSectionBlock({
                columns: '2',
                children: [
                    [
                        createTextBlock({
                            content: '<p><strong>API v3</strong></p><p>New REST and webhook endpoints with better rate limits, pagination, and error handling.</p>',
                            fontSize: 14, color: '#4b5563', textAlign: 'left', fontWeight: 'normal',
                            styles: pad(0, 16, 16, 4),
                        }),
                    ],
                    [
                        createTextBlock({
                            content: '<p><strong>Advanced Analytics</strong></p><p>Track opens, clicks, and conversions with our new built-in analytics dashboard.</p>',
                            fontSize: 14, color: '#4b5563', textAlign: 'left', fontWeight: 'normal',
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
                    quote: 'Launchpad v2 is the upgrade we didn\u2019t know we needed. Our team onboarded in minutes.',
                    authorName: 'Maria Santos',
                    authorTitle: 'VP of Engineering, NovaTech',
                    avatarUrl: '',
                },
                styles: white(16, 24, 16, 24),
            },
            createDividerBlock({ lineStyle: 'solid', color: '#e5e7eb', thickness: 1, width: 'full', styles: white(0, 40, 0, 40) }),
            createTextBlock({
                content: '<p>Ready to upgrade? Your existing data will be automatically migrated — no action needed.</p>',
                fontSize: 15, color: '#4b5563', textAlign: 'center', fontWeight: 'normal',
                styles: white(24, 40, 16, 40),
            }),
            createButtonBlock({
                text: 'Open Your Dashboard',
                url: 'https://example.com/dashboard',
                backgroundColor: '#111827',
                textColor: '#ffffff',
                borderRadius: 6,
                fontSize: 15,
                buttonPadding: { top: 14, right: 28, bottom: 14, left: 28 },
                styles: white(15, 15, 15, 15),
            }),
            createTextBlock({
                content: '<p>As a beta tester, you also get early access to Launchpad AI — our new assistant that drafts content for you.</p>',
                fontSize: 14, color: '#0d9488', textAlign: 'center', fontWeight: 'normal',
                styles: { ...pad(16, 32, 16, 32), backgroundColor: '#f0fdfa' },
                displayCondition: {
                    label: 'Beta Testers',
                    before: '{% if beta_tester %}',
                    after: '{% endif %}',
                    group: 'Audience',
                    description: 'Show only to users in the beta program',
                },
            }),
            createSocialIconsBlock({
                icons: [
                    { id: generateId(), platform: 'twitter', url: 'https://twitter.com/acme' },
                    { id: generateId(), platform: 'github', url: 'https://github.com/acme' },
                    { id: generateId(), platform: 'linkedin', url: 'https://linkedin.com/company/acme' },
                ],
                iconStyle: 'solid', iconSize: 'small', spacing: 16, align: 'center',
                styles: pad(20, 20, 10, 20),
            }),
            createTextBlock({
                content: '<p>Launchpad Inc. \u00b7 123 Main St, San Francisco, CA 94105<br/><a href="{{unsubscribe_url}}">Unsubscribe</a> \u00b7 <a href="{{preferences_url}}">Manage preferences</a></p>',
                fontSize: 12, color: '#9ca3af', textAlign: 'center', fontWeight: 'normal',
                styles: pad(8, 20, 32, 20),
            }),
        ],
    };
}

// ─── Newsletter ───────────────────────────────────────────────

export function createNewsletterTemplate(): TemplateContent {
    return {
        settings: {
            width: 600,
            backgroundColor: '#ffffff',
            fontFamily: 'Georgia, serif',
            preheaderText: 'This week: design systems, shipping fast, and staying sane.',
        },
        blocks: [
            createTextBlock({
                content: '<p>The Weekly Brief</p>',
                fontSize: 24,
                fontWeight: 'bold',
                color: '#111827',
                textAlign: 'center',
                styles: white(32, 20, 4, 20),
            }),
            createTextBlock({
                content: '<p>March 24, 2026 \u00b7 Issue #42</p>',
                fontSize: 13,
                color: '#9ca3af',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: white(0, 20, 20, 20),
            }),
            createDividerBlock({ lineStyle: 'solid', color: '#e5e7eb', thickness: 1, width: 'full', styles: white(0, 40, 0, 40) }),

            // Featured article
            createImageBlock({
                src: 'https://placehold.co/560x280/fef2f2/dc2626?text=Featured+Article',
                alt: 'Featured article',
                width: 'full',
                align: 'center',
                styles: white(20, 20, 16, 20),
            }),
            createTextBlock({
                content: '<p>Why Most Design Systems Fail (And How to Fix Yours)</p>',
                fontSize: 22,
                fontWeight: 'bold',
                color: '#111827',
                textAlign: 'left',
                styles: white(0, 24, 8, 24),
            }),
            createTextBlock({
                content: '<p>The problem is not the tokens or the components — it is adoption. After working with 50+ teams, here are the three patterns that separate the design systems people actually use from the ones that collect dust.</p>',
                fontSize: 16,
                color: '#4b5563',
                textAlign: 'left',
                fontWeight: 'normal',
                styles: white(0, 24, 16, 24),
            }),
            createButtonBlock({
                text: 'Read More \u2192',
                url: 'https://example.com/article-1',
                backgroundColor: 'transparent',
                textColor: '#dc2626',
                borderRadius: 0,
                fontSize: 15,
                buttonPadding: { top: 0, right: 0, bottom: 0, left: 0 },
                styles: white(0, 24, 24, 24),
            }),

            createDividerBlock({ lineStyle: 'solid', color: '#e5e7eb', thickness: 1, width: 'full', styles: white(0, 24, 0, 24) }),

            // Quick links section
            createTextBlock({
                content: '<p>Quick Links</p>',
                fontSize: 14,
                fontWeight: 'bold',
                color: '#9ca3af',
                textAlign: 'left',
                styles: white(20, 24, 12, 24),
            }),
            createTextBlock({
                content: '<p><a href="https://example.com/link-1">Ship Fast, Fix Later: When Speed Beats Quality</a></p><p><a href="https://example.com/link-2">The State of Email in 2026</a></p><p><a href="https://example.com/link-3">A Practical Guide to Accessible Color Palettes</a></p>',
                fontSize: 15,
                color: '#4b5563',
                textAlign: 'left',
                fontWeight: 'normal',
                styles: white(0, 24, 24, 24),
            }),

            createDividerBlock({ lineStyle: 'solid', color: '#e5e7eb', thickness: 1, width: 'full', styles: white(0, 24, 0, 24) }),

            // Footer
            createTextBlock({
                content: '<p>You are receiving this because you subscribed to The Weekly Brief.<br/><a href="{{unsubscribe_url}}">Unsubscribe</a> \u00b7 <a href="{{preferences_url}}">Update preferences</a></p>',
                fontSize: 12,
                color: '#9ca3af',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: white(20, 24, 32, 24),
            }),
        ],
    };
}

// ─── Welcome / Onboarding ─────────────────────────────────────

export function createWelcomeTemplate(): TemplateContent {
    return {
        settings: {
            width: 600,
            backgroundColor: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            preheaderText: 'Welcome to Flowwork — here is everything you need to get started.',
        },
        blocks: [
            createTextBlock({
                content: '<p>\u2726 flowwork</p>',
                fontSize: 36,
                fontWeight: 'bold',
                color: '#2563eb',
                textAlign: 'center',
                fontFamily: 'Arial, sans-serif',
                styles: white(15, 15, 15, 15),
            }),
            createTextBlock({
                content: '<p>Welcome to Flowwork, <span data-merge-tag="{{first_name}}">First Name</span>!</p>',
                fontSize: 26,
                fontWeight: 'bold',
                color: '#111827',
                textAlign: 'center',
                styles: white(0, 40, 8, 40),
            }),
            createTextBlock({
                content: '<p>We are thrilled to have you on board. Your account is all set up and ready to go. Here are three things to do first:</p>',
                fontSize: 16,
                color: '#4b5563',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: white(0, 40, 28, 40),
            }),

            // Step 1
            createSectionBlock({
                columns: '1-2',
                children: [
                    [
                        createTextBlock({
                            content: '<p style="font-size: 32px; font-weight: bold; color: #2563eb; text-align: center;">1</p>',
                            fontSize: 32,
                            fontWeight: 'bold',
                            color: '#2563eb',
                            textAlign: 'center',
                            styles: pad(8, 8, 8, 8),
                        }),
                    ],
                    [
                        createTextBlock({
                            content: '<p><strong>Complete your profile</strong></p><p>Add your name, photo, and timezone so your team knows who you are.</p>',
                            fontSize: 14, color: '#4b5563', textAlign: 'left', fontWeight: 'normal',
                            styles: pad(8, 16, 8, 0),
                        }),
                    ],
                ],
                styles: white(0, 24, 0, 24),
            }),

            // Step 2
            createSectionBlock({
                columns: '1-2',
                children: [
                    [
                        createTextBlock({
                            content: '<p style="font-size: 32px; font-weight: bold; color: #2563eb; text-align: center;">2</p>',
                            fontSize: 32,
                            fontWeight: 'bold',
                            color: '#2563eb',
                            textAlign: 'center',
                            styles: pad(8, 8, 8, 8),
                        }),
                    ],
                    [
                        createTextBlock({
                            content: '<p><strong>Create your first project</strong></p><p>Projects are where your work lives. Start with one and you can always add more later.</p>',
                            fontSize: 14, color: '#4b5563', textAlign: 'left', fontWeight: 'normal',
                            styles: pad(8, 16, 8, 0),
                        }),
                    ],
                ],
                styles: white(0, 24, 0, 24),
            }),

            // Step 3
            createSectionBlock({
                columns: '1-2',
                children: [
                    [
                        createTextBlock({
                            content: '<p style="font-size: 32px; font-weight: bold; color: #2563eb; text-align: center;">3</p>',
                            fontSize: 32,
                            fontWeight: 'bold',
                            color: '#2563eb',
                            textAlign: 'center',
                            styles: pad(8, 8, 8, 8),
                        }),
                    ],
                    [
                        createTextBlock({
                            content: '<p><strong>Invite your team</strong></p><p>Flowwork works best with your whole team. Invite colleagues from Settings \u2192 Team.</p>',
                            fontSize: 14, color: '#4b5563', textAlign: 'left', fontWeight: 'normal',
                            styles: pad(8, 16, 8, 0),
                        }),
                    ],
                ],
                styles: white(0, 24, 0, 24),
            }),

            createSpacerBlock({ height: 16, styles: white() }),
            createButtonBlock({
                text: 'Go to Your Dashboard',
                url: 'https://example.com/dashboard',
                backgroundColor: '#2563eb',
                textColor: '#ffffff',
                borderRadius: 6,
                fontSize: 16,
                buttonPadding: { top: 14, right: 32, bottom: 14, left: 32 },
                styles: white(0, 20, 32, 20),
            }),

            createDividerBlock({ lineStyle: 'solid', color: '#e5e7eb', thickness: 1, width: 'full', styles: white(0, 40, 0, 40) }),

            createTextBlock({
                content: '<p>Need help? Reply to this email or visit our <a href="https://example.com/docs">documentation</a>.</p>',
                fontSize: 14,
                color: '#6b7280',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: white(16, 32, 16, 32),
            }),

            createTextBlock({
                content: '<p>Flowwork Inc. \u00b7 456 Market St, San Francisco, CA 94105<br/><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
                fontSize: 12, color: '#9ca3af', textAlign: 'center', fontWeight: 'normal',
                styles: pad(8, 20, 32, 20),
            }),
        ],
    };
}

// ─── Order Confirmation ───────────────────────────────────────

export function createOrderConfirmationTemplate(): TemplateContent {
    return {
        settings: {
            width: 600,
            backgroundColor: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            preheaderText: 'Your order #{{order_id}} has been confirmed.',
        },
        blocks: [
            createTextBlock({
                content: '<p>\u25cf shopfront</p>',
                fontSize: 22,
                fontWeight: 'bold',
                color: '#059669',
                textAlign: 'center',
                fontFamily: 'Arial, sans-serif',
                styles: white(28, 20, 16, 20),
            }),

            createTextBlock({
                content: '<p>Order Confirmed</p>',
                fontSize: 26,
                fontWeight: 'bold',
                color: '#111827',
                textAlign: 'center',
                styles: white(0, 20, 8, 20),
            }),
            createTextBlock({
                content: '<p>Thanks <span data-merge-tag="{{first_name}}">First Name</span>, your order <strong>#1042</strong> is confirmed and being prepared. You will receive a shipping notification once it is on the way.</p>',
                fontSize: 15,
                color: '#4b5563',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: white(0, 40, 24, 40),
            }),

            createDividerBlock({ lineStyle: 'solid', color: '#e5e7eb', thickness: 1, width: 'full', styles: white(0, 24, 0, 24) }),

            createTextBlock({
                content: '<p>Order Summary</p>',
                fontSize: 16,
                fontWeight: 'bold',
                color: '#111827',
                textAlign: 'left',
                styles: white(16, 24, 12, 24),
            }),

            createTableBlock({
                rows: [
                    {
                        id: generateId(),
                        cells: [
                            { id: generateId(), content: 'Item' },
                            { id: generateId(), content: 'Qty' },
                            { id: generateId(), content: 'Price' },
                        ],
                    },
                    {
                        id: generateId(),
                        cells: [
                            { id: generateId(), content: 'Wireless Headphones' },
                            { id: generateId(), content: '1' },
                            { id: generateId(), content: '$89.00' },
                        ],
                    },
                    {
                        id: generateId(),
                        cells: [
                            { id: generateId(), content: 'USB-C Cable (2m)' },
                            { id: generateId(), content: '2' },
                            { id: generateId(), content: '$24.00' },
                        ],
                    },
                    {
                        id: generateId(),
                        cells: [
                            { id: generateId(), content: 'Phone Case' },
                            { id: generateId(), content: '1' },
                            { id: generateId(), content: '$19.00' },
                        ],
                    },
                ],
                hasHeaderRow: true,
                headerBackgroundColor: '#f9fafb',
                borderColor: '#e5e7eb',
                borderWidth: 1,
                cellPadding: 10,
                fontSize: 14,
                color: '#374151',
                textAlign: 'left',
                styles: white(0, 24, 0, 24),
            }),

            createSectionBlock({
                columns: '2',
                children: [
                    [
                        createTextBlock({
                            content: '<p><strong>Shipping Address</strong></p><p>Jane Doe<br/>123 Main St, Apt 4B<br/>San Francisco, CA 94105</p>',
                            fontSize: 13, color: '#4b5563', textAlign: 'left', fontWeight: 'normal',
                            styles: pad(16, 8, 16, 0),
                        }),
                    ],
                    [
                        createTextBlock({
                            content: '<p><strong>Order Total</strong></p><p>Subtotal: $132.00<br/>Shipping: $5.99<br/><strong>Total: $137.99</strong></p>',
                            fontSize: 13, color: '#4b5563', textAlign: 'right', fontWeight: 'normal',
                            styles: pad(16, 0, 16, 8),
                        }),
                    ],
                ],
                styles: white(0, 24, 0, 24),
            }),

            createDividerBlock({ lineStyle: 'solid', color: '#e5e7eb', thickness: 1, width: 'full', styles: white(0, 24, 0, 24) }),

            createButtonBlock({
                text: 'Track Your Order',
                url: 'https://example.com/orders/1042',
                backgroundColor: '#059669',
                textColor: '#ffffff',
                borderRadius: 6,
                fontSize: 15,
                buttonPadding: { top: 14, right: 28, bottom: 14, left: 28 },
                styles: white(16, 20, 24, 20),
            }),

            createTextBlock({
                content: '<p>Questions about your order? <a href="https://example.com/support">Contact Support</a></p>',
                fontSize: 13,
                color: '#6b7280',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: white(0, 24, 8, 24),
            }),

            createTextBlock({
                content: '<p>Shopfront \u00b7 456 Commerce Ave, San Francisco, CA 94105<br/><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
                fontSize: 12, color: '#9ca3af', textAlign: 'center', fontWeight: 'normal',
                styles: pad(16, 20, 32, 20),
            }),
        ],
    };
}

// ─── Event Invitation ─────────────────────────────────────────

export function createEventInvitationTemplate(): TemplateContent {
    return {
        settings: {
            width: 600,
            backgroundColor: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            preheaderText: 'You are invited — join us for Config 2026 on April 15.',
        },
        blocks: [
            createTextBlock({
                content: '<p>\u25c6 config 2026</p>',
                fontSize: 24,
                fontWeight: 'bold',
                color: '#7c3aed',
                textAlign: 'center',
                fontFamily: 'Arial, sans-serif',
                styles: white(32, 20, 8, 20),
            }),
            createTextBlock({
                content: '<p>You\u2019re Invited</p>',
                fontSize: 32,
                fontWeight: 'bold',
                color: '#111827',
                textAlign: 'center',
                styles: white(0, 40, 8, 40),
            }),
            createTextBlock({
                content: '<p>Join designers, engineers, and product leaders for a full day of talks, workshops, and networking.</p>',
                fontSize: 16,
                color: '#4b5563',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: white(0, 48, 28, 48),
            }),

            createImageBlock({
                src: 'https://placehold.co/560x260/f5f3ff/7c3aed?text=Config+2026',
                alt: 'Config 2026 event banner',
                width: 'full',
                align: 'center',
                styles: white(0, 0, 0, 0),
            }),

            createSpacerBlock({ height: 24, styles: white() }),

            // Event details
            // Custom block: Event Details
            {
                ...createCustomBlock(eventDetailsBlock),
                fieldValues: {
                    eventName: 'Config 2026',
                    date: 'April 15, 2026',
                    time: '9:00 AM \u2013 6:00 PM PT',
                    location: 'The Moscone Center, San Francisco',
                    mapUrl: 'https://maps.google.com/?q=Moscone+Center',
                    accentColor: '#7c3aed',
                },
                styles: white(0, 24, 8, 24),
            },

            createButtonBlock({
                text: 'RSVP Now',
                url: 'https://example.com/rsvp',
                backgroundColor: '#7c3aed',
                textColor: '#ffffff',
                borderRadius: 6,
                fontSize: 16,
                buttonPadding: { top: 14, right: 40, bottom: 14, left: 40 },
                styles: white(8, 20, 8, 20),
            }),
            createTextBlock({
                content: '<p>Free admission \u00b7 Limited spots available</p>',
                fontSize: 13,
                color: '#9ca3af',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: white(0, 20, 24, 20),
            }),

            createDividerBlock({ lineStyle: 'solid', color: '#e5e7eb', thickness: 1, width: 'full', styles: white(0, 40, 0, 40) }),

            createTextBlock({
                content: '<p><strong>What to Expect</strong></p>',
                fontSize: 18,
                fontWeight: 'bold',
                color: '#111827',
                textAlign: 'center',
                styles: white(16, 20, 16, 20),
            }),

            createSectionBlock({
                columns: '2',
                children: [
                    [
                        createTextBlock({
                            content: '<p><strong>Keynote Talks</strong></p><p>Industry leaders share insights on the future of design and development.</p>',
                            fontSize: 14, color: '#4b5563', textAlign: 'left', fontWeight: 'normal',
                            styles: pad(0, 16, 12, 4),
                        }),
                    ],
                    [
                        createTextBlock({
                            content: '<p><strong>Hands-on Workshops</strong></p><p>Small-group sessions where you build real projects with expert guidance.</p>',
                            fontSize: 14, color: '#4b5563', textAlign: 'left', fontWeight: 'normal',
                            styles: pad(0, 4, 12, 16),
                        }),
                    ],
                ],
                styles: white(0, 20, 0, 20),
            }),

            createTextBlock({
                content: '<p>Can\u2019t make it in person? <a href="https://example.com/livestream">Watch the livestream</a></p>',
                fontSize: 14,
                color: '#6b7280',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: white(8, 24, 8, 24),
            }),

            createSocialIconsBlock({
                icons: [
                    { id: generateId(), platform: 'twitter', url: 'https://twitter.com/config' },
                    { id: generateId(), platform: 'linkedin', url: 'https://linkedin.com/company/config' },
                    { id: generateId(), platform: 'instagram', url: 'https://instagram.com/config' },
                ],
                iconStyle: 'solid', iconSize: 'small', spacing: 16, align: 'center',
                styles: pad(16, 20, 8, 20),
            }),

            createTextBlock({
                content: '<p>Config Events \u00b7 San Francisco, CA<br/><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
                fontSize: 12, color: '#9ca3af', textAlign: 'center', fontWeight: 'normal',
                styles: pad(8, 20, 32, 20),
            }),
        ],
    };
}

// ─── Password Reset ───────────────────────────────────────────

export function createPasswordResetTemplate(): TemplateContent {
    return {
        settings: {
            width: 600,
            backgroundColor: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            preheaderText: 'Reset your password — this link expires in 1 hour.',
        },
        blocks: [
            createTextBlock({
                content: '<p>\u25a0 vaultkey</p>',
                fontSize: 22,
                fontWeight: 'bold',
                color: '#111827',
                textAlign: 'center',
                fontFamily: 'Arial, sans-serif',
                styles: white(32, 20, 24, 20),
            }),

            createTextBlock({
                content: '<p>Reset Your Password</p>',
                fontSize: 24,
                fontWeight: 'bold',
                color: '#111827',
                textAlign: 'center',
                styles: white(0, 40, 8, 40),
            }),
            createTextBlock({
                content: '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span>,</p><p>We received a request to reset the password for your account. Click the button below to choose a new password. This link will expire in 1 hour.</p>',
                fontSize: 15,
                color: '#4b5563',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: white(0, 48, 24, 48),
            }),

            createButtonBlock({
                text: 'Reset Password',
                url: 'https://example.com/reset?token=abc123',
                backgroundColor: '#111827',
                textColor: '#ffffff',
                borderRadius: 6,
                fontSize: 16,
                buttonPadding: { top: 14, right: 36, bottom: 14, left: 36 },
                styles: white(0, 20, 24, 20),
            }),

            createTextBlock({
                content: '<p>If the button doesn\u2019t work, copy and paste this link into your browser:</p><p><a href="https://example.com/reset?token=abc123">https://example.com/reset?token=abc123</a></p>',
                fontSize: 13,
                color: '#9ca3af',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: white(0, 40, 24, 40),
            }),

            createDividerBlock({ lineStyle: 'solid', color: '#e5e7eb', thickness: 1, width: 'full', styles: white(0, 40, 0, 40) }),

            createTextBlock({
                content: '<p>If you didn\u2019t request this, you can safely ignore this email. Your password will not be changed.</p>',
                fontSize: 13,
                color: '#6b7280',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: white(16, 40, 16, 40),
            }),

            createTextBlock({
                content: '<p>VaultKey Security \u00b7 <a href="https://example.com/support">Help Center</a></p>',
                fontSize: 12, color: '#9ca3af', textAlign: 'center', fontWeight: 'normal',
                styles: pad(8, 20, 32, 20),
            }),
        ],
    };
}

// ─── Black Friday Sale ────────────────────────────────────────

export function createBlackFridayTemplate(): TemplateContent {
    return {
        settings: {
            width: 600,
            backgroundColor: '#111827',
            fontFamily: 'Arial, sans-serif',
            preheaderText: 'Up to 50% off everything — Black Friday starts now.',
        },
        blocks: [
            createTextBlock({
                content: '<p>\u26a1 NEONSHOP</p>',
                fontSize: 22,
                fontWeight: 'bold',
                color: '#fbbf24',
                textAlign: 'center',
                fontFamily: 'Arial, sans-serif',
                styles: { ...pad(28, 20, 12, 20), backgroundColor: '#111827' },
            }),
            createTextBlock({
                content: '<p>BLACK FRIDAY</p>',
                fontSize: 40,
                fontWeight: 'bold',
                color: '#ffffff',
                textAlign: 'center',
                styles: { ...pad(0, 20, 0, 20), backgroundColor: '#111827' },
            }),
            createTextBlock({
                content: '<p>Up to 50% off everything</p>',
                fontSize: 18,
                color: '#fbbf24',
                textAlign: 'center',
                fontWeight: 'bold',
                styles: { ...pad(4, 20, 8, 20), backgroundColor: '#111827' },
            }),
            createTextBlock({
                content: '<p>Use code <strong>BF2026</strong> at checkout. Ends Monday at midnight.</p>',
                fontSize: 15,
                color: '#d1d5db',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: { ...pad(0, 40, 20, 40), backgroundColor: '#111827' },
            }),
            createButtonBlock({
                text: 'Shop the Sale',
                url: 'https://example.com/sale',
                backgroundColor: '#fbbf24',
                textColor: '#111827',
                borderRadius: 6,
                fontSize: 16,
                buttonPadding: { top: 14, right: 36, bottom: 14, left: 36 },
                styles: { ...pad(0, 20, 28, 20), backgroundColor: '#111827' },
            }),

            // Product picks using custom product-card blocks
            createTextBlock({
                content: '<p>Top Picks for You</p>',
                fontSize: 20,
                fontWeight: 'bold',
                color: '#111827',
                textAlign: 'center',
                styles: white(24, 20, 16, 20),
            }),

            createSectionBlock({
                columns: '3',
                children: [
                    [
                        {
                            ...createCustomBlock(productCardBlock),
                            fieldValues: {
                                imageUrl: 'https://placehold.co/200x160/f3f4f6/6b7280?text=Headphones',
                                name: 'Wireless Pro Max',
                                originalPrice: '$199',
                                salePrice: '$99',
                                badge: '-50%',
                                url: 'https://example.com/headphones',
                                badgeColor: '#dc2626',
                            },
                            styles: pad(4, 4, 4, 4),
                        },
                    ],
                    [
                        {
                            ...createCustomBlock(productCardBlock),
                            fieldValues: {
                                imageUrl: 'https://placehold.co/200x160/f3f4f6/6b7280?text=Speaker',
                                name: 'Boom Speaker',
                                originalPrice: '$89',
                                salePrice: '$59',
                                badge: '-34%',
                                url: 'https://example.com/speaker',
                                badgeColor: '#dc2626',
                            },
                            styles: pad(4, 4, 4, 4),
                        },
                    ],
                    [
                        {
                            ...createCustomBlock(productCardBlock),
                            fieldValues: {
                                imageUrl: 'https://placehold.co/200x160/f3f4f6/6b7280?text=Watch',
                                name: 'Chrono Smart',
                                originalPrice: '$349',
                                salePrice: '$249',
                                badge: '-29%',
                                url: 'https://example.com/watch',
                                badgeColor: '#dc2626',
                            },
                            styles: pad(4, 4, 4, 4),
                        },
                    ],
                ],
                styles: white(0, 16, 0, 16),
            }),

            createButtonBlock({
                text: 'View All Deals \u2192',
                url: 'https://example.com/sale',
                backgroundColor: '#111827',
                textColor: '#ffffff',
                borderRadius: 6,
                fontSize: 15,
                buttonPadding: { top: 12, right: 28, bottom: 12, left: 28 },
                styles: white(8, 20, 24, 20),
            }),

            createDividerBlock({ lineStyle: 'solid', color: '#e5e7eb', thickness: 1, width: 'full', styles: white(0, 24, 0, 24) }),

            createTextBlock({
                content: '<p>Deal expires <strong>Monday, Nov 30 at 11:59 PM PT</strong>. Cannot be combined with other offers.</p>',
                fontSize: 13,
                color: '#6b7280',
                textAlign: 'center',
                fontWeight: 'normal',
                styles: white(12, 32, 12, 32),
            }),

            createSocialIconsBlock({
                icons: [
                    { id: generateId(), platform: 'twitter', url: 'https://twitter.com/neonshop' },
                    { id: generateId(), platform: 'instagram', url: 'https://instagram.com/neonshop' },
                    { id: generateId(), platform: 'tiktok', url: 'https://tiktok.com/@neonshop' },
                ],
                iconStyle: 'solid', iconSize: 'small', spacing: 16, align: 'center',
                styles: pad(16, 20, 8, 20),
            }),

            createTextBlock({
                content: '<p>NeonShop \u00b7 789 Retail Blvd, Los Angeles, CA 90012<br/><a href="{{unsubscribe_url}}">Unsubscribe</a> \u00b7 <a href="{{preferences_url}}">Preferences</a></p>',
                fontSize: 12, color: '#9ca3af', textAlign: 'center', fontWeight: 'normal',
                styles: pad(8, 20, 32, 20),
            }),
        ],
    };
}

export interface TemplateOption {
    name: string;
    description: string;
    create: () => TemplateContent;
    preview: string;
    customBlocks?: CustomBlockDefinition[];
}

export const templates: TemplateOption[] = [
    {
        name: 'Product Launch',
        description: 'Announcement with hero, features, and CTA',
        create: createProductLaunchTemplate,
        preview: 'product',
        customBlocks: [testimonialBlock],
    },
    {
        name: 'Newsletter',
        description: 'Weekly digest with featured article and links',
        create: createNewsletterTemplate,
        preview: 'newsletter',
        customBlocks: [],
    },
    {
        name: 'Welcome Email',
        description: 'Onboarding steps for new users',
        create: createWelcomeTemplate,
        preview: 'welcome',
        customBlocks: [],
    },
    {
        name: 'Order Confirmation',
        description: 'Order summary with items and shipping',
        create: createOrderConfirmationTemplate,
        preview: 'order',
        customBlocks: [productCardBlock],
    },
    {
        name: 'Event Invitation',
        description: 'Event details with date, time, and RSVP',
        create: createEventInvitationTemplate,
        preview: 'event',
        customBlocks: [eventDetailsBlock],
    },
    {
        name: 'Password Reset',
        description: 'Simple transactional reset link email',
        create: createPasswordResetTemplate,
        preview: 'reset',
        customBlocks: [],
    },
    {
        name: 'Black Friday Sale',
        description: 'Promo with product picks and discount code',
        create: createBlackFridayTemplate,
        preview: 'sale',
        customBlocks: [productCardBlock, pricingCardBlock],
    },
];
