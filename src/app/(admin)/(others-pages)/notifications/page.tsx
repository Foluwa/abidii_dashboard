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

const TargetOption: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
      active
        ? 'bg-brand-500 text-white shadow-sm'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
    }`}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </button>
);

const SectionCard: React.FC<{
  icon: string;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/50">
    <div className="mb-4 flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {title}
      </h3>
    </div>
    {children}
  </div>
);

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

  const doSend = useCallback(
    async (testMode = false) => {
      if (!title.trim() || !body.trim()) {
        toast.error('Title and body are required.');
        return;
      }

      let parsedData: Record<string, string> | undefined;
      try {
        const parsed = JSON.parse(dataPayload);
        if (typeof parsed === 'object' && parsed !== null) parsedData = parsed;
      } catch {}

      setSending(true);
      setResult(null);

      try {
        let res;
        if (testMode) {
          res = await sendFilteredNotification({
            title: `[TEST] ${title.trim()}`,
            body: body.trim(),
            data: parsedData,
            ...(platform !== 'all' ? { platform } : {}),
            ...(languageCode ? { language_code: languageCode } : {}),
          });
        } else if (targetMode === 'all') {
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
    },
    [title, body, dataPayload, targetMode, selectedUserIds, platform, languageCode, toast]
  );

  return (
    <div>
      <PageBreadCrumb pageTitle="Notifications" />
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        {/* Compose Column */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">
              Compose Notification
            </h2>

            {/* Target Pills */}
            <div className="mb-6">
              <label className="mb-3 block text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Audience
              </label>
              <div className="flex flex-wrap gap-2">
                <TargetOption
                  active={targetMode === 'all'}
                  onClick={() => setTargetMode('all')}
                  icon="🌍"
                  label="All Users"
                />
                <TargetOption
                  active={targetMode === 'selected'}
                  onClick={() => setTargetMode('selected')}
                  icon="👤"
                  label="Selected"
                />
                <TargetOption
                  active={targetMode === 'filtered'}
                  onClick={() => setTargetMode('filtered')}
                  icon="🔍"
                  label="Filtered"
                />
              </div>
            </div>

            {/* Content Section */}
            <SectionCard icon="✏️" title="Content">
              <div className="mb-4">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  placeholder="Notification title"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500"
                />
                <p className="mt-1 text-right text-xs text-gray-400">{title.length}/100</p>
              </div>
              <div className="mb-4">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={200}
                  rows={3}
                  placeholder="Notification body text"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500"
                />
                <p className="mt-1 text-right text-xs text-gray-400">{body.length}/200</p>
              </div>
              <div>
                <input
                  type="text"
                  value={dataPayload}
                  onChange={(e) => setDataPayload(e.target.value)}
                  placeholder='{"route": "/lesson/abc"}'
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Optional JSON deep link payload
                </p>
              </div>
            </SectionCard>

            {/* Targeting Section */}
            <SectionCard icon="🎯" title="Targeting">
              {targetMode === 'selected' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select Users ({selectedUserIds.length} chosen)
                  </label>
                  <select
                    multiple
                    value={selectedUserIds.map(String)}
                    onChange={(e) =>
                      setSelectedUserIds(
                        Array.from(e.target.selectedOptions, (opt) => Number(opt.value))
                      )
                    }
                    className="h-40 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Platform
                    </label>
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
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Language Code
                    </label>
                    <input
                      type="text"
                      value={languageCode}
                      onChange={(e) => setLanguageCode(e.target.value)}
                      placeholder="yor, eng, etc."
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500"
                    />
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Actions */}
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => doSend(false)}
                disabled={sending}
                className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {sending ? 'Sending...' : 'Send Notification'}
              </button>
              <button
                type="button"
                onClick={() => doSend(true)}
                disabled={sending}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                🧪 Test Send
              </button>
            </div>

            {/* Result */}
            {result && (
              <div
                className={`mt-4 rounded-lg p-4 text-sm ${
                  result.success
                    ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                    : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                }`}
              >
                <p className="font-medium">{result.message}</p>
                <div className="mt-2 flex gap-4">
                  <span>🤖 Android: <strong>{result.android_sent}</strong></span>
                  <span>🍎 iOS: <strong>{result.ios_sent}</strong></span>
                  <span>❌ Failed: <strong>{result.failed}</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview Column */}
        <div className="space-y-6">
          <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <span>📱</span> Mobile Preview
            </h3>

            {/* Phone Frame */}
            <div className="mx-auto w-full max-w-[280px]">
              {/* Notch */}
              <div className="mx-auto h-6 w-28 rounded-b-2xl bg-gray-900" />
              {/* Screen */}
              <div className="rounded-2xl border-2 border-gray-900 bg-gray-100 p-3 dark:bg-gray-900">
                {/* Status bar */}
                <div className="mb-4 flex items-center justify-between text-[10px] text-gray-500">
                  <span>9:41</span>
                  <span>🔋 📶</span>
                </div>

                {/* Notification card */}
                <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
                  <div className="mb-1 flex items-start gap-2">
                    <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-brand-500 text-[10px] text-white">
                      A
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-gray-900 dark:text-white">
                          Abidii
                        </span>
                        <span className="text-[10px] text-gray-400">now</span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-semibold text-gray-900 dark:text-white">
                        {title || 'Notification Title'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-400">
                        {body || 'Body text appears here...'}
                      </p>
                    </div>
                  </div>
                  {dataPayload !== '{}' && dataPayload.trim() && (
                    <div className="mt-1 rounded-md bg-gray-50 p-1 dark:bg-gray-700">
                      <code className="text-[9px] text-gray-500 dark:text-gray-400">
                        {dataPayload.length > 60
                          ? dataPayload.slice(0, 60) + '...'
                          : dataPayload}
                      </code>
                    </div>
                  )}
                </div>

                {/* Home indicator */}
                <div className="mx-auto mt-3 h-1 w-24 rounded-full bg-gray-900" />
              </div>
            </div>

            <div className="mt-4 text-center text-xs text-gray-400">
              {targetMode === 'all' && 'Will appear on all devices'}
              {targetMode === 'selected' &&
                `${selectedUserIds.length} user${selectedUserIds.length !== 1 ? 's' : ''} selected`}
              {targetMode === 'filtered' &&
                `Filtered by ${platform !== 'all' ? platform : 'all platforms'}${languageCode ? ` · ${languageCode}` : ''}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
