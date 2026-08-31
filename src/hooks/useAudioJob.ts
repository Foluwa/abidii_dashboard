import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

export type AudioJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type AudioJob = {
  id: string;
  job_type: string;
  status: AudioJobStatus;
  content_type: string;
  content_id: string;
  voice_id: string | null;
  voice_settings: Record<string, unknown>;
  text_to_speak: string;
  output_url: string | null;
  audio_url: string | null;
  output_duration_sec: number | null;
  audio_format: string | null;
  provider: string | null;
  voice_code: string | null;
  language_code: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  created_by: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
};

const TERMINAL_STATUSES = new Set<AudioJobStatus>(['completed', 'failed', 'cancelled']);

export async function getAudioJob(jobId: string) {
  const res = await apiClient.get<AudioJob>(`/api/v1/admin/audio/jobs/${jobId}`);
  return res.data;
}

export async function acceptAudioJob(jobId: string) {
  const res = await apiClient.post<AudioJob>(`/api/v1/admin/audio/jobs/${jobId}/accept`);
  return res.data;
}

export function useAudioJob(jobId?: string | null) {
  const [job, setJob] = useState<AudioJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) {
      setJob(null);
      return null;
    }

    setLoading(true);
    try {
      const nextJob = await getAudioJob(jobId);
      setJob(nextJob);
      setError(null);
      return nextJob;
    } catch (err: any) {
      const message = err?.response?.data?.detail ?? err?.message ?? 'Failed to load audio job';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      if (cancelled) return;
      await refresh();
    };

    void load();
    const intervalId = window.setInterval(async () => {
      if (cancelled) return;
      const nextJob = await refresh();
      if (nextJob && TERMINAL_STATUSES.has(nextJob.status)) {
        window.clearInterval(intervalId);
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [jobId, refresh]);

  return {
    job,
    loading,
    error,
    status: job?.status,
    audioUrl: job?.audio_url ?? null,
    refresh,
  };
}
