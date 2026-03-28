/**
 * BattleLogsTab - Battle list with search, filtering (including tag team), and pagination.
 *
 * Extracted from AdminPage.tsx. Manages its own battle data fetching, search,
 * league/battle-type filtering, pagination, and opens BattleDetailsModal on row click.
 *
 * Requirements: 2.7, 3.2
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../utils/apiClient';
import BattleDetailsModal from '../BattleDetailsModal';
import { BattleLogLegend } from './BattleLogLegend';
import { getBattleOutcome, getBattleHighlight } from './battleLogHelpers';
import type { Battle, BattleListResponse } from './types';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function BattleLogsTab() {
  /* ---------- Local state ---------- */
  const [battles, setBattles] = useState<Battle[]>([]);
  const [battlesPagination, setBattlesPagination] = useState<BattleListResponse['pagination'] | null>(null);
  const [battlesLoading, setBattlesLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [battleTypeFilter, setBattleTypeFilter] = useState('all');
  const [selectedBattleId, setSelectedBattleId] = useState<number | null>(null);
  const [showBattleModal, setShowBattleModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  /* ---------- Data fetching ---------- */

  const fetchBattles = useCallback(async (page: number = 1) => {
    setBattlesLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (searchQuery) params.search = searchQuery;
      if (leagueFilter !== 'all') params.leagueType = leagueFilter;
      if (battleTypeFilter !== 'all') params.battleType = battleTypeFilter;

      const response = await apiClient.get<BattleListResponse>('/api/admin/battles', { params });
      setBattles(response.data.battles);
      setBattlesPagination(response.data.pagination);
      setCurrentPage(page);
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to fetch battles';
      showMessage('error', msg);
    } finally {
      setBattlesLoading(false);
    }
  }, [searchQuery, leagueFilter, battleTypeFilter]);

  /* Auto-load battles on mount */
  useEffect(() => {
    fetchBattles(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchBattles(1);
  };

  const handleViewBattle = (battleId: number) => {
    setSelectedBattleId(battleId);
    setShowBattleModal(true);
  };

  /* ---------- Render ---------- */

  return (
    <div role="tabpanel" id="battles-panel" aria-labelledby="battles-tab" className="bg-surface rounded-lg p-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-4">
        <h2 className="text-2xl font-bold">Battle Logs &amp; Debugging</h2>
        <button
          onClick={() => fetchBattles(1)}
          disabled={battlesLoading}
          className="bg-primary hover:bg-blue-700 disabled:bg-surface-elevated px-4 py-2 rounded font-semibold transition-colors text-sm min-h-[44px]"
        >
          {battlesLoading ? 'Loading...' : 'Refresh Battles'}
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 p-4 rounded ${
            message.type === 'success' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Visual Indicators Legend */}
      <BattleLogLegend />

      {/* Search and Filter */}
      <div className="mb-4 flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by robot name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full bg-surface-elevated text-white px-4 py-2 rounded min-h-[44px]"
          />
        </div>
        <select
          value={leagueFilter}
          onChange={(e) => setLeagueFilter(e.target.value)}
          className="w-full lg:w-auto bg-surface-elevated text-white px-4 py-2 rounded min-h-[44px]"
        >
          <option value="all">All Leagues</option>
          <option value="bronze">Bronze</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
          <option value="platinum">Platinum</option>
          <option value="diamond">Diamond</option>
          <option value="champion">Champion</option>
        </select>
        <select
          value={battleTypeFilter}
          onChange={(e) => setBattleTypeFilter(e.target.value)}
          className="w-full lg:w-auto bg-surface-elevated text-white px-4 py-2 rounded min-h-[44px]"
        >
          <option value="all">All Battle Types</option>
          <option value="league">League Battles</option>
          <option value="tournament">Tournament Battles</option>
          <option value="tagteam">Tag Team Battles</option>
          <option value="koth">KotH Battles</option>
        </select>
        <button
          onClick={handleSearch}
          disabled={battlesLoading}
          className="w-full lg:w-auto bg-green-600 hover:bg-green-700 disabled:bg-surface-elevated px-6 py-2 rounded font-semibold transition-colors min-h-[44px]"
        >
          Search
        </button>
      </div>

      {/* Battle Table */}
      {battles.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="p-3 text-left">ID</th>
                  <th className="p-3 text-left">Format</th>
                  <th className="p-3 text-left">Robot 1</th>
                  <th className="p-3 text-left">Robot 2</th>
                  <th className="p-3 text-left">Winner</th>
                  <th className="p-3 text-left">League</th>
                  <th className="p-3 text-left">Duration</th>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {battles.map((battle) => {
                  const outcome = getBattleOutcome(battle);
                  const highlight = getBattleHighlight(battle);
                  const format = battle.battleType === 'koth' ? 'koth' : battle.battleFormat === '2v2' ? '2v2' : '1v1';

                  return (
                    <tr
                      key={battle.id}
                      className={`border-t border-white/10 hover:bg-surface-elevated cursor-pointer ${highlight}`}
                      onClick={() => handleViewBattle(battle.id)}
                    >
                      <td className="p-3">#{battle.id}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            format === 'koth'
                              ? 'bg-orange-600/30 text-orange-300'
                              : format === '2v2'
                              ? 'bg-purple-600/30 text-purple-300'
                              : 'bg-blue-600/30 text-blue-300'
                          }`}
                        >
                          {format === 'koth' ? '👑 KotH' : format}
                        </span>
                      </td>
                      <td className="p-3">
                        <Link
                          to={`/robots/${battle.robot1.id}`}
                          className="text-primary hover:underline"
                          aria-label={`View robot details for ${battle.robot1.name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {battle.robot1.name}
                        </Link>
                        <div className="text-xs text-secondary">
                          HP: {battle.robot1FinalHP} | ELO: {battle.robot1ELOBefore} →{' '}
                          {battle.robot1ELOAfter}
                        </div>
                      </td>
                      <td className="p-3">
                        <Link
                          to={`/robots/${battle.robot2.id}`}
                          className="text-purple-400 hover:underline"
                          aria-label={`View robot details for ${battle.robot2.name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {battle.robot2.name}
                        </Link>
                        <div className="text-xs text-secondary">
                          HP: {battle.robot2FinalHP} | ELO: {battle.robot2ELOBefore} →{' '}
                          {battle.robot2ELOAfter}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className={outcome.color}>
                            {outcome.icon} {battle.winnerName}
                          </span>
                          <span className="text-xs text-secondary mt-1">{outcome.label}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-surface-elevated rounded text-xs">
                          {battle.leagueType}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={battle.durationSeconds > 90 ? 'text-warning font-semibold' : ''}
                        >
                          {battle.durationSeconds}s
                        </span>
                      </td>
                      <td className="p-3 text-xs text-secondary">
                        {new Date(battle.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewBattle(battle.id);
                          }}
                          className="bg-primary hover:bg-blue-700 px-3 py-1 rounded text-xs font-semibold min-h-[44px]"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>


          {/* Pagination */}
          {battlesPagination && (
            <div className="mt-4 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
              <div className="text-sm text-secondary">
                Showing {battles.length} of {battlesPagination.totalBattles} battles (Page{' '}
                {battlesPagination.page} of {battlesPagination.totalPages})
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchBattles(currentPage - 1)}
                  disabled={currentPage === 1 || battlesLoading}
                  className="bg-surface-elevated hover:bg-surface disabled:bg-surface disabled:text-tertiary px-4 py-2 rounded font-semibold transition-colors min-h-[44px]"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchBattles(currentPage + 1)}
                  disabled={!battlesPagination.hasMore || battlesLoading}
                  className="bg-surface-elevated hover:bg-surface disabled:bg-surface disabled:text-tertiary px-4 py-2 rounded font-semibold transition-colors min-h-[44px]"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-secondary">
          {battlesLoading ? (
            <div>Loading battles...</div>
          ) : (
            <div>
              <p className="mb-2">No battles found.</p>
              <button
                onClick={() => fetchBattles(1)}
                className="bg-primary hover:bg-blue-700 px-4 py-2 rounded font-semibold min-h-[44px]"
              >
                Load Battles
              </button>
            </div>
          )}
        </div>
      )}

      {/* Battle Details Modal */}
      <BattleDetailsModal
        isOpen={showBattleModal}
        onClose={() => setShowBattleModal(false)}
        battleId={selectedBattleId}
      />
    </div>
  );
}
