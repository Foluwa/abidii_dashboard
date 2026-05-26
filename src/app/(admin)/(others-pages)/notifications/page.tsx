'use client';

import React, { useState, useCallback } from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { useToast } from '@/contexts/ToastContext';
import {
  sendNotification,
  broadcastNotification,
  sendFilteredNotification,
} from '@/lib/notificationsApi';
import { useUsers } from '@/hooks/useApi';

export default function NotificationsPage() {
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dataPayload, setDataPayload] = useState('{}');
  const [targetMode, setTargetMode] = useState<'all' | 'selected' | 'filtered'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'all'>('all');
  const [languageCode, setLanguageCode] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    android_sent: number;
    ios_sent: number;
    failed: number;
  } | null>(null);

  const { users: usersData } = useUsers({ limit: 200 });
  const userList = Array.isArray(usersData) ? usersData : (usersData as any)?.items || [];

  const handleSend = useCallback(async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and body are required.');
      return;
    }

    let parsedData: Record<string, string> | undefined;
    try {
      const parsed = JSON.parse(dataPayload);
      if (typeof parsed === 'object' && parsed !== null) {
        parsedData = parsed;
      }
    } catch {
      // treat as empty
    }

    setSending(true);
    setResult(null);

    try {
      let res;
      if (targetMode === 'all') {
        res = await broadcastNotification({
          title: title.trim(),
          body: body.trim(),
          data: parsedData,
        });
      } else if (targetMode === 'selected') {
        if (selectedUserIds.length === 0) {
          toast.error('Select at least one user.');
          setSending(false);
          return;
        }
        res = await sendNotification({
          user_ids: selectedUserIds,
          title: title.trim(),
          body: body.trim(),
          data: parsedData,
        });
      } else {
        res = await sendFilteredNotification({
          title: title.trim(),
          body: body.trim(),
          data: parsedData,
          language_code: languageCode || undefined,
          platform,
          ...(selectedUserIds.length > 0 ? { user_ids: selectedUserIds } : {}),
        });
      }

      setResult(res);
      toast.success(`Sent: ${res.message}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Failed to send');
    } finally {
      setSending(false);
    }
  }, [title, body, dataPayload, targetMode, selectedUserIds, platform, languageCode, toast]);

  return (
    <div>
      <PageBreadCrumb pageTitle="Push Notifications" />
      <div className="grid grid-cols-1 gap-6 p-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Compose Notification</h2>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Notification title"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-right text-xs text-gray-400">{title.length}/100</p>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Body *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="Notification body text"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-right text-xs text-gray-400">{body.length}/200</p>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Data Payload (JSON) <span className="text-gray-400 font-normal">— optional deep link payload</span>
            </label>
            <input
              type="text"
              value={dataPayload}
              onChange={(e) => setDataPayload(e.target.value)}
              placeholder='{"route": "/lesson/abc"}'
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
                Deep link payload examples
              </summary>
              <div className="mt-1 rounded-md bg-gray-50 p-2 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                <p className="mb-1 font-medium">Opens specific app screens on tap:</p>
                <code className="block">{"{ \"route\": \"/structured-lesson/lesson_yoruba_u01_s01\" }"}</code>
                <code className="block">{"{ \"route\": \"/games/tracing\" }"}</code>
                <code className="block">{"{ \"route\": \"/multiplayer/instant/room/{roomId}\" }"}</code>
                <code className="block">{"{ \"route\": \"/streak\" }"}</code>
                <p className="mt-1">Keys under 10 chars, values any string.</p>
              </div>
            </details>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Target</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="target"
                  checked={targetMode === 'all'}
                  onChange={() => setTargetMode('all')}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">All Users</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="target"
                  checked={targetMode === 'selected'}
                  onChange={() => setTargetMode('selected')}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Selected Users</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="target"
                  checked={targetMode === 'filtered'}
                  onChange={() => setTargetMode('filtered')}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Filtered</span>
              </label>
            </div>
          </div>

          {targetMode === 'selected' && (
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Select Users</label>
              <select
                multiple
                value={selectedUserIds.map(String)}
                onChange={(e) =>
                  setSelectedUserIds(
                    Array.from(e.target.selectedOptions, (opt) => Number(opt.value))
                  )
                }
                className="h-32 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                {userList.map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name || user.email || user.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetMode === 'filtered' && (
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as any)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">All Platforms</option>
                  <option value="android">Android Only</option>
                  <option value="ios">iOS Only</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Language Code</label>
                <input
                  type="text"
                  value={languageCode}
                  onChange={(e) => setLanguageCode(e.target.value)}
                  placeholder="yor, eng, etc."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Notification'}
          </button>

          {result && (
            <div
              className={`mt-4 rounded-lg p-3 text-sm ${
                result.success
                  ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                  : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'
              }`}
            >
              <p className="font-medium">{result.message}</p>
              <p className="mt-1">
                Android: {result.android_sent} | iOS: {result.ios_sent} | Failed: {result.failed}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
