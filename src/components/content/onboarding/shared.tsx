'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Settings2 } from 'lucide-react';
import { describeApiError, ONBOARDING_CONFIG_HREF } from '@/lib/onboardingApi';

export const TH = 'whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground';
export const TD = 'px-4 py-3 text-sm text-foreground align-top';
export const INPUT =
  'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/20 dark:bg-gray-900 dark:focus:border-brand-800 disabled:opacity-50';
export const LABEL = 'mb-1.5 block text-sm font-medium text-foreground';
export const ICON_BUTTON =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-30';

/** On/off switch with an accessible name. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  title,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title ?? (checked ? 'On (click to turn off)' : 'Off (click to turn on)')}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={`flex h-6 w-10 items-center rounded-full transition-colors ${
          checked ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`}
        />
      </span>
    </button>
  );
}

/** Up / down buttons for reordering a row. */
export function ReorderButtons({
  label,
  isFirst,
  isLast,
  disabled,
  onMove,
}: {
  label: string;
  isFirst: boolean;
  isLast: boolean;
  disabled?: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        className={ICON_BUTTON}
        aria-label={`Move ${label} up`}
        disabled={disabled || isFirst}
        onClick={() => onMove(-1)}
      >
        <ArrowUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={ICON_BUTTON}
        aria-label={`Move ${label} down`}
        disabled={disabled || isLast}
        onClick={() => onMove(1)}
      >
        <ArrowDown className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Link to the onboarding switches in System → Configuration. */
export function ConfigLink({ children }: { children?: React.ReactNode }) {
  return (
    <Link
      href={ONBOARDING_CONFIG_HREF}
      className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-400"
    >
      <Settings2 className="h-4 w-4" aria-hidden="true" />
      {children ?? 'Turn onboarding steps on or off: System → Configuration'}
    </Link>
  );
}

/** Error card for a failed load; a 404 reads as "not deployed yet", not a crash. */
export function LoadErrorState({
  error,
  what,
  onRetry,
}: {
  error: unknown;
  what: string;
  onRetry: () => void;
}) {
  const { message, notDeployed } = describeApiError(error, `Failed to load ${what}.`);
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <p className="text-sm font-medium text-foreground">
        {notDeployed ? `${what.charAt(0).toUpperCase()}${what.slice(1)} are not available yet` : `Couldn't load ${what}`}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {notDeployed
          ? 'The server this dashboard talks to does not have this feature yet. It will work once the backend is deployed.'
          : message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
      >
        Try again
      </button>
    </div>
  );
}

/**
 * New order after moving the item at `index` by `direction`, as
 * `[id, sort_order]` pairs for only the items whose order changed. Orders are
 * renumbered 10, 20, 30… so later inserts have room.
 */
export function reorderUpdates<T>(
  items: T[],
  index: number,
  direction: -1 | 1,
  getId: (item: T) => string,
  getOrder: (item: T) => number,
): Array<[string, number]> {
  const target = index + direction;
  if (target < 0 || target >= items.length) return [];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next
    .map((item, i) => [getId(item), (i + 1) * 10, getOrder(item)] as const)
    .filter(([, order, previous]) => order !== previous)
    .map(([id, order]) => [id, order]);
}

/**
 * Font stack for Yorùbá text: Noto Sans (loaded in the root layout) first,
 * since it positions combining tone marks and under-dots correctly.
 */
export const YORUBA_FONT_STYLE: React.CSSProperties = {
  fontFamily: '"Noto Sans", "Geist", "Segoe UI", "Helvetica Neue", Arial, system-ui, sans-serif',
  fontFeatureSettings: '"ccmp", "mark", "mkmk"',
};
