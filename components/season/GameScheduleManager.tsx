// =============================================================================
// GAME SCHEDULE MANAGER - Main view for managing season games
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Trophy,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  X,
  Loader2,
  CalendarDays,
  Flame,
  Target,
} from 'lucide-react';
import { Game, GameFormData, SeasonScheduleSummary } from '../../types/game';
import { 
  getSeasonGames, 
  createGame, 
  updateGame,
  deleteGame,
  enterGameResult,
  getSeasonScheduleSummary,
  getTeamOpponents
} from '../../services/gameService';
import { AddGameModal } from './AddGameModal';
import { GameCard } from './GameCard';
import { useAuth } from '../../contexts/AuthContext';

interface GameScheduleManagerProps {
  teamId: string;
  teamName: string;
  seasonId: string;
  seasonName: string;
  homeField?: string;
  onNavigateToDesignStudio?: (gameId: string) => void;
  onNavigateToStats?: (gameId: string) => void;
}

export function GameScheduleManager({
  teamId,
  teamName,
  seasonId,
  seasonName,
  homeField = '',
  onNavigateToDesignStudio,
  onNavigateToStats,
}: GameScheduleManagerProps) {
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [summary, setSummary] = useState<SeasonScheduleSummary | null>(null);
  const [opponents, setOpponents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPlayoffModal, setShowPlayoffModal] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [showScoreModal, setShowScoreModal] = useState<Game | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // View states
  const [showPlayoffs, setShowPlayoffs] = useState(true);
  const [view, setView] = useState<'all' | 'upcoming' | 'completed'>('all');

  // Score entry state
  const [ourScore, setOurScore] = useState('');
  const [opponentScore, setOpponentScore] = useState('');
  const [savingScore, setSavingScore] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, [teamId, seasonId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [gamesData, summaryData, opponentsData] = await Promise.all([
        getSeasonGames(teamId, seasonId),
        getSeasonScheduleSummary(teamId, seasonId),
        getTeamOpponents(teamId),
      ]);

      setGames(gamesData);
      setSummary(summaryData);
      setOpponents(opponentsData.map(o => o.name));
    } catch (err) {
      console.error('Error loading schedule:', err);
      setError('Failed to load schedule. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGame = async (formData: GameFormData) => {
    if (!user) return;
    await createGame(teamId, seasonId, formData, user.uid);
    await loadData();
  };

  const handleEditGame = async (formData: GameFormData) => {
    if (!editingGame) return;
    await updateGame(teamId, editingGame.id, {
      ...formData,
      updatedAt: undefined, // Will be set by service
    });
    setEditingGame(null);
    await loadData();
  };

  const handleDeleteGame = async (gameId: string) => {
    await deleteGame(teamId, gameId);
    setShowDeleteConfirm(null);
    await loadData();
  };

  const handleEnterScore = async () => {
    if (!showScoreModal) return;
    
    setSavingScore(true);
    try {
      await enterGameResult(
        teamId,
        showScoreModal.id,
        parseInt(ourScore) || 0,
        parseInt(opponentScore) || 0
      );
      setShowScoreModal(null);
      setOurScore('');
      setOpponentScore('');
      await loadData();
    } catch (err) {
      console.error('Error saving score:', err);
    } finally {
      setSavingScore(false);
    }
  };

  // Filter games based on view
  const regularGames = games.filter(g => !g.isPlayoff);
  const playoffGames = games.filter(g => g.isPlayoff);
  
  const filteredGames = regularGames.filter(g => {
    if (view === 'upcoming') return g.status === 'scheduled';
    if (view === 'completed') return g.status === 'completed';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-400">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <CalendarDays className="w-7 h-7 text-orange-400" />
            {seasonName} Schedule
          </h2>
          <p className="text-slate-400 mt-1">
            {games.length === 0 
              ? 'No games scheduled yet' 
              : `${games.length} game${games.length !== 1 ? 's' : ''} scheduled`
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Game
          </button>
        </div>
      </div>

      {/* Season Summary Stats */}
      {summary && games.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Target className="w-4 h-4" />
              Record
            </div>
            <p className="text-2xl font-bold text-white">
              {summary.wins}-{summary.losses}{summary.ties > 0 ? `-${summary.ties}` : ''}
            </p>
            {summary.winPercentage > 0 && (
              <p className="text-sm text-slate-500">{summary.winPercentage}% win rate</p>
            )}
          </div>

          <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <BarChart3 className="w-4 h-4" />
              Points
            </div>
            <p className="text-2xl font-bold text-white">
              {summary.pointsFor}
              <span className="text-slate-500 text-lg"> - </span>
              {summary.pointsAgainst}
            </p>
            <p className="text-sm text-slate-500">
              {summary.pointsFor > summary.pointsAgainst ? '+' : ''}
              {summary.pointsFor - summary.pointsAgainst} differential
            </p>
          </div>

          <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Flame className="w-4 h-4" />
              Streak
            </div>
            <p className={`text-2xl font-bold ${
              summary.currentStreak.type === 'W' ? 'text-green-400' :
              summary.currentStreak.type === 'L' ? 'text-red-400' : 'text-slate-400'
            }`}>
              {summary.currentStreak.count > 0 
                ? `${summary.currentStreak.type}${summary.currentStreak.count}`
                : '—'
              }
            </p>
            <p className="text-sm text-slate-500">
              {summary.currentStreak.count > 0 
                ? `${summary.currentStreak.count} game${summary.currentStreak.count !== 1 ? 's' : ''}`
                : 'No games yet'
              }
            </p>
          </div>

          <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Calendar className="w-4 h-4" />
              Games Left
            </div>
            <p className="text-2xl font-bold text-white">
              {summary.gamesRemaining}
            </p>
            <p className="text-sm text-slate-500">
              of {summary.totalGames} total
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {games.length === 0 && (
        <div className="bg-zinc-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-12 text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center mb-6">
            <Calendar className="w-10 h-10 text-orange-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Games Scheduled</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Add your team's game schedule to track results, enable ticket sales, 
            and keep everyone informed about upcoming matchups.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all"
          >
            <Plus className="w-5 h-5" />
            Add First Game
          </button>
        </div>
      )}

      {/* View Filters */}
      {games.length > 0 && (
        <div className="flex items-center gap-2">
          {(['all', 'upcoming', 'completed'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === v
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-zinc-800/50 text-slate-400 hover:text-white'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
              {v === 'upcoming' && ` (${regularGames.filter(g => g.status === 'scheduled').length})`}
              {v === 'completed' && ` (${regularGames.filter(g => g.status === 'completed').length})`}
            </button>
          ))}
        </div>
      )}

      {/* Games List */}
      {filteredGames.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-400" />
            Regular Season
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredGames.map(game => (
              <GameCard
                key={game.id}
                game={game}
                onEdit={(g) => setEditingGame(g)}
                onDelete={(id) => setShowDeleteConfirm(id)}
                onEnterScore={(g) => {
                  setShowScoreModal(g);
                  setOurScore(g.ourScore?.toString() || '');
                  setOpponentScore(g.opponentScore?.toString() || '');
                }}
                onEnterStats={(g) => onNavigateToStats?.(g.id)}
                onDesignTicket={(g) => onNavigateToDesignStudio?.(g.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Playoff Section */}
      {(playoffGames.length > 0 || regularGames.some(g => g.status === 'completed')) && (
        <div className="space-y-4">
          <button
            onClick={() => setShowPlayoffs(!showPlayoffs)}
            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl hover:border-yellow-500/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-white">Playoffs</h3>
                <p className="text-sm text-slate-400">
                  {playoffGames.length > 0 
                    ? `${playoffGames.length} playoff game${playoffGames.length !== 1 ? 's' : ''}`
                    : 'Made the playoffs? Add your playoff schedule!'
                  }
                </p>
              </div>
            </div>
            {showPlayoffs ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {showPlayoffs && (
            <div className="pl-4 border-l-2 border-yellow-500/30 space-y-4">
              {playoffGames.length === 0 ? (
                <div className="bg-zinc-800/50 rounded-xl p-6 text-center">
                  <p className="text-slate-400 mb-4">
                    If your team made the playoffs, add your playoff games here!
                  </p>
                  <button
                    onClick={() => setShowPlayoffModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Playoff Game
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {playoffGames.map(game => (
                      <GameCard
                        key={game.id}
                        game={game}
                        onEdit={(g) => setEditingGame(g)}
                        onDelete={(id) => setShowDeleteConfirm(id)}
                        onEnterScore={(g) => {
                          setShowScoreModal(g);
                          setOurScore(g.ourScore?.toString() || '');
                          setOpponentScore(g.opponentScore?.toString() || '');
                        }}
                        onEnterStats={(g) => onNavigateToStats?.(g.id)}
                        onDesignTicket={(g) => onNavigateToDesignStudio?.(g.id)}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setShowPlayoffModal(true)}
                    className="flex items-center gap-2 px-4 py-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another Playoff Game
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Game Modal */}
      <AddGameModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddGame}
        teamName={teamName}
        homeField={homeField}
        existingOpponents={opponents}
        isPlayoffMode={false}
      />

      {/* Add Playoff Game Modal */}
      <AddGameModal
        isOpen={showPlayoffModal}
        onClose={() => setShowPlayoffModal(false)}
        onSubmit={handleAddGame}
        teamName={teamName}
        homeField={homeField}
        existingOpponents={opponents}
        isPlayoffMode={true}
      />

      {/* Edit Game Modal */}
      {editingGame && (
        <AddGameModal
          isOpen={true}
          onClose={() => setEditingGame(null)}
          onSubmit={handleEditGame}
          teamName={teamName}
          homeField={homeField}
          existingOpponents={opponents}
          isPlayoffMode={editingGame.isPlayoff}
          editGame={{
            opponent: editingGame.opponent,
            opponentLogoUrl: editingGame.opponentLogoUrl,
            date: editingGame.date,
            time: editingGame.time,
            location: editingGame.location,
            address: editingGame.address,
            isHome: editingGame.isHome,
            isPlayoff: editingGame.isPlayoff,
            playoffRound: editingGame.playoffRound,
            tags: editingGame.tags,
            notes: editingGame.notes,
            ticketsEnabled: editingGame.ticketsEnabled,
            ticketPrice: editingGame.ticketPrice,
          }}
        />
      )}

      {/* Enter Score Modal */}
      {showScoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowScoreModal(null)}
          />
          <div className="relative w-full max-w-md bg-zinc-900/95 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h3 className="text-xl font-bold text-white">Enter Final Score</h3>
                <p className="text-sm text-slate-400">
                  {showScoreModal.isHome ? 'vs' : '@'} {showScoreModal.opponent}
                </p>
              </div>
              <button
                onClick={() => setShowScoreModal(null)}
                className="p-2 rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <label className="block text-sm text-slate-400 mb-2">{teamName}</label>
                  <input
                    type="number"
                    min="0"
                    value={ourScore}
                    onChange={(e) => setOurScore(e.target.value)}
                    className="w-full text-center text-4xl font-bold bg-zinc-800/50 border border-white/10 rounded-xl py-4 text-white focus:outline-none focus:border-orange-500/50"
                    placeholder="0"
                  />
                </div>
                <div className="text-center">
                  <label className="block text-sm text-slate-400 mb-2">{showScoreModal.opponent}</label>
                  <input
                    type="number"
                    min="0"
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(e.target.value)}
                    className="w-full text-center text-4xl font-bold bg-zinc-800/50 border border-white/10 rounded-xl py-4 text-white focus:outline-none focus:border-orange-500/50"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10 bg-black/20">
              <button
                onClick={() => setShowScoreModal(null)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEnterScore}
                disabled={savingScore}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl disabled:opacity-50"
              >
                {savingScore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Save Score
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(null)}
          />
          <div className="relative w-full max-w-sm bg-zinc-900/95 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl p-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Delete Game?</h3>
              <p className="text-slate-400 mb-6">
                This will permanently delete this game and any associated data. This cannot be undone.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteGame(showDeleteConfirm)}
                  className="px-6 py-2.5 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors"
                >
                  Delete Game
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameScheduleManager;
