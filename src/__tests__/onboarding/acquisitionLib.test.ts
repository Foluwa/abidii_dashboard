import {
  answerRate,
  daysBetween,
  formatRate,
  lastNDaysRange,
  maskEmailsInText,
  pivotByCountry,
  pivotOverTime,
  rankSources,
  sourceLabel,
} from '@/lib/acquisition';
import { reorderUpdates } from '@/components/content/onboarding/shared';

describe('acquisition helpers', () => {
  it('builds an inclusive last-N-days range', () => {
    expect(lastNDaysRange(30, new Date('2026-10-14T12:00:00Z'))).toEqual({ from: '2026-09-15', to: '2026-10-14' });
    expect(daysBetween('2026-10-01', '2026-10-03')).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(daysBetween('2026-10-03', '2026-10-01')).toEqual([]);
  });

  it('computes the answer rate', () => {
    expect(formatRate(answerRate(30, 40))).toBe('75%');
    expect(formatRate(answerRate(0, 0))).toBe('—');
  });

  it('labels sources from options, else humanizes the key', () => {
    const options = [{ key: 'tiktok', labels: { en: 'TikTok', fr: '', es: '', pt: '', yo: '' }, icon: '', image_url: null, enabled: true, sort_order: 1 }];
    expect(sourceLabel('tiktok', options)).toBe('TikTok');
    expect(sourceLabel('friend_family', options)).toBe('Friend family');
  });

  it('ranks sources and fills missing days with zero', () => {
    const ranked = rankSources([{ source: 'a', count: 1 }, { source: 'b', count: 5 }]);
    expect(ranked).toEqual(['b', 'a']);
    const rows = pivotOverTime([{ date: '2026-10-02', source: 'a', count: 2 }], ranked, '2026-10-01', '2026-10-02', (s) => s);
    expect(rows).toEqual([
      { day: '2026-10-01', b: 0, a: 0 },
      { day: '2026-10-02', b: 0, a: 2 },
    ]);
  });

  it('pivots country x source with unknown country last', () => {
    const rows = pivotByCountry([
      { country: null, source: 'a', count: 9 },
      { country: 'NG', source: 'a', count: 2 },
      { country: 'NG', source: 'b', count: 3 },
      { country: 'GB', source: 'a', count: 1 },
    ]);
    expect(rows.map((r) => r.country)).toEqual(['NG', 'GB', null]);
    expect(rows[0]).toMatchObject({ total: 5, bySource: { a: 2, b: 3 } });
  });

  it('masks email addresses in free text', () => {
    expect(maskEmailsInText('ask folu@abidii.app please')).toBe('ask fo••••@abidii.app please');
  });

  it('renumbers only the rows whose order changed', () => {
    const items = [{ id: 'x', o: 10 }, { id: 'y', o: 20 }, { id: 'z', o: 30 }];
    expect(reorderUpdates(items, 2, -1, (i) => i.id, (i) => i.o)).toEqual([['z', 20], ['y', 30]]);
    expect(reorderUpdates(items, 0, -1, (i) => i.id, (i) => i.o)).toEqual([]);
  });
});
