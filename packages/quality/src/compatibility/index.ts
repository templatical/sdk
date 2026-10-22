import type { Block, TemplateContent } from "@templatical/types";
import type {
  CompatibilityLintOptions,
  LintIssue,
  LintOptions,
  Rule,
  Severity,
} from "../types";
import { DEFAULT_COMPATIBILITY_THRESHOLDS } from "../types";
import { walkBlocks } from "../walk";
import { resolveCompatibilityOptions } from "../run-rules";
import { CANIEMAIL_DATA } from "./data/caniemail.generated";
import slugs from "./slugs.json";
import { detect } from "./detect";
import { scanBlock, scanHtml, type Scan } from "./scan";
import { formatClientGroups, supportFor } from "./support";
import { formatCompatibilityMessage } from "./messages";

export {
  formatCompatibilityMessage,
  getCompatibilityMessages,
  SUPPORTED_COMPATIBILITY_MESSAGE_LOCALES,
} from "./messages";
export type { CompatibilityMessageMap } from "./messages";

const catalog =
  "https://docs.templatical.com/quality/compatibility/rule-catalog";
const handRules = ["html-script", "html-iframe"] as const;
const dataRules: Rule[] = slugs.map((slug) => ({
  meta: {
    id: `compat.${slug}`,
    severity: "warning",
    reference: CANIEMAIL_DATA[slug as keyof typeof CANIEMAIL_DATA].url,
  },
}));

export const COMPATIBILITY_RULES: Rule[] = [
  ...dataRules,
  ...handRules.map((slug): Rule => ({
    meta: {
      id: `compat.${slug}`,
      severity: "warning",
      reference: `${catalog}#compat-${slug}`,
    },
  })),
  {
    meta: {
      id: "compat.gmail-clipping",
      severity: "warning",
      reference: `${catalog}#compat-gmail-clipping`,
    },
    compiledHtml(html, opts) {
      const bytes = new TextEncoder().encode(html).byteLength;
      return bytes > opts.compatibility.maxHtmlBytes
        ? [
            {
              blockId: null,
              params: {
                size: new Intl.NumberFormat(opts.locale, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }).format(bytes / 1024),
                max: new Intl.NumberFormat(opts.locale, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }).format(opts.compatibility.maxHtmlBytes / 1024),
              },
            },
          ]
        : [];
    },
  },
];

function lintScan(
  scan: Scan,
  blockId: string | null,
  options: LintOptions,
): LintIssue[] {
  const tool = options.compatibility || {};
  const resolved = resolveCompatibilityOptions(
    options.locale,
    tool,
    COMPATIBILITY_RULES,
  );
  const issues: LintIssue[] = [];
  for (const rule of COMPATIBILITY_RULES) {
    const id = rule.meta.id;
    if (id === "compat.gmail-clipping" || resolved.severity(id) === "off")
      continue;
    const finding = detect(scan, id);
    if (!finding) continue;
    const hand = id === "compat.html-script" || id === "compat.html-iframe";
    const clients = hand ? undefined : supportFor(id.slice(7), finding.usage);
    if (!hand && clients?.length === 0) continue;
    const unsupported =
      clients?.some((client) => client.support === "unsupported") ?? true;
    const defaultSeverity: Exclude<Severity, "off"> = unsupported
      ? "warning"
      : "info";
    const configured = tool.rules?.[id];
    const severity =
      configured && configured !== "off" ? configured : defaultSeverity;
    const params: Record<string, string | number> = {
      excerpt: finding.excerpt,
      value: finding.value ?? "",
      tag: finding.tag ?? "",
    };
    if (clients) {
      if (unsupported)
        params.unsupported = formatClientGroups(
          clients,
          "unsupported",
          resolved.locale,
        );
      if (clients.some((client) => client.support === "partial"))
        params.partial = formatClientGroups(
          clients,
          "partial",
          resolved.locale,
        );
    }
    const formatted = formatCompatibilityMessage(resolved.locale, id, params);
    issues.push({
      blockId,
      ruleId: id,
      severity,
      ...formatted,
      reference: rule.meta.reference,
      ...(clients ? { clients } : {}),
      excerpt: finding.excerpt,
    });
  }
  return issues;
}

/** Scan only authored HTML/CSS and URL fields that pass through rendering. */
export function lintCompatibility(
  content: TemplateContent,
  options: LintOptions = {},
): LintIssue[] {
  if (options.disabled === true || options.compatibility === false) return [];
  const issues: LintIssue[] = [];
  const cache = new WeakMap<Block, Scan>();
  walkBlocks(content, (block) => {
    let scan = cache.get(block);
    if (!scan) {
      scan = scanBlock(block);
      cache.set(block, scan);
    }
    issues.push(...lintScan(scan, block.id, options));
  });
  return issues;
}

export interface HtmlFragmentOptions {
  stylesheet?: string;
  locale?: string;
  compatibility?: false | CompatibilityLintOptions;
}

export function lintHtmlFragment(
  html: string,
  options: HtmlFragmentOptions = {},
): LintIssue[] {
  if (options.compatibility === false) return [];
  return lintScan(scanHtml(html, options.stylesheet), null, options);
}

/** Measure compiled HTML only. Callers choose when and how to render. */
export function lintCompiledHtml(
  html: string,
  options: LintOptions = {},
): LintIssue[] {
  if (options.disabled === true || options.compatibility === false) return [];
  const tool = options.compatibility || {};
  const opts = resolveCompatibilityOptions(
    options.locale,
    tool,
    COMPATIBILITY_RULES,
  );
  const rule = COMPATIBILITY_RULES.find(
    (entry) => entry.meta.id === "compat.gmail-clipping",
  )!;
  const severity = opts.severity(rule.meta.id);
  if (severity === "off") return [];
  return rule.compiledHtml!(html, opts).map((hit) => ({
    blockId: null,
    ruleId: rule.meta.id,
    severity: severity as Exclude<Severity, "off">,
    ...formatCompatibilityMessage(opts.locale, rule.meta.id, hit.params),
    reference: rule.meta.reference,
  }));
}

export { DEFAULT_COMPATIBILITY_THRESHOLDS };
