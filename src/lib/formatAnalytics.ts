/**
 * Presentation-only formatting for Learning Analytics (Phase 1C). None of
 * these functions change what a number means - they only change how it is
 * displayed. See LEARNING_ANALYTICS_METRICS.md (abidii_backend) for the
 * actual metric definitions.
 */

/** A null rate means "no data to compute this from" - never render 0%,
 * which would falsely imply activity with zero success. */
export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return '—';
  return `${(rate * 100).toFixed(rate * 100 >= 10 || rate === 0 || rate === 1 ? 0 : 1)}%`;
}

/** Rate with its raw counts alongside, e.g. "80% · 8 / 10" - always shows
 * sample size so a 1/1 = 100% isn't mistaken for a large, reliable sample. */
export function formatRateWithCount(
  rate: number | null | undefined,
  numerator: number,
  denominator: number,
): { rateLabel: string; countLabel: string } {
  return {
    rateLabel: formatRate(rate),
    countLabel: `${numerator.toLocaleString()} / ${denominator.toLocaleString()}`,
  };
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString();
}

/** Milliseconds -> human-friendly "1m 24s" / "43s" / "12m 10s". Null means
 * no completed sessions/attempts to measure - never rendered as "0s". */
export function formatDurationMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/** A short, non-technical label for a blueprint_content_hash. Never
 * asserts "Current" unless the caller has independently confirmed this
 * hash matches the blueprint's live payload_hash - defaults to a short,
 * stable, debuggable fragment instead. */
export function formatVersionLabel(
  hash: string | null,
  opts?: { isCurrent?: boolean },
): string {
  if (hash === null) return 'Legacy / unknown version';
  if (opts?.isCurrent) return 'Current version';
  const shortHash = hash.replace(/^sha256:/, '').slice(0, 8);
  return `Version ${shortHash}`;
}

/** Sample size is "low" below this - purely a display cue (dim the badge,
 * not hide the metric), not a statistical significance claim. */
export const LOW_SAMPLE_THRESHOLD = 5;

export function isLowSample(n: number): boolean {
  return n > 0 && n < LOW_SAMPLE_THRESHOLD;
}

export function formatSessionStatus(status: string, isLikelyAbandoned: boolean): string {
  if (status === 'completed') return 'Completed';
  if (isLikelyAbandoned) return 'Inactive / likely abandoned';
  return 'In progress';
}
