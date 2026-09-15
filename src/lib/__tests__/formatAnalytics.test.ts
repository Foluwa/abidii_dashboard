import {
  formatRate,
  formatRateWithCount,
  formatCount,
  formatDurationMs,
  formatVersionLabel,
  isLowSample,
} from '@/lib/formatAnalytics';

describe('formatRate', () => {
  it('renders null/undefined as an em dash, never 0%', () => {
    expect(formatRate(null)).toBe('—');
    expect(formatRate(undefined)).toBe('—');
  });

  it('renders 0 as 0%, distinct from null', () => {
    expect(formatRate(0)).toBe('0%');
  });

  it('renders 1 as 100%', () => {
    expect(formatRate(1)).toBe('100%');
  });

  it('renders mid-range rates with one decimal below 10%', () => {
    expect(formatRate(0.05)).toBe('5.0%');
  });

  it('renders rates at/above 10% with no decimal', () => {
    expect(formatRate(0.5)).toBe('50%');
  });
});

describe('formatRateWithCount', () => {
  it('pairs the formatted rate with raw counts', () => {
    const { rateLabel, countLabel } = formatRateWithCount(0.8, 8, 10);
    expect(rateLabel).toBe('80%');
    expect(countLabel).toBe('8 / 10');
  });
});

describe('formatCount', () => {
  it('renders null/undefined as an em dash', () => {
    expect(formatCount(null)).toBe('—');
    expect(formatCount(undefined)).toBe('—');
  });

  it('renders 0 as "0", not an em dash', () => {
    expect(formatCount(0)).toBe('0');
  });

  it('adds thousands separators', () => {
    expect(formatCount(12345)).toBe('12,345');
  });
});

describe('formatDurationMs', () => {
  it('renders null/undefined as an em dash, never 0s', () => {
    expect(formatDurationMs(null)).toBe('—');
    expect(formatDurationMs(undefined)).toBe('—');
  });

  it('renders sub-minute durations as seconds only', () => {
    expect(formatDurationMs(43000)).toBe('43s');
  });

  it('renders minute+second durations', () => {
    expect(formatDurationMs(84000)).toBe('1m 24s');
  });
});

describe('formatVersionLabel', () => {
  it('labels a null hash as legacy/unknown, never a bare "null"', () => {
    expect(formatVersionLabel(null)).toBe('Legacy / unknown version');
  });

  it('shows a short stable fragment of the hash by default', () => {
    expect(formatVersionLabel('sha256:abcdef1234567890')).toBe('Version abcdef12');
  });

  it('only says "Current version" when the caller explicitly confirms it', () => {
    expect(formatVersionLabel('sha256:abcdef1234567890', { isCurrent: true })).toBe('Current version');
    expect(formatVersionLabel('sha256:abcdef1234567890', { isCurrent: false })).toBe('Version abcdef12');
  });
});

describe('isLowSample', () => {
  it('flags samples below the threshold but above zero', () => {
    expect(isLowSample(1)).toBe(true);
    expect(isLowSample(4)).toBe(true);
  });

  it('does not flag zero (that is an empty state, not a low sample)', () => {
    expect(isLowSample(0)).toBe(false);
  });

  it('does not flag samples at or above the threshold', () => {
    expect(isLowSample(5)).toBe(false);
    expect(isLowSample(100)).toBe(false);
  });
});
