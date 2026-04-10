'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';

import MediaLinkPreview from '@/components/admin/curriculum/MediaLinkPreview';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/contexts/ToastContext';
import {
  cleanupOrphanedBlueprintAssets,
  deleteBlueprintAsset,
  renameBlueprintAsset,
} from '@/lib/adminCurriculumApi';
import { useAdminBlueprintAssetLibrary, useAdminCoursesList } from '@/hooks/useApi';

function formatDate(value?: string | null): string {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function CurriculumAssetLibraryPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const [assetKind, setAssetKind] = useState('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isCleaningOrphans, setIsCleaningOrphans] = useState(false);
  const [renameDraft, setRenameDraft] = useState<{
    blueprintId: string;
    fieldPath: string;
    currentName: string;
    nextName: string;
  } | null>(null);
  const limit = 25;

  const { data: courseList } = useAdminCoursesList({ limit: 200 });
  const {
    items,
    total,
    isLoading,
    isError,
    refresh,
  } = useAdminBlueprintAssetLibrary({
    page,
    limit,
    course_id: courseId || undefined,
    asset_kind: assetKind || undefined,
    search: search || undefined,
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = total === 0 ? 0 : Math.min(page * limit, total);
  const courses = courseList?.items ?? [];

  const openRenameModal = (blueprintId: string, fieldPath: string, currentName?: string | null) => {
    const safeCurrentName = (currentName || fieldPath).trim();
    setRenameDraft({
      blueprintId,
      fieldPath,
      currentName: safeCurrentName,
      nextName: safeCurrentName,
    });
  };

  const handleRenameSubmit = async () => {
    if (!renameDraft) return;
    const nextName = renameDraft.nextName.trim();
    if (!nextName) {
      toast.error('File name cannot be empty.');
      return;
    }
    if (nextName === renameDraft.currentName) {
      setRenameDraft(null);
      return;
    }

    const key = `${renameDraft.blueprintId}:${renameDraft.fieldPath}:rename`;
    setPendingKey(key);
    try {
      await renameBlueprintAsset(renameDraft.blueprintId, {
        field_path: renameDraft.fieldPath,
        file_name: nextName,
      });
      await refresh();
      toast.success('Asset metadata renamed.');
      setRenameDraft(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || error?.message || 'Failed to rename asset.');
    } finally {
      setPendingKey(null);
    }
  };

  const handleDelete = async (blueprintId: string, fieldPath: string) => {
    if (!window.confirm(`Delete the asset binding for ${fieldPath}? This will remove the URL from the blueprint payload and move the blueprint back to draft.`)) {
      return;
    }

    const key = `${blueprintId}:${fieldPath}:delete`;
    setPendingKey(key);
    try {
      await deleteBlueprintAsset(blueprintId, fieldPath);
      await refresh();
      toast.success('Asset binding deleted.');
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || error?.message || 'Failed to delete asset binding.');
    } finally {
      setPendingKey(null);
    }
  };

  const handleCleanupOrphans = async () => {
    setIsCleaningOrphans(true);
    try {
      const result = await cleanupOrphanedBlueprintAssets(courseId || undefined);
      await refresh();
      toast.success(
        `Cleanup finished. Removed ${result.removed_binding_count} stale binding${result.removed_binding_count === 1 ? '' : 's'} across ${result.updated_blueprint_count} blueprint${result.updated_blueprint_count === 1 ? '' : 's'}.`
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || error?.message || 'Failed to clean stale asset bindings.');
    } finally {
      setIsCleaningOrphans(false);
    }
  };

  const summary = useMemo(() => {
    const counts = { image: 0, audio: 0, video: 0 };
    for (const item of items) {
      const kind = item.binding.asset_kind || 'image';
      if (kind === 'audio' || kind === 'video') {
        counts[kind] += 1;
      } else {
        counts.image += 1;
      }
    }
    return counts;
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageBreadCrumb pageTitle="Curriculum Asset Library" />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCleanupOrphans()}
            disabled={isCleaningOrphans}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {isCleaningOrphans ? 'Cleaning…' : 'Clean Stale Bindings'}
          </button>
          <Link
            href="/curriculum/lesson-blueprints"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            View Blueprints
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Blueprint key, file name, field path"
              className="block h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Course</label>
            <select
              value={courseId}
              onChange={(event) => {
                setCourseId(event.target.value);
                setPage(1);
              }}
              className="block h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Asset type</label>
            <select
              value={assetKind}
              onChange={(event) => {
                setAssetKind(event.target.value);
                setPage(1);
              }}
              className="block h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="">All assets</option>
              <option value="image">Images</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>{total} asset{total === 1 ? '' : 's'} found</span>
          <span>{summary.image} images</span>
          <span>{summary.audio} audio</span>
          <span>{summary.video} video</span>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          Loading assets…
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-16 text-center text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          Failed to load curriculum assets.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          No uploaded lesson assets match the current filters.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {items.map((item) => {
            const assetKindLabel = item.binding.asset_kind || 'image';
            return (
              <article
                key={`${item.blueprint_id}:${item.field_path}:${item.binding.storage_key}`}
                className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <MediaLinkPreview
                  kind={assetKindLabel}
                  url={item.binding.asset_url}
                  label={item.binding.file_name || item.field_path}
                  compact
                />

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {item.binding.file_name || item.field_path}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {assetKindLabel}
                      </div>
                    </div>
                  </div>

                  <dl className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                    <div>
                      <dt className="font-medium text-gray-700 dark:text-gray-300">Course</dt>
                      <dd className="mt-1">{item.course_key || 'Unknown course'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-700 dark:text-gray-300">Blueprint</dt>
                      <dd className="mt-1">{item.blueprint_key}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-700 dark:text-gray-300">Section</dt>
                      <dd className="mt-1">
                        {item.unit_key || 'Unit?'} / {item.section_key || 'Section?'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-700 dark:text-gray-300">Field path</dt>
                      <dd className="mt-1 break-all">{item.field_path}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-700 dark:text-gray-300">Uploaded</dt>
                      <dd className="mt-1">{formatDate(item.binding.uploaded_at)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/curriculum/lesson-blueprints/${item.blueprint_id}`}
                    className="rounded-lg border border-brand-300 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/20"
                  >
                    Open Blueprint
                  </Link>
                  <button
                    type="button"
                    onClick={() => openRenameModal(item.blueprint_id, item.field_path, item.binding.file_name)}
                    disabled={pendingKey === `${item.blueprint_id}:${item.field_path}:rename`}
                    className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.blueprint_id, item.field_path)}
                    disabled={pendingKey === `${item.blueprint_id}:${item.field_path}:delete`}
                    className="rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                  >
                    Delete
                  </button>
                  <a
                    href={item.binding.asset_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Open Asset
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {pageStart} to {pageEnd} of {total} media assets
          </p>
          <div className="ml-auto">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>

      <Modal
        isOpen={Boolean(renameDraft)}
        onClose={() => setRenameDraft(null)}
        title="Rename Asset"
        maxWidth="md"
      >
        {renameDraft ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
              <div><span className="font-medium">Field:</span> {renameDraft.fieldPath}</div>
              <div className="mt-1"><span className="font-medium">Current name:</span> {renameDraft.currentName}</div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">New file name</label>
              <input
                type="text"
                value={renameDraft.nextName}
                onChange={(event) => setRenameDraft({ ...renameDraft, nextName: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleRenameSubmit();
                  }
                }}
                className="block h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameDraft(null)}
                disabled={pendingKey === `${renameDraft.blueprintId}:${renameDraft.fieldPath}:rename`}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRenameSubmit()}
                disabled={pendingKey === `${renameDraft.blueprintId}:${renameDraft.fieldPath}:rename`}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {pendingKey === `${renameDraft.blueprintId}:${renameDraft.fieldPath}:rename` ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
