import type {
  AcquisitionCountryCount,
  AcquisitionDayCount,
  AcquisitionOption,
  AcquisitionSourceCount,
} from '@/types/onboarding';
import { maskEmail } from '@/lib/maskEmail';

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD of a date in UTC. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Last `days` days including today (UTC). */
export function lastNDaysRange(days: number, today: Date = new Date()): { from: string; to: string } {
  const to = isoDay(today);
  const from = isoDay(new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * DAY_MS));
  return { from, to };
}

/** Every day from `from` to `to` inclusive (capped at 400 days). */
export function daysBetween(from: string, to: string): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
  const out: string[] = [];
  for (let t = start; t <= end && out.length < 400; t += DAY_MS) out.push(isoDay(new Date(t)));
  return out;
}

/** Share of sign-ups who answered, or null when there were none. */
export function answerRate(answered: number, signups: number): number | null {
  return signups > 0 ? answered / signups : null;
}

export function formatRate(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

/** "word_of_mouth" -> "Word of mouth" */
export function humanizeKey(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

/** English label of a source from the options list, else the humanized key. */
export function sourceLabel(source: string, options: AcquisitionOption[] | undefined): string {
  const option = options?.find((o) => o.key === source);
  return option?.labels?.en?.trim() || humanizeKey(source);
}

/** Sources by total count, largest first (ties by key for a stable order). */
export function rankSources(bySource: AcquisitionSourceCount[]): string[] {
  return [...bySource]
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
    .map((row) => row.source);
}

/**
 * One row per day of the range, with a count per source (0 when missing),
 * keyed by `seriesKey(source)` so it can be fed straight to a stacked chart.
 */
export function pivotOverTime(
  rows: AcquisitionDayCount[],
  sources: string[],
  from: string,
  to: string,
  seriesKey: (source: string) => string,
): Array<Record<string, string | number>> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.date.slice(0, 10)}|${row.source}`;
    counts.set(key, (counts.get(key) ?? 0) + row.count);
  }
  const days = daysBetween(from, to);
  // If the range is unusable, fall back to the days present in the data.
  const axis = days.length ? days : Array.from(new Set(rows.map((r) => r.date.slice(0, 10)))).sort();
  return axis.map((day) => {
    const out: Record<string, string | number> = { day };
    for (const source of sources) out[seriesKey(source)] = counts.get(`${day}|${source}`) ?? 0;
    return out;
  });
}

export interface CountryRow {
  country: string | null;
  total: number;
  bySource: Record<string, number>;
}

/** Country × source matrix, biggest countries first, unknown country last. */
export function pivotByCountry(rows: AcquisitionCountryCount[]): CountryRow[] {
  const map = new Map<string, CountryRow>();
  for (const row of rows) {
    const id = row.country ?? '';
    let entry = map.get(id);
    if (!entry) {
      entry = { country: row.country ?? null, total: 0, bySource: {} };
      map.set(id, entry);
    }
    entry.total += row.count;
    entry.bySource[row.source] = (entry.bySource[row.source] ?? 0) + row.count;
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.country == null && b.country != null) return 1;
    if (b.country == null && a.country != null) return -1;
    return b.total - a.total || (a.country ?? '').localeCompare(b.country ?? '');
  });
}

const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Free-text answers can contain an email address; never show one in full. */
export function maskEmailsInText(text: string): string {
  return text.replace(EMAIL_IN_TEXT, (match) => maskEmail(match));
}
