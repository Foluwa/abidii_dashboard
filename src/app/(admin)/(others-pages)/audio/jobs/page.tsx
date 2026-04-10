"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import Pagination from "@/components/tables/Pagination";
import { FaSync, FaCheckCircle, FaExclamationCircle, FaClock, FaPlay } from "react-icons/fa";

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
  retry_count: number;
  max_retries: number;
  queued_at: string;
  started_at?: string;
  completed_at?: string;
}

export default function AudioJobsPage() {
  const [jobs, setJobs] = useState<AudioJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterProvider, setFilterProvider] = useState<string>("");
  const [filterContentType, setFilterContentType] = useState<string>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const limit = 20;

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let url = `/api/v1/admin/audio/jobs?page=${page}&page_size=${limit}`;
      if (filterStatus) url += `&status=${filterStatus}`;
      if (filterProvider) url += `&provider=${filterProvider}`;
      if (filterContentType) url += `&content_type=${filterContentType}`;

      const response = await apiClient.get(url);
      const data = response.data;
      setJobs(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [filterContentType, filterProvider, filterStatus, limit, page]);

  useEffect(() => {
    fetchJobs();

    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchJobs, 10000); // Refresh every 10 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchJobs]);

  const retryJob = async (jobId: string) => {
    try {
      await apiClient.post(`/api/v1/admin/audio/jobs/${jobId}/retry`);
      setSuccessMessage("Job queued for retry");
      fetchJobs();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to retry job");
      setTimeout(() => setError(""), 5000);
    }
  };

  const cancelJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to cancel this job?")) return;

    try {
      await apiClient.delete(`/api/v1/admin/audio/jobs/${jobId}`);
      setSuccessMessage("Job cancelled successfully");
      fetchJobs();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to cancel job");
      setTimeout(() => setError(""), 5000);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <FaCheckCircle className="text-green-600" />;
      case "failed":
        return <FaExclamationCircle className="text-red-600" />;
      case "processing":
        return <FaSync className="text-blue-600 animate-spin" />;
      case "queued":
        return <FaClock className="text-yellow-600" />;
      default:
        return <FaClock className="text-gray-600" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      case "failed":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
      case "processing":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "queued":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      case "cancelled":
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const formatDuration = (seconds?: number | null) => {
    if (seconds == null) return "-";
    return `${seconds.toFixed(1)}s`;
  };

  const formatDateTime = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalPages = Math.ceil(total / limit);

  const getQueuedAt = (job: AudioJob) => job.queued_at;

  return (
    <div className="p-6">
      <PageBreadCrumb pageTitle="Audio Jobs" />

      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audio Generation Jobs</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Monitor TTS generation jobs and their status
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300"
            />
            Auto-refresh (10s)
          </label>
          <button
            onClick={fetchJobs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <FaSync /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex-1">
          <StyledSelect
            label="Status"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            fullWidth
            options={[
              { value: "", label: "All Statuses" },
              { value: "queued", label: "Queued" },
              { value: "processing", label: "Processing" },
              { value: "completed", label: "Completed" },
              { value: "failed", label: "Failed" },
              { value: "cancelled", label: "Cancelled" }
            ]}
            placeholder="All Statuses"
          />
        </div>
        <div className="flex-1">
          <StyledSelect
            label="Provider"
            value={filterProvider}
            onChange={(e) => {
              setFilterProvider(e.target.value);
              setPage(1);
            }}
            fullWidth
            options={[
              { value: "", label: "All Providers" },
              { value: "google", label: "Google TTS" },
              { value: "spitch", label: "Spitch" },
              { value: "elevenlabs", label: "ElevenLabs" }
            ]}
            placeholder="All Providers"
          />
        </div>
        <div className="flex-1">
          <StyledSelect
            label="Content Type"
            value={filterContentType}
            onChange={(e) => {
              setFilterContentType(e.target.value);
              setPage(1);
            }}
            fullWidth
            options={[
              { value: "", label: "All Types" },
              { value: "word", label: "Words" },
              { value: "phrase", label: "Phrases" },
              { value: "proverb", label: "Proverbs" },
              { value: "number", label: "Numbers" },
              { value: "letter", label: "Letters" },
              { value: "sentence", label: "Sentences" },
            ]}
            placeholder="All Types"
          />
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12">
            <FaClock className="mx-auto text-gray-400 text-5xl mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No audio jobs found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Text
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Queued
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Progress
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(job.status)}`}>
                            {job.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate">
                          {job.text_to_speak}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {job.content_type}
                          {job.language_code ? ` • ${job.language_code}` : ""}
                          {job.voice_code ? ` • ${job.voice_code}` : ""}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                          {job.provider || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatDateTime(getQueuedAt(job))}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {job.output_duration_sec != null && <div>Duration: {formatDuration(job.output_duration_sec)}</div>}
                        {job.audio_format && <div>Format: {job.audio_format.toUpperCase()}</div>}
                        {job.error_message && (
                          <div className="text-xs text-red-600 dark:text-red-400 max-w-xs truncate">
                            Error: {job.error_message}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <div>Retries: {job.retry_count}/{job.max_retries}</div>
                        {job.started_at && <div className="text-xs text-gray-500">Started: {formatDateTime(job.started_at)}</div>}
                        {job.completed_at && <div className="text-xs text-gray-500">Done: {formatDateTime(job.completed_at)}</div>}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {job.audio_url && (
                          <a
                            href={job.audio_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-800 dark:text-green-400 text-sm inline-flex items-center gap-1"
                          >
                            <FaPlay className="text-xs" /> Play
                          </a>
                        )}
                        {job.status === "failed" && job.retry_count < job.max_retries && (
                          <button
                            onClick={() => retryJob(job.id)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm"
                          >
                            Retry
                          </button>
                        )}
                        {(job.status === "queued" || job.status === "processing") && (
                          <button
                            onClick={() => cancelJob(job.id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} jobs
                </div>
                <div className="ml-auto">
                  <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
