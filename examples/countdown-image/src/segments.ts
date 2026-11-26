import type { CountdownBlock } from "@templatical/types";

export type SegmentFields = Pick<
  CountdownBlock,
  | "showDays"
  | "showHours"
  | "showMinutes"
  | "showSeconds"
  | "labelDays"
  | "labelHours"
  | "labelMinutes"
  | "labelSeconds"
>;

/**
 * Split the remaining seconds into the visible units. Each visible unit takes
 * what is left after the larger visible units, so a hidden unit's time moves
 * into the next visible smaller one: with minutes hidden, 3,661 seconds show
 * as 01 hours and 61 seconds.
 */
export function segments(
  fields: SegmentFields,
  seconds: number,
): { digits: string; label: string }[] {
  const units = [
    { show: fields.showDays, size: 86400, label: fields.labelDays, pad: false },
    { show: fields.showHours, size: 3600, label: fields.labelHours, pad: true },
    {
      show: fields.showMinutes,
      size: 60,
      label: fields.labelMinutes,
      pad: true,
    },
    {
      show: fields.showSeconds,
      size: 1,
      label: fields.labelSeconds,
      pad: true,
    },
  ];
  const result: { digits: string; label: string }[] = [];
  let rest = seconds;
  for (const unit of units) {
    if (!unit.show) continue;
    const value = Math.floor(rest / unit.size);
    rest -= value * unit.size;
    result.push({
      digits: unit.pad ? String(value).padStart(2, "0") : String(value),
      label: unit.label,
    });
  }
  return result;
}
