'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import StatusBadge from '@/components/admin/StatusBadge';
import { useAdminConversationScene } from '@/hooks/useApi';
import type {
  ConversationChoiceNode,
  ConversationNode,
  ConversationReplyOption,
  ConversationScenario,
} from '@/types/conversation-scenes';

/** Nodes in reading order: walk from the start node, then anything unreachable. */
export function orderSceneNodes(scenario: ConversationScenario): ConversationNode[] {
  const nodes = (scenario.nodes ?? []).filter((n): n is ConversationNode => !!n && typeof n.id === 'string');
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const ordered: ConversationNode[] = [];
  const queue: string[] = scenario.startNodeId ? [scenario.startNodeId] : [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const node = byId.get(id);
    if (!node || seen.has(id)) continue;
    seen.add(id);
    ordered.push(node);
    if (node.type === 'line' && node.next) queue.push(node.next);
    if (node.type === 'choice') {
      for (const option of node.options ?? []) if (option?.next) queue.push(option.next);
    }
  }
  for (const node of nodes) if (!seen.has(node.id)) ordered.push(node);
  return ordered;
}

function verdictBadge(verdict?: string | null) {
  if (verdict === 'correct') return <StatusBadge status="success" label="Correct" />;
  if (verdict === 'acceptable') return <StatusBadge status="info" label="Acceptable" />;
  if (verdict === 'wrong') return <StatusBadge status="error" label="Wrong" />;
  return <StatusBadge status="warning" label={verdict ? String(verdict) : 'No verdict'} />;
}

function AudioCell({ url }: { url?: string | null }) {
  if (!url) return <p className="text-xs font-medium text-error-500">No audio</p>;
  return (
    <div className="space-y-1">
      <audio controls preload="none" src={url} className="h-9 w-full max-w-xs">
        <a href={url}>Download audio</a>
      </audio>
      <p className="break-all font-mono text-[11px] text-muted-foreground">{url.split('/').pop()}</p>
    </div>
  );
}

function NodeId({ id, next }: { id: string; next?: string | null }) {
  return (
    <span className="font-mono text-[11px] text-muted-foreground">
      #{id}
      {next ? ` → ${next}` : ''}
    </span>
  );
}

function ReplyRow({ option }: { option: ConversationReplyOption }) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 md:grid-cols-[1fr_auto]">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {verdictBadge(option.verdict)}
          <NodeId id={option.id} next={option.next} />
        </div>
        <p lang="yo" className="text-base font-medium text-foreground">
          {option.yorubaText || '—'}
        </p>
        <p className="text-sm text-muted-foreground">{option.englishText || '—'}</p>
        {option.correction && (
          <p className="rounded-md bg-muted/50 px-2 py-1 text-sm text-foreground">
            <span className="font-medium">Correction:</span> {option.correction}
          </p>
        )}
      </div>
      <AudioCell url={option.audioUrl} />
    </div>
  );
}

function ChoiceBlock({ node }: { node: ConversationChoiceNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">Learner replies</span>
        <NodeId id={node.id} />
      </div>
      {node.prompt && <p className="text-sm italic text-muted-foreground">{node.prompt}</p>}
      <div className="space-y-2">
        {(node.options ?? []).map((option) => (
          <ReplyRow key={option.id} option={option} />
        ))}
      </div>
    </div>
  );
}

function SceneNode({ node }: { node: ConversationNode }) {
  if (node.type === 'line') {
    return (
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{node.speaker || 'Speaker'}</span>
            <NodeId id={node.id} next={node.next} />
          </div>
          <p lang="yo" className="text-base font-medium text-foreground">
            {node.yorubaText || '—'}
          </p>
          <p className="text-sm text-muted-foreground">{node.englishText || '—'}</p>
        </div>
        <AudioCell url={node.audioUrl} />
      </div>
    );
  }
  if (node.type === 'choice') return <ChoiceBlock node={node} />;
  if (node.type === 'end') {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">End</span>
          <NodeId id={node.id} />
        </div>
        {node.message && <p className="mt-1 text-sm text-foreground">{node.message}</p>}
      </div>
    );
  }
  const unknown = node as { id: string; type?: unknown };
  return (
    <div className="rounded-xl border border-error-500 p-4 text-sm text-foreground">
      Unknown node type {String(unknown.type)} <NodeId id={unknown.id} />
    </div>
  );
}

export function ConversationSceneScript({ blueprintKey, sceneId }: { blueprintKey: string; sceneId: string }) {
  const { data, isLoading, isError } = useAdminConversationScene(blueprintKey, sceneId);
  const scenario = data?.scenario;
  const ordered = useMemo(() => (scenario ? orderSceneNodes(scenario) : []), [scenario]);
  const notes = (scenario?.reviewNotes ?? []).filter((n) => typeof n === 'string' && n.trim());

  return (
    <>
      <PageBreadCrumb pageTitle={data?.title || 'Conversation Scene'} />

      <div className="space-y-6">
        <Link href="/content/conversation-scenes" className="text-sm text-muted-foreground hover:text-foreground">
          ← All conversation scenes
        </Link>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {isError && <p className="text-sm text-muted-foreground">Failed to load this scene.</p>}

        {data && scenario && (
          <>
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-5 lg:grid-cols-[1fr_280px]">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-foreground">{scenario.title || data.scene_id}</h2>
                  {data.reviewed ? (
                    <StatusBadge status="success" label="Reviewed" />
                  ) : (
                    <StatusBadge status="pending" label="Needs review" />
                  )}
                </div>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="inline text-muted-foreground">Scene: </dt>
                    <dd className="inline font-mono">{data.scene_id}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Version: </dt>
                    <dd className="inline">{data.version ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Lesson: </dt>
                    <dd className="inline">
                      {data.lesson_title || '—'} <span className="font-mono text-xs">({data.blueprint_key})</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Lesson status: </dt>
                    <dd className="inline">
                      {data.lesson_status || '—'}
                      {data.lesson_enabled ? '' : ' (disabled)'}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Lines / replies: </dt>
                    <dd className="inline">
                      {data.line_count} / {data.reply_count}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Audio: </dt>
                    <dd className="inline">
                      {data.audio_count}
                      {data.missing_audio_count > 0 ? ` (${data.missing_audio_count} missing)` : ''}
                    </dd>
                  </div>
                </dl>
                {scenario.context && <p className="text-sm text-foreground">{scenario.context}</p>}
              </div>
              {scenario.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={scenario.imageUrl}
                  alt={scenario.title || 'Scene image'}
                  className="w-full rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-6 text-xs text-muted-foreground">
                  No scene image
                </div>
              )}
            </div>

            {data.problems.length > 0 && (
              <div className="rounded-xl border border-error-500 bg-card p-4">
                <p className="text-sm font-semibold text-foreground">Validation problems ({data.problems.length})</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {data.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Review notes</p>
              {notes.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">No review notes.</p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Script</h3>
              {ordered.length === 0 && <p className="text-sm text-muted-foreground">This scene has no nodes.</p>}
              {ordered.map((node) => (
                <SceneNode key={node.id} node={node} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
