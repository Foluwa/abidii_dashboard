'use client';

import React, { useState } from 'react';
import Link from 'next/link';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useAdminConversationScenes } from '@/hooks/useApi';
import { useDebounce } from '@/hooks/useDebounce';

const REVIEWED_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Needs review', value: 'false' },
  { label: 'Reviewed', value: 'true' },
];

const PROBLEM_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Has problems', value: 'true' },
  { label: 'No problems', value: 'false' },
];

function boolOrUndefined(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export function sceneDetailHref(blueprintKey: string, sceneId: string) {
  return `/content/conversation-scenes/${encodeURIComponent(blueprintKey)}/${encodeURIComponent(sceneId)}`;
}

export function ConversationScenesContent({ showHeader = true }: { showHeader?: boolean }) {
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [reviewed, setReviewed] = useState('');
  const [problems, setProblems] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError } = useAdminConversationScenes({
    page,
    limit,
    reviewed: boolOrUndefined(reviewed),
    hasProblems: boolOrUndefined(problems),
    q: debouncedSearch.trim() || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages || Math.max(1, Math.ceil(total / limit));
  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = total === 0 ? 0 : Math.min(page * limit, total);

  return (
    <>
      {showHeader && <PageBreadCrumb pageTitle="Conversation Scenes" />}

      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Read-only view of the conversation scenes inside lesson blueprints. Open a scene to read it as a script next
          to its audio.
        </p>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground" htmlFor="scene-search">
                Search
              </label>
              <input
                id="scene-search"
                type="search"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Lesson key, scene id or title"
                className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Review status</label>
              <div className="mt-1">
                <StyledSelect
                  options={REVIEWED_OPTIONS}
                  value={reviewed}
                  onValueChange={(value) => {
                    setPage(1);
                    setReviewed(value);
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Validation</label>
              <div className="mt-1">
                <StyledSelect
                  options={PROBLEM_OPTIONS}
                  value={problems}
                  onValueChange={(value) => {
                    setPage(1);
                    setProblems(value);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border" role="table">
              <thead className="border-b">
                <tr>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Scene</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Lesson</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Version</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Lines / replies</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Audio</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Review</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Problems</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={8}>
                      Loading…
                    </td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={8}>
                      Failed to load conversation scenes.
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && items.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={8}>
                      No conversation scenes found.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !isError &&
                  items.map((row) => (
                    <tr key={`${row.blueprint_key}:${row.step_index}`}>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="font-medium">{row.title || '—'}</div>
                        <div className="mt-0.5 font-mono text-xs text-muted-foreground">{row.scene_id || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div>{row.lesson_title || '—'}</div>
                        <div className="mt-0.5 font-mono text-xs text-muted-foreground">{row.blueprint_key}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.version ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {row.line_count} / {row.reply_count}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {row.audio_count}
                        {row.missing_audio_count > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">({row.missing_audio_count} missing)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.reviewed ? (
                          <StatusBadge status="success" label="Reviewed" />
                        ) : (
                          <StatusBadge status="pending" label="Needs review" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.problems.length > 0 ? (
                          <span title={row.problems.join('\n')}>
                            <StatusBadge status="error" label={String(row.problems.length)} />
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {row.scene_id ? (
                          <Link
                            href={sceneDetailHref(row.blueprint_key, row.scene_id)}
                            className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50"
                          >
                            Open
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">No id</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Showing {pageStart} to {pageEnd} of {total} scenes
          </p>
          <div className="ml-auto">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
          </div>
        </div>
      </div>
    </>
  );
}
