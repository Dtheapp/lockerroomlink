/**
 * Commissioner Schedule Component
 * Allows commissioners to add/manage games for a season
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { db } from '../../services/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { 
  ChevronLeft, 
  Calendar, 
  Plus, 
  Clock, 
  MapPin, 
  Users, 
  Loader2, 
  Edit2, 
  Trash2, 
  X, 
  Save,
  Trophy
} from 'lucide-react';
import { toastSuccess, toastError } from '../../services/toast';
import type { Team, ProgramSeason } from '../../types';

interface Game {
  id: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  date: string;
  time: string;
  location: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  homeScore?: number;
  awayScore?: number;
  ageGroup?: string;
  createdAt?: any;
  updatedAt?: any;
}

export default function CommissionerSchedule() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { userData, programData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [season, setSeason] = useState<ProgramSeason | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGame, setShowAddGame] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    homeTeamId: '',
    awayTeamId: '',
    date: '',
    time: '',
    location: '',
    ageGroup: ''
  });

  useEffect(() => {
    if (seasonId && programData?.id) {
      loadData();
    }
  }, [seasonId, programData?.id]);

  const loadData = async () => {
    if (!seasonId || !programData?.id) return;

    setLoading(true);
    try {
      // Load season
      const seasonDoc = await getDoc(doc(db, 'programs', programData.id, 'seasons', seasonId));
      if (!seasonDoc.exists()) {
        toastError('Season not found');
        navigate('/commissioner');
        return;
      }
      setSeason({ id: seasonDoc.id, ...seasonDoc.data() } as ProgramSeason);

      // Load teams for this program
      const teamsQuery = query(
        collection(db, 'teams'),
        where('programId', '==', programData.id)
      );
      const teamsSnap = await getDocs(teamsQuery);
      const teamsData = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(teamsData);

      // Load games for this season
      const gamesQuery = query(
        collection(db, 'programs', programData.id, 'seasons', seasonId, 'games'),
        orderBy('date', 'asc')
      );
      const gamesSnap = await getDocs(gamesQuery);
      const gamesData = gamesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      setGames(gamesData);

    } catch (error) {
      console.error('Error loading schedule data:', error);
      toastError('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGame = async () => {
    if (!formData.homeTeamId || !formData.awayTeamId || !formData.date || !formData.time) {
      toastError('Please fill in all required fields');
      return;
    }

    if (formData.homeTeamId === formData.awayTeamId) {
      toastError('Home and away teams must be different');
      return;
    }

    setSaving(true);
    try {
      const homeTeam = teams.find(t => t.id === formData.homeTeamId);
      const awayTeam = teams.find(t => t.id === formData.awayTeamId);

      const gameData = {
        homeTeamId: formData.homeTeamId,
        homeTeamName: homeTeam?.name || homeTeam?.teamName || 'Unknown',
        awayTeamId: formData.awayTeamId,
        awayTeamName: awayTeam?.name || awayTeam?.teamName || 'Unknown',
        date: formData.date,
        time: formData.time,
        location: formData.location || programData?.defaultLocation || 'TBD',
        ageGroup: formData.ageGroup || homeTeam?.ageGroup || '',
        status: 'scheduled' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'programs', programData!.id, 'seasons', seasonId!, 'games'), gameData);
      
      toastSuccess('Game added successfully!');
      setShowAddGame(false);
      setFormData({ homeTeamId: '', awayTeamId: '', date: '', time: '', location: '', ageGroup: '' });
      loadData();
    } catch (error) {
      console.error('Error adding game:', error);
      toastError('Failed to add game');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateGame = async () => {
    if (!editingGame) return;

    setSaving(true);
    try {
      const homeTeam = teams.find(t => t.id === formData.homeTeamId);
      const awayTeam = teams.find(t => t.id === formData.awayTeamId);

      await updateDoc(doc(db, 'programs', programData!.id, 'seasons', seasonId!, 'games', editingGame.id), {
        homeTeamId: formData.homeTeamId,
        homeTeamName: homeTeam?.name || homeTeam?.teamName || 'Unknown',
        awayTeamId: formData.awayTeamId,
        awayTeamName: awayTeam?.name || awayTeam?.teamName || 'Unknown',
        date: formData.date,
        time: formData.time,
        location: formData.location,
        ageGroup: formData.ageGroup,
        updatedAt: serverTimestamp()
      });

      toastSuccess('Game updated successfully!');
      setEditingGame(null);
      setFormData({ homeTeamId: '', awayTeamId: '', date: '', time: '', location: '', ageGroup: '' });
      loadData();
    } catch (error) {
      console.error('Error updating game:', error);
      toastError('Failed to update game');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!confirm('Are you sure you want to delete this game?')) return;

    try {
      await deleteDoc(doc(db, 'programs', programData!.id, 'seasons', seasonId!, 'games', gameId));
      toastSuccess('Game deleted');
      setGames(prev => prev.filter(g => g.id !== gameId));
    } catch (error) {
      console.error('Error deleting game:', error);
      toastError('Failed to delete game');
    }
  };

  const startEdit = (game: Game) => {
    setEditingGame(game);
    setFormData({
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      date: game.date,
      time: game.time,
      location: game.location || '',
      ageGroup: game.ageGroup || ''
    });
  };

  // Get unique age groups from teams
  const ageGroups = [...new Set(teams.map(t => t.ageGroup).filter(Boolean))];

  // Filter games by age group
  const filteredGames = filterAgeGroup === 'all' 
    ? games 
    : games.filter(g => g.ageGroup === filterAgeGroup);

  // Filter teams by selected age group for the form
  const filteredTeams = formData.ageGroup 
    ? teams.filter(t => t.ageGroup === formData.ageGroup)
    : teams;

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 ${theme === 'dark' ? 'bg-gray-900/95 border-gray-800' : 'bg-white/95 border-gray-200'} border-b backdrop-blur-sm`}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/commissioner')}
                className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {season?.name || 'Season'} Schedule
                </h1>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {games.length} games scheduled
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddGame(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Game
            </button>
          </div>

          {/* Age Group Filter */}
          {ageGroups.length > 1 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setFilterAgeGroup('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                  filterAgeGroup === 'all'
                    ? 'bg-purple-600 text-white'
                    : theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                }`}
              >
                All Age Groups
              </button>
              {ageGroups.map(ag => (
                <button
                  key={ag}
                  onClick={() => setFilterAgeGroup(ag!)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                    filterAgeGroup === ag
                      ? 'bg-purple-600 text-white'
                      : theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {ag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Games List */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {filteredGames.length === 0 ? (
          <div className={`text-center py-12 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <Calendar className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
            <h3 className={`text-lg font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              No Games Scheduled
            </h3>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Add your first game to get started
            </p>
            <button
              onClick={() => setShowAddGame(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium"
            >
              Add Game
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGames.map(game => (
              <div
                key={game.id}
                className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                        {game.ageGroup || 'No Age Group'}
                      </span>
                      <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                        {game.status === 'completed' ? '✓ Completed' : game.status === 'cancelled' ? '✗ Cancelled' : ''}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {game.homeTeamName}
                        </p>
                        {game.status === 'completed' && (
                          <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                            {game.homeScore ?? '-'}
                          </p>
                        )}
                      </div>
                      <span className={`text-lg font-bold ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>vs</span>
                      <div className="text-center">
                        <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {game.awayTeamName}
                        </p>
                        {game.status === 'completed' && (
                          <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                            {game.awayScore ?? '-'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className={`flex items-center gap-4 mt-3 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(game.date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {game.time}
                      </span>
                      {game.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {game.location}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(game)}
                      className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGame(game.id)}
                      className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Game Modal */}
      {(showAddGame || editingGame) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
            <div className={`px-4 py-3 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
              <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {editingGame ? 'Edit Game' : 'Add New Game'}
              </h3>
              <button
                onClick={() => {
                  setShowAddGame(false);
                  setEditingGame(null);
                  setFormData({ homeTeamId: '', awayTeamId: '', date: '', time: '', location: '', ageGroup: '' });
                }}
                className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Age Group */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Age Group *
                </label>
                <select
                  value={formData.ageGroup}
                  onChange={(e) => setFormData({ ...formData, ageGroup: e.target.value, homeTeamId: '', awayTeamId: '' })}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-gray-800 border-gray-700 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">Select age group</option>
                  {ageGroups.map(ag => (
                    <option key={ag} value={ag!}>{ag}</option>
                  ))}
                </select>
              </div>

              {/* Home Team */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Home Team *
                </label>
                <select
                  value={formData.homeTeamId}
                  onChange={(e) => setFormData({ ...formData, homeTeamId: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-gray-800 border-gray-700 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  disabled={!formData.ageGroup}
                >
                  <option value="">Select home team</option>
                  {filteredTeams.map(team => (
                    <option key={team.id} value={team.id}>{team.name || team.teamName}</option>
                  ))}
                </select>
              </div>

              {/* Away Team */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Away Team *
                </label>
                <select
                  value={formData.awayTeamId}
                  onChange={(e) => setFormData({ ...formData, awayTeamId: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-gray-800 border-gray-700 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  disabled={!formData.ageGroup}
                >
                  <option value="">Select away team</option>
                  {filteredTeams.filter(t => t.id !== formData.homeTeamId).map(team => (
                    <option key={team.id} value={team.id}>{team.name || team.teamName}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-gray-800 border-gray-700 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              {/* Time */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Time *
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-gray-800 border-gray-700 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              {/* Location */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Main Field, Stadium A"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>
            </div>

            <div className={`px-4 py-3 border-t flex gap-3 ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
              <button
                onClick={() => {
                  setShowAddGame(false);
                  setEditingGame(null);
                  setFormData({ homeTeamId: '', awayTeamId: '', date: '', time: '', location: '', ageGroup: '' });
                }}
                className={`flex-1 py-2.5 rounded-lg font-medium ${
                  theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={editingGame ? handleUpdateGame : handleAddGame}
                disabled={saving}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingGame ? 'Update' : 'Add Game'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
