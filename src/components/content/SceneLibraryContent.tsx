'use client';

import React, { useEffect, useMemo, useState } from 'react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { Modal } from '@/components/ui/modal';
import { ConfirmationModal } from '@/components/ui/modal/ConfirmationModal';
import { SceneNode, orderSceneNodes } from '@/components/content/ConversationSceneScript';
import { useToast } from '@/contexts/ToastContext';
import { useAdminSceneLibrary, useAdminSceneLibraryScene } from '@/hooks/useApi';
import { attachSceneToLesson, rollbackScene, saveScene, setSceneReviewed } from '@/lib/sceneLibraryApi';
import type { ConversationScenario } from '@/types/conversation-scenes';
import type { SceneChangeResponse, SceneDetail, SceneSummary } from '@/types/scene-library';

type PendingAction =
  | { kind: 'save'; scene: SceneDetail; payload: Record<string, unknown> }
  | { kind: 'review'; scene: SceneDetail; reviewed: boolean }
  | { kind: 'rollback'; scene: SceneDetail; version: number }
  | { kind: 'attach'; scene: SceneDetail; blueprintKey: string };

const KIND_LABELS: Record<string, string> = { conversation: 'Conversation', picture_scene: 'Picture scene' };

function formatDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

/** The server's message and, for an unplayable scene, its list of problems. */
function apiError(err: unknown, fallback: string): { message: string; problems: string[] } {
  const e = err as {
    response?: { data?: { detail?: { message?: string; problems?: string[] } | string } };
    message?: string;
  };
  const detail = e?.response?.data?.detail;
  if (detail && typeof detail === 'object') {
    return { message: detail.message ?? fallback, problems: detail.problems ?? [] };
  }
  if (typeof detail === 'string') return { message: detail, problems: [] };
  return { message: e?.message ?? fallback, problems: [] };
}

