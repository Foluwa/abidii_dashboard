"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useGameAnalytics, useLanguages, useAvailableGames } from '@/hooks/useApi';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Alert from '@/components/ui/alert/SimpleAlert';
import { StyledSelect } from '@/components/ui/form/StyledSelect';

// Game key to friendly name mapping
const GAME_NAMES: Record<string, string> = {
  'number-identify': 'Number Identify',
  'alphabet-tracing': 'Alphabet Tracing',
  'proverb': 'Proverb Game',
  'language-tone': 'Language Tone',
  'spelling-bee': 'Spelling Bee',
  'word-match': 'Word Match',
  'listening': 'Listening Practice',
};

const formatGameName = (key: string) => GAME_NAMES[key] || key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

export default function GameAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [selectedGame, setSelectedGame] = useState<string>('');
  const pathname = usePathname();
  
  const { analytics, isLoading, isError, refresh } = useGameAnalytics(
    days, 
    selectedGame || undefined, 
    selectedLanguage || undefined
  );
  const { languages } = useLanguages();
  const { games } = useAvailableGames();

  const tabs = [
    { name: 'Overview', href: '/analytics' },
    { name: 'Players', href: '/analytics/players' },
    { name: 'Curriculum Ops', href: '/analytics/curriculum-ops' },
  ];

  if (isError) {
    const errMsg = isError?.response?.data?.detail || isError?.message || 'Failed to load game analytics.';
    const status = isError?.response?.status;
    return (
      <div className="p-6 space-y-4">
        <Alert variant="error">
          <div className="font-medium">Failed to load game analytics</div>
          <div className="text-sm mt-1">{errMsg}{status ? ` (HTTP ${status})` : ''}</div>
        </Alert>
        <button
          onClick={() => refresh()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <PageBreadCrumb pageTitle="Game Analytics" />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track game performance, error patterns, and player progress across all games
          </p>
        </div>
        <button
          onClick={() => refresh()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex -mb-px space-x-8">
          {tabs.map((tab) => (
            <Link
              key={tab.name}
              href={tab.href}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm
                ${pathname === tab.href
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              {tab.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <StyledSelect
              label="Time Range"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              options={[
                { value: 7, label: 'Last 7 days' },
                { value: 30, label: 'Last 30 days' },
                { value: 60, label: 'Last 60 days' },
                { value: 90, label: 'Last 90 days' },
              ]}
              fullWidth
            />
          </div>
          <div>
            <StyledSelect
              label="Language"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              options={[
                { value: '', label: 'All Languages' },
                ...languages.map((lang: any) => ({ value: lang.id, label: lang.name })),
              ]}
              fullWidth
            />
          </div>
          <div>
            <StyledSelect
              label="Game Type"
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              options={[
                { value: '', label: 'All Games' },
                ...games.map((game: any) => ({
                  value: game.game_key,
                  label: `${formatGameName(game.game_key)} (${game.session_count})`,
                })),
              ]}
              fullWidth
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedLanguage('');
                setSelectedGame('');
                setDays(30);
              }}
              className="w-full px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Sessions</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              {analytics?.overview.total_sessions?.toLocaleString() || '0'}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {analytics?.overview.unique_users?.toLocaleString() || '0'} unique users
            </p>
          </div>
          <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Overall Accuracy</p>
            <p className={`mt-2 text-3xl font-semibold ${
              (analytics?.overview.accuracy || 0) >= 80 ? 'text-green-600 dark:text-green-400' :
              (analytics?.overview.accuracy || 0) >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {analytics?.overview.accuracy || 0}%
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {analytics?.overview.correct_answers?.toLocaleString() || '0'} / {analytics?.overview.total_rounds?.toLocaleString() || '0'} correct
            </p>
          </div>
          <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Score</p>
            <p className={`mt-2 text-3xl font-semibold ${
              (analytics?.overview.avg_score || 0) >= 80 ? 'text-green-600 dark:text-green-400' :
              (analytics?.overview.avg_score || 0) >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {analytics?.overview.avg_score || 0}%
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Average session score
            </p>
          </div>
          <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Perfect Scores</p>
            <p className="mt-2 text-3xl font-semibold text-green-600 dark:text-green-400">
              {analytics?.overview.perfect_scores?.toLocaleString() || '0'}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {analytics?.overview.total_sessions > 0
                ? ((analytics?.overview.perfect_scores / analytics?.overview.total_sessions) * 100).toFixed(1)
                : 0}% of sessions
            </p>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Game Type Breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Performance by Game</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Compare stats across different game types
          </p>
          {isLoading ? (
            <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          ) : analytics?.by_game_type?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Game</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sessions</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Accuracy</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Perfect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {analytics?.by_game_type.map((game: any) => (
                    <tr key={game.game_key} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {formatGameName(game.game_key)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {game.total_sessions.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${
                          game.accuracy >= 80 ? 'text-green-600 dark:text-green-400' :
                          game.accuracy >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {game.accuracy}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {game.perfect_scores}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No game data available for this period</p>
          )}
        </div>

        {/* Error Categories */}
        <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error Categories</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Where players are struggling the most
          </p>
          {isLoading ? (
            <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          ) : analytics?.error_categories?.length > 0 ? (
            <div className="space-y-3">
              {analytics?.error_categories.map((cat: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium text-gray-900 dark:text-white truncate" title={cat.category}>
                    {cat.category}
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-5 overflow-hidden">
                      <div
                        className={`h-5 rounded-full flex items-center justify-end px-2 text-xs text-white font-medium ${
                          idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.max(cat.percentage, 8)}%` }}
                      >
                        {cat.percentage > 10 && `${cat.percentage}%`}
                      </div>
                    </div>
                  </div>
                  <div className="w-14 text-right text-sm text-gray-500 dark:text-gray-400">
                    {cat.count}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No error data available</p>
          )}
        </div>
      </div>

      {/* Most Challenging Content - Full Width */}
      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Most Challenging Content</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Items where all players are struggling - focus teaching efforts here
        </p>
        {isLoading ? (
          <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        ) : analytics?.most_missed?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Content</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Misses</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Attempts</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {analytics?.most_missed.slice(0, 15).map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white max-w-[300px] truncate" title={item.prompt_display}>
                      {item.prompt_display || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                        {item.content_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-red-600 dark:text-red-400 font-semibold">
                      {item.miss_count}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white">
                      {item.total_attempts}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-semibold ${
                        item.accuracy >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {item.accuracy}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No missed content data available</p>
        )}
      </div>

      {/* Daily Trend */}
      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Daily Activity Trend</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Sessions and performance over time
        </p>
        {isLoading ? (
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        ) : analytics?.daily_trend?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sessions</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Correct</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Wrong</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {analytics?.daily_trend.slice(-14).reverse().map((day: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{day.date}</td>
                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white">{day.sessions}</td>
                    <td className="px-6 py-4 text-right text-green-600 dark:text-green-400">{day.correct}</td>
                    <td className="px-6 py-4 text-right text-red-600 dark:text-red-400">{day.wrong}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-semibold ${
                        day.avg_score >= 80 ? 'text-green-600 dark:text-green-400' :
                        day.avg_score >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {day.avg_score}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No daily trend data available</p>
        )}
      </div>
    </div>
  );
}
