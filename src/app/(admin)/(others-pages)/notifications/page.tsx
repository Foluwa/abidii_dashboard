'use client';

import React, { useState, useCallback, useEffect } from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { useToast } from '@/contexts/ToastContext';
import {
  sendNotification,
  broadcastNotification,
  sendFilteredNotification,
} from '@/lib/notificationsApi';
import { useUsers } from '@/hooks/useApi';
import { StyledSelect } from '@/components/ui/form/StyledSelect';

type SelectedUser = { id: string; label: string };

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
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
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

  const selectedUserIds = selectedUsers.map((u) => u.id);

  // Debounced user search — avoids firing a request on every keystroke.
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setUserSearchQuery(userSearchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [userSearchInput]);

  const { users: usersData, isLoading: usersLoading } = useUsers({
    limit: 20,
    search: userSearchQuery || undefined,
  });
  // GET /admin/users responds { total, limit, offset, users: [...] } —
  // not a bare array and not `.items` (the pre-existing fallback here was
  // wrong, which is why search always showed 0 results despite the network
  // request itself succeeding).
  const userList = Array.isArray(usersData) ? usersData : (usersData as any)?.users || [];

  const toggleUser = (id: string, label: string) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === id)
        ? prev.filter((u) => u.id !== id)
        : [...prev, { id, label }]
    );
  };

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
    [title, body, dataPayload, targetMode, selectedUsers, platform, languageCode, toast]
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
                    Select Users ({selectedUsers.length} chosen)
                  </label>

                  {/* Selected users as removable chips — kept separate from
                      the search results below so a selection survives
                      refining/clearing the search query. */}
                  {selectedUsers.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {selectedUsers.map((u) => (
                        <span
                          key={u.id}
                          className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                        >
                          {u.label}
                          <button
                            type="button"
                            onClick={() => toggleUser(u.id, u.label)}
                            aria-label={`Remove ${u.label}`}
                            className="text-brand-500 hover:text-brand-700 dark:hover:text-brand-100"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <input
                    type="text"
                    value={userSearchInput}
                    onChange={(e) => setUserSearchInput(e.target.value)}
                    placeholder="Search by name or email..."
                    className="mb-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500"
                  />

                  <div className="h-48 overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-600">
                    {usersLoading ? (
                      <p className="p-3 text-sm text-gray-400">Searching...</p>
                    ) : userList.length === 0 ? (
                      <p className="p-3 text-sm text-gray-400">
                        {userSearchQuery ? 'No matching users.' : 'Type to search users.'}
                      </p>
                    ) : (
                      userList.map((user: any) => {
                        const label = user.display_name || user.email || user.id;
                        const checked = selectedUserIds.includes(user.id);
                        return (
                          <label
                            key={user.id}
                            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleUser(user.id, label)}
                              className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                            />
                            <span className="flex-1 truncate">{label}</span>
                            {user.email && user.display_name && (
                              <span className="truncate text-xs text-gray-400">{user.email}</span>
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {targetMode === 'filtered' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <StyledSelect
                      label="Platform"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value as any)}
                      options={[
                        { value: 'all', label: 'All Platforms' },
                        { value: 'android', label: 'Android Only' },
                        { value: 'ios', label: 'iOS Only' },
                      ]}
                      fullWidth
                    />
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