function ReviewBadge({ reviewed, reviewedVersion }: { reviewed: boolean; reviewedVersion?: number | null }) {
  if (reviewed) {
    return (
      <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        Reviewed
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
      Needs review{reviewedVersion ? ` (v${reviewedVersion} reviewed)` : ''}
    </span>
  );
}

function ScenePreview({ payload }: { payload: Record<string, unknown> }) {
  const nodes = useMemo(() => {
    try {
      return orderSceneNodes(payload as unknown as ConversationScenario);
    } catch {
      return [];
    }
  }, [payload]);
  if (!nodes.length) return <p className="text-sm text-muted-foreground">Nothing to preview.</p>;
  return (
    <div className="space-y-3" data-testid="scene-preview">
      {nodes.map((node) => (
        <SceneNode key={node.id} node={node} />
      ))}
    </div>
  );
}

function SceneEditor({
  sceneId,
  onClose,
  onChanged,
}: {
  sceneId: string;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const scene = useAdminSceneLibraryScene(sceneId);
  const toast = useToast();
  const [text, setText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [lessonKey, setLessonKey] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  const data = scene.data;
  useEffect(() => {
    if (data) setText(JSON.stringify(data.payload, null, 2));
  }, [data]);

  const parsed = useMemo(() => {
    try {
      const value = JSON.parse(text);
      return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }, [text]);

  const reviewSave = () => {
    if (!data) return;
    if (!parsed) {
      setParseError('This is not a valid JSON object.');
      return;
    }
    setParseError(null);
    setPending({ kind: 'save', scene: data, payload: parsed });
  };

  const runPending = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      let result: SceneChangeResponse;
      if (pending.kind === 'save') result = await saveScene(pending.scene.id, pending.scene.kind, pending.payload);
      else if (pending.kind === 'review') result = await setSceneReviewed(pending.scene.id, pending.reviewed);
      else if (pending.kind === 'rollback') result = await rollbackScene(pending.scene.id, pending.version);
      else result = await attachSceneToLesson(pending.scene.id, pending.blueprintKey);
      setProblems([]);
      const lessons = result.lessons.length ? ` - ${result.lessons.length} lesson(s) updated` : '';
      toast.success(
        result.changed
          ? `${pending.scene.id} saved${result.version ? ` as version ${result.version}` : ''}${lessons}`
          : `${pending.scene.id} was already like that`,
      );
      if (pending.kind === 'attach') setLessonKey('');
      setPending(null);
      await Promise.all([scene.refresh(), onChanged()]);
    } catch (err) {
      const { message, problems: found } = apiError(err, 'Scene update failed');
      setProblems(found);
      toast.error(message);
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmCopy = (() => {
    if (!pending) return { title: '', message: '', confirmText: 'Confirm' };
    const used = pending.scene.lessons.length;
    if (pending.kind === 'save')
      return {
        title: 'Save scene',
        message: `Save "${pending.scene.id}" as version ${pending.scene.version + 1}? It becomes unreviewed, and the ${used} lesson(s) using it update now (production keeps showing the last reviewed version until this one is reviewed).`,
        confirmText: 'Save',
      };
    if (pending.kind === 'review')
      return pending.reviewed
        ? {
            title: 'Mark reviewed',
            message: `Mark version ${pending.scene.version} of "${pending.scene.id}" as reviewed? Production starts showing it in ${used} lesson(s).`,
            confirmText: 'Mark reviewed',
          }
        : {
            title: 'Mark as needing review',
            message: `Mark "${pending.scene.id}" as needing review? Production goes back to its last reviewed version, if any.`,
            confirmText: 'Mark unreviewed',
          };
    if (pending.kind === 'rollback')
      return {
        title: 'Roll back',
        message: `Save version ${pending.version} of "${pending.scene.id}" again, as a new version? The ${used} lesson(s) using it update now.`,
        confirmText: 'Roll back',
      };
    return {
      title: 'Add to lesson',
      message: `Add "${pending.scene.id}" to lesson ${pending.blueprintKey}, just before its final step?`,
      confirmText: 'Add',
    };
  })();

  return (
    <Modal isOpen onClose={onClose} title={data ? `Scene: ${data.id}` : 'Scene'} maxWidth="4xl">
      {scene.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {scene.isError && <p className="text-sm text-muted-foreground">Failed to load this scene.</p>}
      {data && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{KIND_LABELS[data.kind] ?? data.kind}</span>
            <span className="text-muted-foreground">Version {data.version}</span>
            <ReviewBadge reviewed={data.reviewed} />
            <span className="text-muted-foreground">Updated {formatDate(data.updated_at)}</span>
            <button
              type="button"
              className="ml-auto rounded-md border border-input px-3 py-1 text-xs font-medium hover:bg-accent"
              onClick={() => setPending({ kind: 'review', scene: data, reviewed: !data.reviewed })}
            >
              {data.reviewed ? 'Mark as needing review' : 'Mark reviewed'}
            </button>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="scene-json" className="text-sm font-medium text-foreground">
                Scene (JSON)
              </label>
              {data.kind === 'conversation' && (
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setPreview((p) => !p)}
                >
                  {preview ? 'Hide preview' : 'Preview script'}
                </button>
              )}
            </div>
            <textarea
              id="scene-json"
              aria-label="Scene JSON"
              spellCheck={false}
              className="h-80 w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {parseError && (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {parseError}
              </p>
            )}
            {problems.length > 0 && (
              <div role="alert" className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">The scene can&apos;t be played as it is:</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-destructive">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={reviewSave}
              >
                Save new version
              </button>
            </div>
          </div>

          {preview && parsed && <ScenePreview payload={parsed} />}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Used in lessons</h3>
              {data.lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not in any lesson yet.</p>
              ) : (
                <ul className="space-y-1 font-mono text-xs">
                  {data.lessons.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <input
                  aria-label="Lesson key"
                  placeholder="lesson blueprint key"
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  value={lessonKey}
                  onChange={(e) => setLessonKey(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-md border border-input px-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
                  disabled={!lessonKey.trim()}
                  onClick={() => setPending({ kind: 'attach', scene: data, blueprintKey: lessonKey.trim() })}
                >
                  Add to lesson
                </button>
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Versions</h3>
              <ul className="space-y-1">
                {data.versions.map((v) => (
                  <li key={v.version} className="flex items-center gap-2 text-sm" data-testid={`scene-version-${v.version}`}>
                    <span className="tabular-nums">v{v.version}</span>
                    <ReviewBadge reviewed={v.reviewed} />
                    <span className="text-xs text-muted-foreground">{formatDate(v.created_at)}</span>
                    {v.version !== data.version && (
                      <button
                        type="button"
                        className="ml-auto text-xs font-medium text-primary hover:underline"
                        aria-label={`Roll back to version ${v.version}`}
                        onClick={() => setPending({ kind: 'rollback', scene: data, version: v.version })}
                      >
                        Roll back
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      <ConfirmationModal
        isOpen={Boolean(pending)}
        onClose={() => !busy && setPending(null)}
        onConfirm={() => void runPending()}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmText={confirmCopy.confirmText}
        variant="warning"
        isLoading={busy}
      />
    </Modal>
  );
}

export function SceneLibraryContent({ showHeader = true }: { showHeader?: boolean }) {
  const library = useAdminSceneLibrary();
  const [editing, setEditing] = useState<string | null>(null);
  const items: SceneSummary[] = library.data?.items ?? [];

  return (
    <>
      {showHeader && <PageBreadCrumb pageTitle="Scene Library" />}
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Conversation and picture scenes, each edited once: saving a scene updates every lesson that uses it right
          away. Production only shows reviewed versions; mark a version reviewed once a Yorùbá reviewer has signed it off.
        </p>
        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border" role="table">
              <thead className="border-b">
                <tr>
                  {['Scene', 'Kind', 'Version', 'Review', 'Lessons', 'Problems', 'Updated', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {library.isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={8}>
                      Loading…
                    </td>
                  </tr>
                )}
                {library.isError && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={8}>
                      Failed to load the scene library.
                    </td>
                  </tr>
                )}
                {library.data && items.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={8}>
                      No scenes yet. Run scripts/import_scene_library.py to bring in the scenes lessons already carry.
                    </td>
                  </tr>
                )}
                {items.map((s) => (
                  <tr key={s.id} data-testid={`scene-row-${s.id}`}>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-foreground">{s.title || s.id}</div>
                      <div className="font-mono text-xs text-muted-foreground">{s.id}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{KIND_LABELS[s.kind] ?? s.kind}</td>
                    <td className="px-4 py-3 text-sm tabular-nums">{s.version}</td>
                    <td className="px-4 py-3 text-sm">
                      <ReviewBadge reviewed={s.reviewed} reviewedVersion={s.reviewed_version} />
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums" title={s.lessons.join('\n')}>
                      {s.lessons.length}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {s.problems.length ? (
                        <span className="text-destructive" title={s.problems.join('\n')}>
                          {s.problems.length}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDate(s.updated_at)}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        type="button"
                        className="rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-accent"
                        aria-label={`Edit ${s.id}`}
                        onClick={() => setEditing(s.id)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {editing && (
        <SceneEditor sceneId={editing} onClose={() => setEditing(null)} onChanged={() => library.refresh()} />
      )}
    </>
  );
}
