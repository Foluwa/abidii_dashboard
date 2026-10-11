/**
 * Pure shaping for the Learning Path analytics page. Numbers come from
 * GET /api/v1/admin/analytics/learning-path; nothing here redefines a
 * metric, it only reorders/derives display rows.
 */
import type { LearningPathPoint, LearningPathSection, LearningPathUnit } from '@/types/learning-path';

export interface FunnelRow {
  position: number;
  label: string;
  title: string;
  unitTitle: string;
  unitPosition: number;
  reached: number;
  completed: number;
  /** Share of the previous live lesson's learners who never reached this one. */
  dropOff: number | null;
  medianMinutes: number | null;
  activeMinutes: number | null;
  timedSessions: number;
}

/** Live lessons in path order, numbered "unit.lesson" (e.g. 3.2). */
export function funnelRows(units: LearningPathUnit[]): FunnelRow[] {
  const rows: FunnelRow[] = [];
  let prev: number | null = null;
  units.forEach((unit, ui) => {
    const live = unit.sections.filter((s) => s.live);
    live.forEach((s, si) => {
      rows.push({
        position: s.position,
        label: `${ui + 1}.${si + 1}`,
        title: s.title,
        unitTitle: unit.title,
        unitPosition: ui + 1,
        reached: s.learners_started,
        completed: s.learners_completed,
        dropOff: prev ? Math.max(0, 1 - s.learners_started / prev) : null,
        medianMinutes: msToMinutes(s.median_wall_clock_ms),
        activeMinutes: msToMinutes(s.median_active_ms),
        timedSessions: s.timed_sessions,
      });
      prev = s.learners_started;
    });
  });
  return rows;
}

export function msToMinutes(ms: number | null | undefined): number | null {
  return ms === null || ms === undefined ? null : Math.round((ms / 60000) * 10) / 10;
}

/** The biggest single-step drop-offs (ignoring steps from fewer than `minLearners`). */
export function biggestDropOffs(rows: FunnelRow[], count = 3, minLearners = 5): FunnelRow[] {
  return rows
    .filter((r, i) => i > 0 && r.dropOff !== null && rows[i - 1].reached >= minLearners)
    .sort((a, b) => (b.dropOff ?? 0) - (a.dropOff ?? 0))
    .slice(0, count)
    .filter((r) => (r.dropOff ?? 0) > 0);
}

export const OTHER_UNITS_KEY = 'other';

export interface UnitSeries {
  /** chart keys: u0..u3 for the top units, then "other" */
  keys: { key: string; label: string; unitId: string | null }[];
  points: Array<Record<string, number | string | boolean>>;
}

/**
 * Lesson completions per bucket, split into the `top` units with the most
 * completions in the range plus "Other units". Colours follow the unit's
 * place in the course (keys are ordered by course position), not its rank.
 */
export function completionsByUnitSeries(
  series: LearningPathPoint[],
  units: LearningPathUnit[],
  top = 4,
): UnitSeries {
  const totals = new Map<string, number>();
  for (const p of series) {
    for (const [unitId, n] of Object.entries(p.completions_by_unit)) {
      totals.set(unitId, (totals.get(unitId) ?? 0) + n);
    }
  }
  const ranked = [...totals.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const topIds = new Set(ranked.slice(0, top).map(([id]) => id));
  const ordered = units.filter((u) => topIds.has(u.unit_id));
  const keys: UnitSeries['keys'] = ordered.map((u, i) => ({
    key: `u${i}`,
    label: `Unit ${u.position}: ${u.title}`,
    unitId: u.unit_id,
  }));
  const hasOther = ranked.length > topIds.size;
  if (hasOther) keys.push({ key: OTHER_UNITS_KEY, label: 'Other units', unitId: null });

  const points = series.map((p) => {
    const point: Record<string, number | string | boolean> = {
      start: p.period_start,
      end: p.period_end,
      partial: p.partial,
    };
    for (const k of keys) point[k.key] = 0;
    for (const [unitId, n] of Object.entries(p.completions_by_unit)) {
      const k = keys.find((x) => x.unitId === unitId);
      const key = k ? k.key : OTHER_UNITS_KEY;
      if (key in point) point[key] = (point[key] as number) + n;
    }
    return point;
  });
  return { keys, points };
}

export function sectionShareOfPremium(s: LearningPathSection): number | null {
  return s.learners_started ? s.premium_started / s.learners_started : null;
}
