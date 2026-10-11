import { claimsByKindPerDay, missionKind, missionRates, missionTotals } from '@/lib/dailyMissions';
import { missionsSummaryFixture } from '@/test-fixtures/dailyMissionsFixtures';

describe('dailyMissions helpers', () => {
  const { items, catalog } = missionsSummaryFixture();

  it('totals the period and the share of learner-days with every mission claimed', () => {
    const t = missionTotals(items);
    expect(t.claims).toBe(7);
    expect(t.assigned).toBe(15);
    expect(t.claimRate).toBeCloseTo(7 / 15);
    expect(t.allClaimed).toBe(1);
    expect(t.allClaimedRate).toBeCloseTo(1 / 5);
    expect(t.today?.day).toBe('2026-10-11');
  });

  it('groups claims per day by kind, oldest first', () => {
    const points = claimsByKindPerDay(items, catalog);
    expect(points.map((p) => p.day)).toEqual(['2026-10-10', '2026-10-11']);
    expect(points[1]).toMatchObject({ lesson: 3, game: 2, review: 0, total: 5 });
  });

  it('rates each mission in catalog order and keeps retired ids', () => {
    const rows = missionRates(items, catalog);
    expect(rows.map((r) => r.id)).toEqual(['lesson_complete_1', 'game_finish_1', 'review_cards_10', 'old_mission']);
    expect(rows[0]).toMatchObject({ assigned: 5, claims: 4, label: 'Complete a lesson', kind: 'lesson' });
    expect(rows[2].claimRate).toBe(0);
    expect(rows[3]).toMatchObject({ inCatalog: false, kind: null });
  });

  it('derives the kind of practice missions', () => {
    expect(missionKind('practice_review_1')).toBe('review');
    expect(missionKind('speak_practice_3')).toBe('speak');
  });
});
