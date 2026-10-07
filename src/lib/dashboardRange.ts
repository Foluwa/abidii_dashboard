/**
 * The dashboard's date range (?range=). Mirrors the backend contract in
 * abidii_backend/app/services/analytics_range.py: UTC calendar days, both
 * bounds inclusive and ending today; 7d/30d grouped by day, 6m by ISO week,
 * 1y and all by calendar month; "all" is the complete available history.
 */
export type RangeKey = "all" | "7d" | "30d" | "6m" | "1y";
export type Granularity = "day" | "week" | "month";

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last 1 year" },
];

export const DEFAULT_RANGE: RangeKey = "all";

export function parseRange(raw: string | null | undefined): RangeKey {
  return raw === "7d" || raw === "30d" || raw === "6m" || raw === "1y" || raw === "all"
    ? raw
    : DEFAULT_RANGE;
}

export function rangeLabel(key: RangeKey): string {
  return RANGE_OPTIONS.find((o) => o.value === key)?.label ?? "All time";
}

/** "per day" / "per week" / "per month" */
export function perGranularity(g: Granularity | undefined): string {
  return g === "week" ? "per week" : g === "month" ? "per month" : "per day";
}

/** Short comparison phrase for KPI deltas, e.g. "vs previous 7 days". */
export function previousPeriodLabel(key: RangeKey): string | null {
  switch (key) {
    case "7d":
      return "vs previous 7 days";
    case "30d":
      return "vs previous 30 days";
    case "6m":
      return "vs previous 6 months";
    case "1y":
      return "vs previous year";
    default:
      return null;
  }
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
const fullDayFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function utcDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

/** Axis tick for a bucket start. */
export function formatBucketTick(iso: string, g: Granularity | undefined): string {
  const d = utcDate(iso);
  return g === "month" ? monthFmt.format(d) : dayFmt.format(d);
}

/** Tooltip label for a bucket, e.g. "Week of 6 Oct 2026". */
export function formatBucketLabel(
  start: string,
  end: string,
  g: Granularity | undefined,
  partial?: boolean,
): string {
  const suffix = partial ? " (partial)" : "";
  if (g === "month") return `${monthFmt.format(utcDate(start))}${suffix}`;
  if (g === "week") {
    return `${dayFmt.format(utcDate(start))} – ${fullDayFmt.format(utcDate(end))}${suffix}`;
  }
  return `${fullDayFmt.format(utcDate(start))}${suffix}`;
}
