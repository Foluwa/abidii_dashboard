'use client';

import React, { useState } from 'react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { Modal } from '@/components/ui/modal';
import { ConfirmationModal } from '@/components/ui/modal/ConfirmationModal';
import { useToast } from '@/contexts/ToastContext';
import { useAdminWardrobeCatalog } from '@/hooks/useApi';
import { retireWardrobeItem, setWardrobeItemAvailability, unretireWardrobeItem } from '@/lib/wardrobeApi';
import type { WardrobeCatalogItem, WardrobeItemChangeResponse, WardrobeItemState } from '@/types/wardrobe';

const STATE_LABELS: Record<WardrobeItemState, string> = {
  on_sale: 'On sale',
  scheduled: 'Scheduled',
  expired: 'Window ended',
  inactive: 'Inactive',
  retired: 'Retired',
};

const STATE_CLASSES: Record<WardrobeItemState, string> = {
  on_sale: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  scheduled: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  expired: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  inactive: 'bg-muted text-muted-foreground',
  retired: 'bg-destructive/10 text-destructive',
};

type PendingAction =
  | { kind: 'retire'; item: WardrobeCatalogItem }
  | { kind: 'unretire'; item: WardrobeCatalogItem }
  | { kind: 'window'; item: WardrobeCatalogItem; from: string | null; until: string | null };

function formatDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

