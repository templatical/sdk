export type ScoringSeverity = "high" | "medium" | "low" | string;

export function scoreColor(score: number): string {
  if (score >= 80) return "var(--tpl-success)";
  if (score >= 60) return "var(--tpl-warning)";
  return "var(--tpl-danger)";
}

export function scoreBgColor(score: number): string {
  if (score >= 80) return "var(--tpl-success-light)";
  if (score >= 60) return "var(--tpl-warning-light)";
  return "var(--tpl-danger-light)";
}

export function severityColor(severity: ScoringSeverity): string {
  if (severity === "high") return "var(--tpl-danger)";
  if (severity === "medium") return "var(--tpl-warning)";
  return "var(--tpl-text-muted)";
}

export function severityBgColor(severity: ScoringSeverity): string {
  if (severity === "high") return "var(--tpl-danger-light)";
  if (severity === "medium") return "var(--tpl-warning-light)";
  return "var(--tpl-bg-hover)";
}
