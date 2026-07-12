'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useToast } from '@/contexts/ToastContext';
import {
  FaSync,
  FaPlay,
  FaPause,
  FaExclamationTriangle,
} from 'react-icons/fa';

interface AudioJob {
  id: string;
  content_type: string;
  content_id: string;
  text_to_speak: string;
  language_code?: string | null;
  voice_id?: string;
  voice_code?: string | null;
  provider?: string | null;
  status: string;
  audio_format?: string | null;
  audio_url?: string;
  output_duration_sec?: number | null;
  error_message?: string;
  logs?: string | null;
  retry_count: number;
  max_retries: number;
  queued_at: string;
  started_at?: string;
  completed_at?: string;
}

interface AudioJobsResponse {
  items: AudioJob[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

function formatDuration(seconds?: number | null) {
  if (seconds == null) return '—';
  return `${seconds.toFixed(1)}s`;
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusCell({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <StatusBadge status="success" label="Completed" />;
    case 'failed':
      return <StatusBadge status="error" label="Failed" />;
    case 'processing':
      return <StatusBadge status="warning" label="Processing" />;
    case 'queued':
      return <StatusBadge status="info" label="Queued" />;
    case 'cancelled':
      return <StatusBadge status="inactive" label="Cancelled" />;
    default:
      return <StatusBadge status="pending" label={status} />;
  }
}

function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play();
    }
    setPlaying(!playing);
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => setPlaying(false);
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700"
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? <FaPause className="text-xs" /> : <FaPlay className="text-xs" />}
      </button>
      <audio ref={audioRef} src={src} preload="none" className="hidden" />
    </div>
  );
}

function LogsTooltip({ logs }: { logs?: string | null }) {
  const [show, setShow] = useState(false);
  if (!logs) return null;
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        Logs
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-80 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">Generation Logs</div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-400">
            {logs}
          </pre>
          <div className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2 rotate-45 border-b border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" />
        </div>
      )}
    </div>
  );
}

