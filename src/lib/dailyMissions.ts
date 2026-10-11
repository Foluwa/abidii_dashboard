/**
 * Pure helpers for the Daily Missions page. Daily missions are 3 small
 * goals per learner per (learner-local) day - one lesson goal, one game
 * goal and a speaking or review goal - not tied to a course unit. The
 * catalog lives in the backend (app/services/daily_missions_service.py).
 */
import type { MissionCatalogItem, MissionDaySummary } from '@/types/daily-missions';

export type MissionKind = 'lesson' | 'game' | 'speak' | 'review';

export const MISSION_KINDS: MissionKind[] = ['lesson', 'game', 'speak', 'review'];

export const KIND_LABEL: Record<MissionKind, string> = {
  lesson: 'Lesson',
  game: 'Game',
  speak: 'Speaking',
  review: 'Review',
};

const MISSION_LABEL: Record<string, string> = {
  lesson_correct_10: 'Answer 10 lesson questions correctly',
  lesson_correct_20: 'Answer 20 lesson questions correctly',
  lesson_complete_1: 'Complete a lesson',
  game_finish_1: 'Finish a game',
  game_finish_2: 'Finish 2 games',
  game_perfect_1: 'Finish a game with no mistakes',
  game_answers_20: 'Answer 20 game questions',
  speak_practice_3: 'Do 3 speaking exercises',
  review_cards_10: 'Review 10 flashcards',
  practice_review_1: 'Finish a Needs-practice review',
};

export function missionLabel(id: string): string {
  return MISSION_LABEL[id] ?? id;
}

/** Kind of a mission id: catalog first, then the id's prefix. */
export function missionKind(id: string, catalog: MissionCatalogItem[] = []): MissionKind | null {
  const fromCatalog = catalog.find((m) => m.id === id)?.kind;
  const raw = fromCatalog ?? id.split('_')[0];
  if (raw === 'practice') return 'review';
  return (MISSION_KINDS as string[]).includes(raw) ? (raw as MissionKind) : null;
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator ? numerator / denominator : null;
}

export interface MissionTotals {
  days: number;
  learnerDays: number;
  assigned: number;
  claims: number;
  bonus: number;
  allClaimed: number;
  claimRate: number | null;
  allClaimedRate: number | null;
  avgLearnersPerDay: number | null;
  today: MissionDaySummary | null;
}

/** Period totals. `items` is newest-first, as the API returns it. */
export function missionTotals(items: MissionDaySummary[]): MissionTotals {
  const sum = (f: (d: MissionDaySummary) => number) => items.reduce((acc, d) => acc + f(d), 0);
  const learnerDays = sum((d) => d.learners_assigned);
  const assigned = sum((d) => d.missions_assigned);
  const claims = sum((d) => d.claims);
  const allClaimed = sum((d) => d.all_claimed ?? 0);
  return {
    days: items.length,
    learnerDays,
    assigned,
    claims,
    bonus: sum((d) => d.bonus),
    allClaimed,
    claimRate: ratio(claims, assigned),
    allClaimedRate: ratio(allClaimed, learnerDays),
    avgLearnersPerDay: items.length ? learnerDays / items.length : null,
    today: items[0] ?? null,
  };
}

export type DailyKindPoint = { day: string } & Record<MissionKind, number> & { total: number };

/** Claims per day split by mission kind, oldest day first (for a chart). */
export function claimsByKindPerDay(items: MissionDaySummary[], catalog: MissionCatalogItem[]): DailyKindPoint[] {
  return [...items]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => {
      const point: DailyKindPoint = { day: d.day, lesson: 0, game: 0, speak: 0, review: 0, total: d.claims };
      for (const m of d.missions) {
        const kind = missionKind(m.mission_id, catalog);
        if (kind) point[kind] += m.claims;
      }
      return point;
    });
}

export interface MissionRateRow {
  id: string;
  label: string;
  kind: MissionKind | null;
  target: number | null;
  requiresMic: boolean;
  inCatalog: boolean;
  assigned: number;
  claims: number;
  claimRate: number | null;
}

/** One row per mission (catalog order, then retired ids seen in the window). */
export function missionRates(items: MissionDaySummary[], catalog: MissionCatalogItem[]): MissionRateRow[] {
  const totals = new Map<string, { assigned: number; claims: number }>();
  for (const d of items) {
    for (const m of d.missions) {
      const t = totals.get(m.mission_id) ?? { assigned: 0, claims: 0 };
      t.assigned += m.assigned;
      t.claims += m.claims;
      totals.set(m.mission_id, t);
    }
  }
  const ids = [...catalog.map((m) => m.id), ...[...totals.keys()].filter((id) => !catalog.some((m) => m.id === id))];
  return ids.map((id) => {
    const c = catalog.find((m) => m.id === id);
    const t = totals.get(id) ?? { assigned: 0, claims: 0 };
    return {
      id,
      label: missionLabel(id),
      kind: missionKind(id, catalog),
      target: c?.target ?? null,
      requiresMic: c?.requires_mic ?? false,
      inCatalog: !!c,
      assigned: t.assigned,
      claims: t.claims,
      claimRate: ratio(t.claims, t.assigned),
    };
  });
}

export function formatPercent(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return '—';
  return `${Math.round(rate * 100)}%`;
}
