'use client';

import React, { useMemo, useState } from 'react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useAdminMissionClaims, useAdminMissionsSummary } from '@/hooks/useApi';

const SUMMARY_DAYS = 14;

function rate(numerator: number, denominator: number) {
  if (!denominator) return '—';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function DailyMissionsContent({ showHeader = true }: { showHeader?: boolean }) {
  const summary = useAdminMissionsSummary(SUMMARY_DAYS);

  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [missionId, setMissionId] = useState('');
  const [day, setDay] = useState('');
  const claims = useAdminMissionClaims({
    page,
    limit,
    missionId: missionId || undefined,
    day: day || undefined,
  });

  const catalog = useMemo(() => summary.data?.catalog ?? [], [summary.data]);
  const missionOptions = useMemo(
    () => [{ label: 'All missions', value: '' }, ...catalog.map((m) => ({ label: m.id, value: m.id }))],
    [catalog],
  );
  // Columns: every catalog mission plus any retired id seen in the window.
  const missionColumns = useMemo(() => {
    const ids = catalog.map((m) => m.id);
    for (const item of summary.data?.items ?? []) {
      for (const stat of item.missions) if (!ids.includes(stat.mission_id)) ids.push(stat.mission_id);
    }
    return ids;
  }, [catalog, summary.data]);

  const claimItems = claims.data?.items ?? [];
  const total = claims.data?.total ?? 0;
  const totalPages = claims.data?.pages || Math.max(1, Math.ceil(total / limit));
  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = total === 0 ? 0 : Math.min(page * limit, total);

  return (
    <>
      {showHeader && <PageBreadCrumb pageTitle="Daily Missions" />}

      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Read-only. Days are learners&apos; local days. Each cell shows claims / times assigned for that mission.
        </p>

        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">Last {SUMMARY_DAYS} days</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border" role="table">
              <thead className="border-b">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Day</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Learners</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Missions</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Claims</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Claim rate</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Claimers</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Bonus</th>
                  {missionColumns.map((id) => (
                    <th
                      key={id}
                      className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs font-medium text-muted-foreground"
                    >
                      {id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={7 + missionColumns.length}>
                      Loading…
                    </td>
                  </tr>
                )}
                {summary.isError && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={7 + missionColumns.length}>
                      Failed to load the missions summary.
                    </td>
                  </tr>
                )}
                {(summary.data?.items ?? []).map((row) => {
                  const byMission = new Map(row.missions.map((m) => [m.mission_id, m]));
                  return (
                    <tr key={row.day}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">
                        <button
                          type="button"
                          className="hover:underline"
                          title="Show this day's claims"
                          onClick={() => {
                            setPage(1);
                            setDay(row.day);
                          }}
                        >
                          {row.day}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">{row.learners_assigned}</td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">{row.missions_assigned}</td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">{row.claims}</td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">
                        {rate(row.claims, row.missions_assigned)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">{row.distinct_claimers}</td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">{row.bonus}</td>
                      {missionColumns.map((id) => {
                        const stat = byMission.get(id);
                        return (
                          <td key={id} className="px-3 py-3 text-right text-sm tabular-nums text-foreground">
                            {stat ? `${stat.claims} / ${stat.assigned}` : <span className="text-muted-foreground">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Mission</label>
              <div className="mt-1">
                <StyledSelect
                  options={missionOptions}
                  value={missionId}
                  onValueChange={(value) => {
                    setPage(1);
                    setMissionId(value);
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground" htmlFor="mission-day">
                Day
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="mission-day"
                  type="date"
                  value={day}
                  onChange={(e) => {
                    setPage(1);
                    setDay(e.target.value);
                  }}
                  className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {day && (
                  <button
                    type="button"
                    onClick={() => {
                      setPage(1);
                      setDay('');
                    }}
                    className="rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground hover:bg-muted/50"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">Recent claims</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border" role="table">
              <thead className="border-b">
                <tr>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Claimed at</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Learner</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Day</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Mission</th>
                  <th className="px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Progress</th>
                  <th className="px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Bonus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {claims.isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={6}>
                      Loading…
                    </td>
                  </tr>
                )}
                {claims.isError && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={6}>
                      Failed to load mission claims.
                    </td>
                  </tr>
                )}
                {!claims.isLoading && !claims.isError && claimItems.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={6}>
                      No claims found.
                    </td>
                  </tr>
                )}
                {claimItems.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-sm text-foreground">{new Date(row.claimed_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      <div className="font-medium">{row.user_display_name || row.user_email || row.user_id}</div>
                      {row.user_email && row.user_display_name && (
                        <div className="mt-0.5 text-xs text-muted-foreground">{row.user_email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{row.mission_day}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{row.mission_id}</td>
                    <td className="px-4 py-3 text-right text-sm text-foreground">
                      {row.progress} / {row.target}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-foreground">{row.bonus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Showing {pageStart} to {pageEnd} of {total} claims
          </p>
          <div className="ml-auto">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
          </div>
        </div>
      </div>
    </>
  );
}
