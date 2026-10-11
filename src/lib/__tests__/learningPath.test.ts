import { biggestDropOffs, completionsByUnitSeries, funnelRows, msToMinutes } from '@/lib/learningPath';
import { learningPathFixture } from '@/test-fixtures/learningPathFixtures';

describe('learningPath helpers', () => {
  it('builds the funnel from live lessons only, numbered unit.lesson, with step drop-off', () => {
    const rows = funnelRows(learningPathFixture().units);
    expect(rows.map((r) => r.label)).toEqual(['1.1', '1.2', '2.1']);
    expect(rows.map((r) => r.reached)).toEqual([20, 10, 9]);
    expect(rows[0].dropOff).toBeNull();
    expect(rows[1].dropOff).toBeCloseTo(0.5);
    expect(rows[2].dropOff).toBeCloseTo(0.1);
    expect(rows[0].medianMinutes).toBe(2);
    expect(rows[2].medianMinutes).toBeNull();
  });

  it('ranks the biggest drop-offs', () => {
    const rows = funnelRows(learningPathFixture().units);
    expect(biggestDropOffs(rows, 1).map((r) => r.title)).toEqual(['Goodbye']);
    // previous step below the minimum sample is ignored
    expect(biggestDropOffs(rows, 3, 50)).toEqual([]);
  });

  it('splits completions into top units plus other, in course order', () => {
    const fx = learningPathFixture();
    const { keys, points } = completionsByUnitSeries(fx.series, fx.units, 1);
    expect(keys.map((k) => k.label)).toEqual(['Unit 1: Greetings', 'Other units']);
    expect(points[0]).toMatchObject({ u0: 4, other: 1 });
    expect(points[1]).toMatchObject({ u0: 3, other: 0, partial: true });
    const all = completionsByUnitSeries(fx.series, fx.units);
    expect(all.keys.map((k) => k.key)).toEqual(['u0', 'u1']);
  });

  it('converts ms to minutes', () => {
    expect(msToMinutes(90000)).toBe(1.5);
    expect(msToMinutes(null)).toBeNull();
  });
});