export default function AudioJobsPage() {
  const toast = useToast();
  const [jobs, setJobs] = useState<AudioJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const limit = 25;

  const [filterStatus, setFilterStatus] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [filterContentType, setFilterContentType] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/v1/admin/audio/jobs?page=${page}&page_size=${limit}`;
      if (filterStatus) url += `&status=${encodeURIComponent(filterStatus)}`;
      if (filterProvider) url += `&provider=${encodeURIComponent(filterProvider)}`;
      if (filterContentType) url += `&content_type=${encodeURIComponent(filterContentType)}`;
      if (filterSearch) url += `&q=${encodeURIComponent(filterSearch)}`;

      const response = await apiClient.get<AudioJobsResponse>(url);
      const data = response.data;
      setJobs(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.pages || Math.max(1, Math.ceil((data.total || 0) / limit)));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to load audio jobs');
      setJobs([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [filterContentType, filterProvider, filterStatus, filterSearch, limit, page, toast]);

  useEffect(() => {
    fetchJobs();

    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchJobs, 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchJobs]);

  const retryJob = async (jobId: string) => {
    try {
      await apiClient.post(`/api/v1/admin/audio/jobs/${jobId}/retry`);
      toast.success('Job queued for retry');
      fetchJobs();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to retry job');
    }
  };

  const cancelJob = async (jobId: string) => {
    if (!window.confirm('Are you sure you want to cancel this job?')) return;
    try {
      await apiClient.delete(`/api/v1/admin/audio/jobs/${jobId}`);
      toast.success('Job cancelled successfully');
      fetchJobs();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to cancel job');
    }
  };

  const stats = useMemo(() => {
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const failed = jobs.filter((j) => j.status === 'failed').length;
    const processing = jobs.filter((j) => j.status === 'processing').length;
    const queued = jobs.filter((j) => j.status === 'queued').length;
    const totalDuration = jobs.reduce((sum, j) => sum + (j.output_duration_sec || 0), 0);
    return { completed, failed, processing, queued, totalDuration };
  }, [jobs]);

  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = total === 0 ? 0 : Math.min(page * limit, total);

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Audio Jobs" />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{total}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Completed</div>
          <div className="mt-2 text-2xl font-semibold text-green-600 dark:text-green-400">{stats.completed}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Processing</div>
          <div className="mt-2 text-2xl font-semibold text-blue-600 dark:text-blue-400">{stats.processing}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Failed</div>
          <div className="mt-2 text-2xl font-semibold text-red-600 dark:text-red-400">{stats.failed}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total Duration</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{formatDuration(stats.totalDuration)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Audio Generation Jobs</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Monitor TTS generation jobs and their status</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-2 h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              Auto-refresh (10s)
            </label>
            <button
              type="button"
              onClick={() => void fetchJobs()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <FaSync className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
            <input
              aria-label="Search"
              value={filterSearch}
              onChange={(e) => {
                setFilterSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Text to speak, ID, voice..."
              className="block h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <StyledSelect
              aria-label="Status"
              label="Status"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'queued', label: 'Queued' },
                { value: 'processing', label: 'Processing' },
                { value: 'completed', label: 'Completed' },
                { value: 'failed', label: 'Failed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              fullWidth
            />
          </div>
          <div>
            <StyledSelect
              aria-label="Provider"
              label="Provider"
              value={filterProvider}
              onChange={(e) => {
                setFilterProvider(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All providers' },
                { value: 'google', label: 'Google TTS' },
                { value: 'spitch', label: 'Spitch' },
                { value: 'elevenlabs', label: 'ElevenLabs' },
              ]}
              fullWidth
            />
          </div>
          <div>
            <StyledSelect
              aria-label="Content type"
              label="Content Type"
              value={filterContentType}
              onChange={(e) => {
                setFilterContentType(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All types' },
                { value: 'word', label: 'Words' },
                { value: 'phrase', label: 'Phrases' },
                { value: 'proverb', label: 'Proverbs' },
                { value: 'number', label: 'Numbers' },
                { value: 'letter', label: 'Letters' },
                { value: 'sentence', label: 'Sentences' },
              ]}
              fullWidth
            />
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Text</th>
                <th className="px-3 py-3">Provider</th>
                <th className="px-3 py-3">Content</th>
                <th className="px-3 py-3">Queued</th>
                <th className="px-3 py-3">Duration</th>
                <th className="px-3 py-3">Retries</th>
                <th className="px-3 py-3">Audio</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-gray-500 dark:text-gray-400">
                    Loading audio jobs…
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-gray-500 dark:text-gray-400">
                    No audio jobs found.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="border-b border-gray-100 align-top dark:border-gray-800">
                    <td className="px-3 py-3">
                      <StatusCell status={job.status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="max-w-[16rem] truncate font-medium text-gray-900 dark:text-white">
                        {job.text_to_speak}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {job.language_code ? `Lang: ${job.language_code}` : null}
                        {job.voice_code ? ` • Voice: ${job.voice_code}` : null}
                      </div>
                      {job.error_message ? (
                        <div className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <FaExclamationTriangle className="text-[10px]" />
                          <span className="max-w-[16rem] truncate">{job.error_message}</span>
                          <LogsTooltip logs={job.logs} />
                        </div>
                      ) : null}
                      {!job.error_message && job.logs ? (
                        <div className="mt-1">
                          <LogsTooltip logs={job.logs} />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">
                      <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                        {job.provider || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">
                      <div className="text-sm capitalize">{job.content_type}</div>
                      <div className="text-xs text-gray-500">{job.audio_format?.toUpperCase() || '—'}</div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-700 dark:text-gray-200">
                      {formatDateTime(job.queued_at)}
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">
                      {formatDuration(job.output_duration_sec)}
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">
                      <span className={job.retry_count >= job.max_retries ? 'text-red-600 dark:text-red-400' : ''}>
                        {job.retry_count}/{job.max_retries}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {job.audio_url && job.status === 'completed' ? (
                        <AudioPlayer src={job.audio_url} />
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {job.status === 'failed' && job.retry_count < job.max_retries && (
                          <button
                            type="button"
                            onClick={() => void retryJob(job.id)}
                            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-300"
                          >
                            Retry
                          </button>
                        )}
                        {(job.status === 'queued' || job.status === 'processing') && (
                          <button
                            type="button"
                            onClick={() => void cancelJob(job.id)}
                            className="text-xs font-medium text-red-600 hover:underline dark:text-red-300"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {pageStart} to {pageEnd} of {total} jobs
          </p>
          <div className="ml-auto">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </div>
    </div>
  );
}
