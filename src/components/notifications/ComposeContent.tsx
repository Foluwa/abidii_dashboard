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
import { Funnel, Globe, PenLine, Target, User } from "lucide-react";

type SelectedUser = { id: string; label: string };

type IconComponent = React.ComponentType<{ className?: string }>;

const TargetOption: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: IconComponent;
  label: string;
}> = ({ active, onClick, icon: Icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium shadow-xs transition-colors ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-input bg-background text-foreground hover:bg-accent"
    }`}
  >
    <Icon className="size-4" />
    <span>{label}</span>
  </button>
);

const SectionCard: React.FC<{
  icon: IconComponent;
  title: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, children }) => (
  <div className="rounded-xl border border-border bg-card p-5">
    <div className="mb-4 flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
    </div>
    {children}
  </div>
);

export function ComposeContent({ showHeader = true }: { showHeader?: boolean; isActive?: boolean }) {
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
      {showHeader && <PageBreadCrumb pageTitle="Notifications" />}
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        {/* Compose Column */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-6 text-lg font-semibold text-foreground">
              Compose Notification
            </h2>

            {/* Target Pills */}
            <div className="mb-6">
              <label className="mb-3 block text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Audience
              </label>
              <div className="flex flex-wrap gap-2">
                <TargetOption
                  active={targetMode === 'all'}
                  onClick={() => setTargetMode('all')}
                  icon={Globe}
                  label="All Users"
                />
                <TargetOption
                  active={targetMode === 'selected'}
                  onClick={() => setTargetMode('selected')}
                  icon={User}
                  label="Selected"
                />
                <TargetOption
                  active={targetMode === 'filtered'}
                  onClick={() => setTargetMode('filtered')}
                  icon={Funnel}
                  label="Filtered"
                />
              </div>
            </div>

            {/* Content Section */}
            <SectionCard icon={PenLine} title="Content">
              <div className="mb-4">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  placeholder="Notification title"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
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
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
                <p className="mt-1 text-right text-xs text-gray-400">{body.length}/200</p>
              </div>
              <div>
                <input
                  type="text"
                  value={dataPayload}
                  onChange={(e) => setDataPayload(e.target.value)}
                  placeholder='{"route": "/lesson/abc"}'
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Optional JSON deep link payload
                </p>
              </div>
            </SectionCard>

            {/* Targeting Section */}
            <SectionCard icon={Target} title="Targeting">
              {targetMode === 'selected' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
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
                    className="mb-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />

                  <div className="h-48 overflow-y-auto rounded-lg border border-input">
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
                            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleUser(user.id, label)}
                              className="rounded border-input text-brand-500 focus:ring-brand-500"
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
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Language Code
                    </label>
                    <input
                      type="text"
                      value={languageCode}
                      onChange={(e) => setLanguageCode(e.target.value)}
                      placeholder="yor, eng, etc."
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
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
                className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {sending ? 'Sending...' : 'Send Notification'}
              </button>
              <button
                type="button"
                onClick={() => doSend(true)}
                disabled={sending}
                className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
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
          <div className="sticky top-6 rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <span>📱</span> Mobile Preview
            </h3>

            {/* Phone Frame */}
            <div className="mx-auto w-full max-w-[280px]">
              {/* Notch */}
              <div className="mx-auto h-6 w-28 rounded-b-2xl bg-gray-900" />
              {/* Screen */}
              <div className="rounded-2xl border-2 border-gray-900 bg-muted p-3">
                {/* Status bar */}
                <div className="mb-4 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>9:41</span>
                  <span>🔋 📶</span>
                </div>

                {/* Notification card */}
                <div className="rounded-xl bg-card p-3 shadow-sm">
                  <div className="mb-1 flex items-start gap-2">
                    <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-brand-500 text-[10px] text-primary-foreground">
                      A
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-foreground">
                          Abidii
                        </span>
                        <span className="text-[10px] text-gray-400">now</span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-semibold text-foreground">
                        {title || 'Notification Title'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {body || 'Body text appears here...'}
                      </p>
                    </div>
                  </div>
                  {dataPayload !== '{}' && dataPayload.trim() && (
                    <div className="mt-1 rounded-md bg-muted p-1">
                      <code className="text-[9px] text-muted-foreground">
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
