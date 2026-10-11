"use client";

import React from "react";
import {
  Bot,
  BookOpen,
  CaseSensitive,
  Ear,
  GalleryVerticalEnd,
  Grid3x3,
  Mic,
  PawPrint,
  RotateCcw,
  Timer,
  type LucideIcon,
} from "lucide-react";

/**
 * Quick Practice carousel helpers (Content → Quick Practice).
 *
 * `icon` is a short Material icon name interpreted by the Flutter app's
 * quickPracticeIconFromString (abidii/lib/src/features/home/presentation/
 * widgets/home_v2/quick_practice_carousel.dart). Keep this map in sync with
 * that switch: any other value renders a plain circle in the app.
 */
export const QUICK_PRACTICE_ICONS: Record<string, { Icon: LucideIcon; label: string }> = {
  style: { Icon: GalleryVerticalEnd, label: "Cards (style)" },
  timer: { Icon: Timer, label: "Timer" },
  mic: { Icon: Mic, label: "Microphone" },
  book: { Icon: BookOpen, label: "Book" },
  abc: { Icon: CaseSensitive, label: "ABC" },
  ear: { Icon: Ear, label: "Ear (listening)" },
  review: { Icon: RotateCcw, label: "Review" },
  smart_toy: { Icon: Bot, label: "Robot (smart_toy)" },
  dialpad: { Icon: Grid3x3, label: "Dial pad" },
  pets: { Icon: PawPrint, label: "Paw (pets)" },
};

export const KNOWN_QUICK_PRACTICE_ICON_NAMES = Object.keys(QUICK_PRACTICE_ICONS);

export function getQuickPracticeIcon(name: string | null | undefined) {
  const key = (name || "").trim();
  return QUICK_PRACTICE_ICONS[key] ?? null;
}

/** Select options for the icon picker; keeps an unknown current value. */
export function getQuickPracticeIconOptions(currentValue?: string | null) {
  const options = KNOWN_QUICK_PRACTICE_ICON_NAMES.map((name) => ({
    value: name,
    label: `${QUICK_PRACTICE_ICONS[name].label} — ${name}`,
  }));
  const current = (currentValue || "").trim();
  if (current && !QUICK_PRACTICE_ICONS[current]) {
    options.push({ value: current, label: `${current} (not recognised by the app)` });
  }
  return options;
}

export function QuickPracticeIcon({ name }: { name: string | null | undefined }) {
  const raw = (name || "").trim();
  const entry = getQuickPracticeIcon(raw);
  if (entry) {
    const { Icon } = entry;
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground"
        title={raw}
        aria-label={`Icon: ${raw}`}
        role="img"
        data-icon-name={raw}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }
  // Unknown name: the app falls back to a plain circle - show the readable
  // name so it's obvious and fixable.
  return (
    <span
      className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
      title={raw ? `"${raw}" is not a known icon - the app shows a plain circle` : "No icon"}
      data-icon-name={raw}
    >
      {raw || "—"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

export interface OrderedItem {
  item_id: string;
  sort_order: number;
}

/** Display order: sort_order, then item_id (same tiebreak as the backend). */
export function sortQuickPracticeItems<T extends OrderedItem>(items: ReadonlyArray<T>): T[] {
  return [...items].sort(
    (a, b) => a.sort_order - b.sort_order || a.item_id.localeCompare(b.item_id),
  );
}

/**
 * Items whose sort_order must change for the list to be a clean 0..n-1
 * sequence in display order (duplicates like two rows at 3, or gaps).
 * Empty when the order is already contiguous.
 */
export function getSortOrderFixes<T extends OrderedItem>(
  items: ReadonlyArray<T>,
): Array<{ item: T; sort_order: number }> {
  return sortQuickPracticeItems(items)
    .map((item, index) => ({ item, sort_order: index }))
    .filter(({ item, sort_order }) => item.sort_order !== sort_order);
}
