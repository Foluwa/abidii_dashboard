"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePlayerLeaderboard, usePlayerDetail, useLanguages, useAvailableGames } from '@/hooks/useApi';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Alert from '@/components/ui/alert/SimpleAlert';
import Pagination from '@/components/tables/Pagination';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { cleanSvgForDisplay, getInitials as getSvgInitials, getAvatarColor as getSvgAvatarColor } from '@/lib/svg-utils';

type TimeRange = 'week' | 'month' | 'all';
type SortBy = 'score' | 'sessions' | 'accuracy' | 'time' | 'xp';

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

const formatDuration = (ms: number) => {
  if (!ms) return '0m';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatShortDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function PlayerAnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedUserId = searchParams.get('userId');
  
  // Filters state
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [sortBy, setSortBy] = useState<SortBy>('score');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [page, setPage] = useState(1);
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Fetch data
  const { leaderboard, isLoading, isError, refresh } = usePlayerLeaderboard({
    period: timeRange,
    sortBy,
    search: debouncedSearch || undefined,
    gameKey: gameFilter || undefined,
    languageId: languageFilter || undefined,
    page,
    perPage: 20,
  });
  
  const { player, isLoading: isLoadingPlayer } = usePlayerDetail(
    selectedUserId,
    {
      days: 90,
      languageId: languageFilter || undefined,
      gameKey: gameFilter || undefined,
    }
  );
  
  const { languages } = useLanguages();
  const { games } = useAvailableGames();
  const totalPages = Math.max(1, Math.ceil((leaderboard?.total || 0) / 20));

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getInitials = (name: string | null | undefined) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return '??';
  };

  const getAvatarColor = (id: string) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500'];
    const index = id.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const tabs = [
    { name: 'Overview', href: '/analytics', active: false },
    { name: 'Players', href: '/analytics/players', active: true },
    { name: 'Curriculum Ops', href: '/analytics/curriculum-ops', active: false },
  ];

  if (isError) {
    const errMsg = isError?.response?.data?.detail || isError?.message || 'Failed to load player analytics.';
    const status = isError?.response?.status;
    return (
      <div className="p-6 space-y-4">
        <Alert variant="error">
          <div className="font-medium">Failed to load player analytics</div>
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
          <PageBreadCrumb pageTitle="Player Analytics" />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track individual player performance, leaderboard rankings, and progress over time
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
                ${tab.active
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

      {!selectedUserId ? (
        <>
          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search Player</label>
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>
              <div>
                <StyledSelect
                  label="Time Period"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                  options={[
                    { value: 'week', label: 'This Week' },
                    { value: 'month', label: 'This Month' },
                    { value: 'all', label: 'All Time' },
                  ]}
                  fullWidth
                />
              </div>
              <div>
                <StyledSelect
                  label="Language"
                  value={languageFilter}
                  onChange={(e) => setLanguageFilter(e.target.value)}
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
                  value={gameFilter}
                  onChange={(e) => setGameFilter(e.target.value)}
                  options={[
                    { value: '', label: 'All Games' },
                    ...games.map((game: any) => ({
                      value: game.game_key,
                      label: formatGameName(game.game_key),
                    })),
                  ]}
                  fullWidth
                />
              </div>
              <div>
                <StyledSelect
                  label="Sort By"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  options={[
                    { value: 'score', label: 'Highest Score' },
                    { value: 'sessions', label: 'Most Sessions' },
                    { value: 'accuracy', label: 'Best Accuracy' },
                    { value: 'time', label: 'Most Time Played' },
                    { value: 'xp', label: 'Highest XP' },
                  ]}
                  fullWidth
                />
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          {leaderboard && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Players</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{leaderboard.total?.toLocaleString() || 0}</p>
              </div>
              <div className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400">Showing</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{leaderboard.players?.length || 0}</p>
              </div>
              <div className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400">Page</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{page} / {Math.ceil((leaderboard.total || 1) / 20)}</p>
              </div>
              <div className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400">Period</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white capitalize">{timeRange === 'all' ? 'All Time' : `This ${timeRange}`}</p>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Player Leaderboard</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {leaderboard?.total || 0} players ranked by {sortBy === 'score' ? 'average score' : sortBy}
              </p>
            </div>
            
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-500 dark:text-gray-400">Loading players...</p>
              </div>
            ) : leaderboard?.players?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Player
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Sessions
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Avg Score
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Accuracy
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Perfect
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Time Played
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        XP
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {leaderboard.players.map((player: any) => (
                      <tr
                        key={player.user_id}
                        onClick={() => router.push(`/analytics/players?userId=${player.user_id}`)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-2xl ${player.rank <= 3 ? '' : 'text-gray-500 dark:text-gray-400 text-base'}`}>
                            {getRankBadge(player.rank)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {player.avatar_url && cleanSvgForDisplay(player.avatar_url) ? (
                              <img src={cleanSvgForDisplay(player.avatar_url)!} alt="" className="h-10 w-10 rounded-full" />
                            ) : (
                              <div className={`h-10 w-10 rounded-full ${getAvatarColor(player.user_id)} flex items-center justify-center text-white font-semibold`}>
                                {getInitials(player.display_name)}
                              </div>
                            )}
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {player.display_name || 'Anonymous'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                          {player.total_sessions?.toLocaleString() || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <span className={`font-semibold ${
                            player.avg_score >= 90 ? 'text-green-600 dark:text-green-400' :
                            player.avg_score >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {player.avg_score?.toFixed(1) || 0}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                          {player.accuracy?.toFixed(1) || 0}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 dark:text-green-400">
                          {player.perfect_scores || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                          {formatDuration(player.total_time_ms)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <span className="font-semibold text-purple-600 dark:text-purple-400">
                            {player.xp?.toLocaleString() || 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No players found matching your filters. Try adjusting your search criteria.
              </div>
            )}
            
            {/* Pagination */}
            {leaderboard && (
              <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {leaderboard.total === 0 ? 0 : (page - 1) * 20 + 1} to {leaderboard.total === 0 ? 0 : Math.min(page * 20, leaderboard.total)} of {leaderboard.total} players
                </span>
                <div className="ml-auto">
                  <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Player Detail View */
        <div className="space-y-6">
          {/* Back Button */}
          <button
            onClick={() => router.push('/analytics/players')}
            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
          >
            ← Back to Leaderboard
          </button>

          {isLoadingPlayer ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-500 dark:text-gray-400">Loading player data...</p>
            </div>
          ) : player ? (
            <>
              {/* Player Header */}
              <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {player.avatar_url && cleanSvgForDisplay(player.avatar_url) ? (
                      <img src={cleanSvgForDisplay(player.avatar_url)!} alt="" className="h-20 w-20 rounded-full" />
                    ) : (
                      <div className={`h-20 w-20 rounded-full ${getAvatarColor(player.user_id)} flex items-center justify-center text-white text-2xl font-semibold`}>
                        {getInitials(player.display_name)}
                      </div>
                    )}
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {player.display_name || 'Anonymous Player'}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Joined: {formatShortDate(player.joined_date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-center md:text-right">
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {player.xp?.toLocaleString() || 0} XP
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Experience</p>
                  </div>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Sessions</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{player.total_sessions || 0}</p>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Rounds</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{player.total_rounds?.toLocaleString() || 0}</p>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Average Score</p>
                  <p className={`text-2xl font-semibold ${
                    player.avg_score >= 80 ? 'text-green-600 dark:text-green-400' :
                    player.avg_score >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>{player.avg_score?.toFixed(1) || 0}%</p>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Accuracy</p>
                  <p className={`text-2xl font-semibold ${
                    player.accuracy >= 80 ? 'text-green-600 dark:text-green-400' :
                    player.accuracy >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>{player.accuracy?.toFixed(1) || 0}%</p>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Perfect Scores</p>
                  <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{player.perfect_scores || 0}</p>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Time Played</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatDuration(player.total_time_ms)}</p>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Game Breakdown */}
                <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance by Game</h3>
                  </div>
                  {player.game_breakdown?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Game</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sessions</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Score</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Perfect</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {player.game_breakdown.map((game: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                                {formatGameName(game.game_key)}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{game.sessions}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`font-semibold ${
                                  game.avg_score >= 80 ? 'text-green-600 dark:text-green-400' :
                                  game.avg_score >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                                  'text-red-600 dark:text-red-400'
                                }`}>
                                  {game.avg_score?.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{game.perfect_scores}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="p-6 text-center text-gray-500 dark:text-gray-400">No game data available</p>
                  )}
                </div>

                {/* Weaknesses */}
                <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Areas for Improvement</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Content this player struggles with most</p>
                  </div>
                  {player.weaknesses?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Content</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Misses</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Accuracy</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {player.weaknesses.map((weakness: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="px-4 py-3 text-gray-900 dark:text-white font-medium max-w-[200px] truncate" title={weakness.content}>
                                {weakness.content || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">
                                {weakness.misses}/{weakness.attempts}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`font-semibold ${
                                  weakness.accuracy >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
                                  'text-red-600 dark:text-red-400'
                                }`}>
                                  {weakness.accuracy?.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="p-6 text-center text-gray-500 dark:text-gray-400">No weakness data available - great job!</p>
                  )}
                </div>
              </div>

              {/* Recent Sessions */}
              <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Sessions</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Last 20 game sessions</p>
                </div>
                {player.recent_sessions?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Game</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Language</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Score</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Correct</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Wrong</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Duration</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Perfect</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {player.recent_sessions.map((session: any) => (
                          <tr key={session.session_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                              {formatDate(session.date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">
                              {formatGameName(session.game_key)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                              {session.language_name || 'Unknown'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span className={`font-semibold ${
                                session.score >= 90 ? 'text-green-600 dark:text-green-400' :
                                session.score >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
                                'text-red-600 dark:text-red-400'
                              }`}>
                                {session.score?.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-green-600 dark:text-green-400">
                              {session.correct}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-red-600 dark:text-red-400">
                              {session.wrong}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900 dark:text-white">
                              {formatDuration(session.duration_ms)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {session.is_perfect ? (
                                <span className="text-green-600 dark:text-green-400">⭐</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="p-6 text-center text-gray-500 dark:text-gray-400">No session data available</p>
                )}
              </div>

              {/* Daily Activity */}
              {player.daily_activity?.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Daily Activity</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sessions played per day (last 30 days)</p>
                  </div>
                  <div className="p-6">
                    <div className="flex gap-1 flex-wrap">
                      {player.daily_activity.slice(0, 30).map((day: any, idx: number) => (
                        <div
                          key={idx}
                          className={`w-8 h-8 rounded ${
                            day.sessions >= 5 ? 'bg-green-600' :
                            day.sessions >= 3 ? 'bg-green-500' :
                            day.sessions >= 1 ? 'bg-green-400' :
                            'bg-gray-200 dark:bg-gray-700'
                          }`}
                          title={`${day.date}: ${day.sessions} sessions, ${day.avg_score}% avg`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>Less</span>
                      <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="w-4 h-4 bg-green-400 rounded" />
                      <div className="w-4 h-4 bg-green-500 rounded" />
                      <div className="w-4 h-4 bg-green-600 rounded" />
                      <span>More</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              Player not found. They may have been deleted or the ID is invalid.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
