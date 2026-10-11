import React from 'react';
import { render, screen } from '@testing-library/react';

import {
  KNOWN_QUICK_PRACTICE_ICON_NAMES,
  QuickPracticeIcon,
  getQuickPracticeIcon,
  getQuickPracticeIconOptions,
  getSortOrderFixes,
  sortQuickPracticeItems,
} from '@/components/content/quickPractice';

describe('Quick Practice icon mapping', () => {
  it('maps every icon name the Flutter carousel understands', () => {
    // Mirrors quickPracticeIconFromString in the app's quick_practice_carousel.dart.
    const appNames = ['style', 'timer', 'mic', 'book', 'abc', 'ear', 'review', 'smart_toy', 'dialpad', 'pets'];
    expect([...KNOWN_QUICK_PRACTICE_ICON_NAMES].sort()).toEqual([...appNames].sort());
    for (const name of appNames) expect(getQuickPracticeIcon(name)).not.toBeNull();
  });

  it('returns null for unknown / empty names', () => {
    expect(getQuickPracticeIcon('rocket')).toBeNull();
    expect(getQuickPracticeIcon('')).toBeNull();
    expect(getQuickPracticeIcon(undefined)).toBeNull();
  });

  it('renders a known icon as an svg with the name as tooltip', () => {
    render(<QuickPracticeIcon name="dialpad" />);
    const el = screen.getByRole('img', { name: 'Icon: dialpad' });
    expect(el).toHaveAttribute('title', 'dialpad');
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('falls back to a readable chip for unknown names', () => {
    render(<QuickPracticeIcon name="rocket" />);
    const chip = screen.getByText('rocket');
    expect(chip.getAttribute('title')).toMatch(/not a known icon/);
    expect(chip.querySelector('svg')).toBeNull();
  });

  it('keeps an unknown current value in the picker options', () => {
    const opts = getQuickPracticeIconOptions('rocket');
    expect(opts.map((o) => o.value)).toContain('rocket');
    expect(getQuickPracticeIconOptions('timer').map((o) => o.value)).not.toContain('rocket');
  });
});

describe('Quick Practice ordering', () => {
  // Production shape: dictionary and time_blitz both at 3.
  const prod = [
    { item_id: 'time_blitz', sort_order: 3 },
    { item_id: 'alphabet', sort_order: 0 },
    { item_id: 'dictionary', sort_order: 3 },
    { item_id: 'numbers', sort_order: 1 },
    { item_id: 'proverbs', sort_order: 4 },
  ];

  it('sorts by sort_order then item_id (backend tiebreak)', () => {
    expect(sortQuickPracticeItems(prod).map((i) => i.item_id)).toEqual([
      'alphabet', 'numbers', 'dictionary', 'time_blitz', 'proverbs',
    ]);
  });

  it('renumbers duplicates into a contiguous 0..n-1 sequence', () => {
    const fixes = getSortOrderFixes(prod);
    // Only dictionary moves (3 -> 2); time_blitz and proverbs already match their index.
    expect(fixes.map((f) => [f.item.item_id, f.sort_order])).toEqual([['dictionary', 2]]);
    // Applying the fixes yields 0..n-1 with no duplicates.
    const applied = prod.map((p) => ({ ...p, sort_order: fixes.find((f) => f.item.item_id === p.item_id)?.sort_order ?? p.sort_order }));
    expect(sortQuickPracticeItems(applied).map((i) => i.sort_order)).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns no fixes for an already clean order', () => {
    expect(getSortOrderFixes([{ item_id: 'a', sort_order: 0 }, { item_id: 'b', sort_order: 1 }])).toEqual([]);
  });

  it('closes gaps', () => {
    const fixes = getSortOrderFixes([{ item_id: 'a', sort_order: 2 }, { item_id: 'b', sort_order: 7 }]);
    expect(fixes.map((f) => f.sort_order)).toEqual([0, 1]);
  });
});