/** ISO timestamp -> value for <input type="datetime-local"> (local time). */
function toLocalInput(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (local time) -> ISO timestamp, or null when empty. */
function fromLocalInput(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function windowLabel(from: string | null, until: string | null) {
  if (!from && !until) return 'Always';
  return `${formatDate(from) ?? 'any time'} → ${formatDate(until) ?? 'no end'}`;
}

function errorMessage(err: unknown, fallback: string) {
  const e = err as { response?: { data?: { error?: { message?: string }; detail?: unknown } }; message?: string };
  const data = e?.response?.data;
  if (data?.error?.message) return data.error.message;
  if (typeof data?.detail === 'string') return data.detail;
  return e?.message ?? fallback;
}

export function WardrobeCatalogueContent({ showHeader = true }: { showHeader?: boolean }) {
  const catalog = useAdminWardrobeCatalog();
  const toast = useToast();

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [windowItem, setWindowItem] = useState<WardrobeCatalogItem | null>(null);
  const [fromInput, setFromInput] = useState('');
  const [untilInput, setUntilInput] = useState('');
  const [windowError, setWindowError] = useState<string | null>(null);

  const items = catalog.data?.items ?? [];

  const openWindowEditor = (item: WardrobeCatalogItem) => {
    setWindowItem(item);
    setFromInput(toLocalInput(item.available_from));
    setUntilInput(toLocalInput(item.available_until));
    setWindowError(null);
  };

  const reviewWindow = () => {
    if (!windowItem) return;
    const from = fromLocalInput(fromInput);
    const until = fromLocalInput(untilInput);
    if (from && until && new Date(from) >= new Date(until)) {
      setWindowError('"Available from" must be before "Available until".');
      return;
    }
    setWindowError(null);
    setPending({ kind: 'window', item: windowItem, from, until });
  };

  const runPending = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      let result: WardrobeItemChangeResponse;
      if (pending.kind === 'retire') result = await retireWardrobeItem(pending.item.id);
      else if (pending.kind === 'unretire') result = await unretireWardrobeItem(pending.item.id);
      else
        result = await setWardrobeItemAvailability(pending.item.id, {
          available_from: pending.from,
          available_until: pending.until,
        });
      toast.success(
        result.changed
          ? `${pending.item.id} updated - catalogue version ${result.catalog_version}`
          : `${pending.item.id} was already in that state`,
      );
      if (pending.kind === 'window') setWindowItem(null);
      setPending(null);
      await catalog.refresh();
    } catch (err) {
      toast.error(errorMessage(err, 'Catalogue update failed'));
    } finally {
      setBusy(false);
    }
  };

  const confirmCopy = (() => {
    if (!pending) return { title: '', message: '', confirmText: 'Confirm' };
    if (pending.kind === 'retire')
      return {
        title: 'Retire item',
        message: `Retire "${pending.item.id}"? It leaves the shop for good. The ${pending.item.owners_count} learner(s) who own it keep it and can still equip it. The catalogue version is bumped.`,
        confirmText: 'Retire',
      };
    if (pending.kind === 'unretire')
      return {
        title: 'Unretire item',
        message: `Bring "${pending.item.id}" back? It returns to the shop if it is active and inside its sale window. The catalogue version is bumped.`,
        confirmText: 'Unretire',
      };
    return {
      title: 'Set sale window',
      message: `Set the sale window of "${pending.item.id}" to ${windowLabel(pending.from, pending.until)}? Owners are unaffected. The catalogue version is bumped.`,
      confirmText: 'Save window',
    };
  })();

  return (
    <>
      {showHeader && <PageBreadCrumb pageTitle="Wardrobe Catalogue" />}

      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Mascot wardrobe items. Retiring or changing a sale window only affects the shop - learners who own an item
          always keep it. Every change bumps the catalogue version so apps refresh their cached catalogue.
        </p>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">Items</h2>
            {catalog.data && (
              <span className="text-sm text-muted-foreground" data-testid="catalog-version">
                Catalogue version {catalog.data.catalog_version} · {catalog.data.total} items
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border" role="table">
              <thead className="border-b">
                <tr>
                  {['Item', 'Slot', 'Price', 'State', 'Sale window', 'Owners', 'Version', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-2.5 text-left text-sm font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {catalog.isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={8}>
                      Loading…
                    </td>
                  </tr>
                )}
                {catalog.isError && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={8}>
                      Failed to load the wardrobe catalogue.
                    </td>
                  </tr>
                )}
                {catalog.data && items.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={8}>
                      No wardrobe items.
                    </td>
                  </tr>
                )}
                {items.map((item) => (
                  <tr key={item.id} data-testid={`wardrobe-row-${item.id}`}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-foreground">{item.id}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{item.slot}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-foreground">{item.price}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATE_CLASSES[item.state]}`}
                        title={item.retired_at ? `Retired ${formatDate(item.retired_at)}` : undefined}
                      >
                        {STATE_LABELS[item.state]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {windowLabel(item.available_from, item.available_until)}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-foreground">
                      {item.owners_count}
                      {item.equipped_count > 0 && (
                        <span className="text-muted-foreground"> ({item.equipped_count} equipped)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">{item.catalog_version}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        {item.retired_at ? (
                          <button
                            type="button"
                            className="rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-accent"
                            aria-label={`Unretire ${item.id}`}
                            onClick={() => setPending({ kind: 'unretire', item })}
                          >
                            Unretire
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                            aria-label={`Retire ${item.id}`}
                            onClick={() => setPending({ kind: 'retire', item })}
                          >
                            Retire
                          </button>
                        )}
                        <button
                          type="button"
                          className="rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-accent"
                          aria-label={`Set window for ${item.id}`}
                          onClick={() => openWindowEditor(item)}
                        >
                          Set window
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        isOpen={Boolean(windowItem) && pending?.kind !== 'window'}
        onClose={() => setWindowItem(null)}
        title={windowItem ? `Sale window: ${windowItem.id}` : 'Sale window'}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Leave a field empty for no limit. &quot;Available until&quot; is exclusive. Times are in your local timezone.
          </p>
          <label className="block text-sm font-medium text-foreground">
            Available from
            <input
              type="datetime-local"
              aria-label="Available from"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Available until
            <input
              type="datetime-local"
              aria-label="Available until"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={untilInput}
              onChange={(e) => setUntilInput(e.target.value)}
            />
          </label>
          {windowError && (
            <p role="alert" className="text-sm text-destructive">
              {windowError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
              onClick={() => setWindowItem(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={reviewWindow}
            >
              Review change
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(pending)}
        onClose={() => !busy && setPending(null)}
        onConfirm={() => void runPending()}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmText={confirmCopy.confirmText}
        variant={pending?.kind === 'retire' ? 'danger' : 'warning'}
        isLoading={busy}
      />
    </>
  );
}
