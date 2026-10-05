import type { CustomBlockDefinition } from "@templatical/types";

export type CustomBlockIssueSeverity = "error" | "warning";

export interface CustomBlockIssue {
  ruleId: string;
  severity: CustomBlockIssueSeverity;
  message: string;
  /** JSON-pointer-ish location, e.g. "/fields/2/default". Absent for whole-definition issues. */
  path?: string;
}

export interface DataSourcePreview {
  label: string;
  request: {
    method?: "GET" | "POST";
    /** Liquid over the block's fieldValues; values are URL-encoded. */
    url: string;
    /** Values may hold `${env:NAME}`; never `{{ }}`. */
    headers?: Record<string, string>;
    /** Liquid over the block's fieldValues, raw. */
    body?: string;
  };
  /** Field key → dot/index path into the JSON response ("images[0].url"). */
  map: Record<string, string>;
}

export type CustomBlockWorkingFile = Omit<
  CustomBlockDefinition,
  "dataSource"
> & {
  dataSourcePreview?: DataSourcePreview;
};

export interface CustomBlockCheckResult {
  valid: boolean;
  issues: CustomBlockIssue[];
}
