/**
 * Infraction Modal
 * Allows referees to report infractions against teams
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  Shield, 
  Users, 
  User, 
  FileText,
  Send,
  Plus,
  Trash2
} from 'lucide-react';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { createInfraction } from '../../services/leagueService';
import type { Team, League, InfractionSeverity, InfractionCategory, Player } from '../../types';

interface InfractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId?: string;
  leagueId?: string;
  gameId?: string;
  onSuccess?: () => void;
}

export const InfractionModal: React.FC<InfractionModalProps> = ({
  isOpen,
  onClose,
  teamId: initialTeamId,
  leagueId: initialLeagueId,
  gameId,
  onSuccess,
}) => {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Form state
  const [selectedTeamId, setSelectedTeamId] = useState(initialTeamId || '');
  const [selectedLeagueId, setSelectedLeagueId] = useState(initialLeagueId || '');
  const [severity, setSeverity] = useState<InfractionSeverity>('minor');
  const [category, setCategory] = useState<InfractionCategory>('rule_violation');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // People involved
  const [involvedPlayers, setInvolvedPlayers] = useState<{ playerId: string; playerName: string; number?: number }[]>([]);
  const [involvedCoaches, setInvolvedCoaches] = useState<{ coachId: string; coachName: string }[]>([]);
  const [involvedParents, setInvolvedParents] = useState<string[]>([]);
  
  // Available teams/leagues
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  
  // Manual entry state
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newCoachName, setNewCoachName] = useState('');
  const [newParentName, setNewParentName] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, initialTeamId, initialLeagueId]);

  useEffect(() => {
    if (selectedTeamId) {
      loadTeamPlayers();
    }
  }, [selectedTeamId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load leagues the referee has access to
      const leaguesSnapshot = await getDocs(collection(db, 'leagues'));
      const leaguesList = leaguesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as League));
      setLeagues(leaguesList);
      
      // If a league is selected, load its teams
      if (initialLeagueId) {
        const teamsSnapshot = await getDocs(
          query(collection(db, 'teams'), where('leagueId', '==', initialLeagueId))
        );
        setTeams(teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
      } else if (initialTeamId) {
        // Load the team and get its league
        const teamDoc = await getDoc(doc(db, 'teams', initialTeamId));
        if (teamDoc.exists()) {
          const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
          setTeams([teamData]);
          if (teamData.leagueId) {
            setSelectedLeagueId(teamData.leagueId);
          }
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamPlayers = async () => {
    if (!selectedTeamId) return;
    try {
      const playersSnapshot = await getDocs(
        query(collection(db, 'players'), where('teamId', '==', selectedTeamId))
      );
      setPlayers(playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
    } catch (err) {
      console.error('Error loading players:', err);
    }
  };

  const handleLeagueChange = async (leagueId: string) => {
    setSelectedLeagueId(leagueId);
    setSelectedTeamId('');
    
    if (leagueId) {
      const teamsSnapshot = await getDocs(
        query(collection(db, 'teams'), where('leagueId', '==', leagueId))
      );
      setTeams(teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
    } else {
      setTeams([]);
    }
  };

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    setInvolvedPlayers([...involvedPlayers, {
      playerId: `manual-${Date.now()}`,
      playerName: newPlayerName.trim(),
      number: newPlayerNumber ? parseInt(newPlayerNumber) : undefined,
    }]);
    setNewPlayerName('');
    setNewPlayerNumber('');
  };

  const handleAddCoach = () => {
    if (!newCoachName.trim()) return;
    setInvolvedCoaches([...involvedCoaches, {
      coachId: `manual-${Date.now()}`,
      coachName: newCoachName.trim(),
    }]);
    setNewCoachName('');
  };

  const handleAddParent = () => {
    if (!newParentName.trim()) return;
    setInvolvedParents([...involvedParents, newParentName.trim()]);
    setNewParentName('');
  };

  const handleSubmit = async () => {
    if (!user?.uid || !selectedTeamId || !selectedLeagueId || !title.trim() || !description.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const selectedTeam = teams.find(t => t.id === selectedTeamId);
      const selectedLeague = leagues.find(l => l.id === selectedLeagueId);

      await createInfraction({
        teamId: selectedTeamId,
        teamName: selectedTeam?.name,
        leagueId: selectedLeagueId,
        leagueName: selectedLeague?.name,
        reportedBy: user.uid,
        reportedByName: userData?.name || 'Unknown Referee',
        gameId: gameId,
        severity,
        category,
        title: title.trim(),
        description: description.trim(),
        involvedPlayers: involvedPlayers.length > 0 ? involvedPlayers : undefined,
        involvedCoaches: involvedCoaches.length > 0 ? involvedCoaches : undefined,
        involvedParents: involvedParents.length > 0 ? involvedParents : undefined,
        status: 'submitted',
        createdAt: new Date(),
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error submitting infraction:', err);
      setError('Failed to submit infraction. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const severityColors = {
    minor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    major: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    severe: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const categoryLabels: Record<InfractionCategory, string> = {
    unsportsmanlike: 'Unsportsmanlike Conduct',
    rule_violation: 'Rule Violation',
    safety: 'Safety Concern',
    eligibility: 'Eligibility Issue',
    equipment: 'Equipment Violation',
    administrative: 'Administrative Issue',
    other: 'Other',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20 text-red-400">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Report Infraction</h2>
              <p className="text-xs text-slate-400">Document rule violations or conduct issues</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-slate-300 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : (
            <>
              {/* League & Team Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">League *</label>
                  <select
                    value={selectedLeagueId}
                    onChange={(e) => handleLeagueChange(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select League</option>
                    {leagues.map((league) => (
                      <option key={league.id} value={league.id}>{league.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Team *</label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={!selectedLeagueId}
                  >
                    <option value="">Select Team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Severity Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Severity *</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['minor', 'moderate', 'major', 'severe'] as InfractionSeverity[]).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setSeverity(sev)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium capitalize transition-all ${
                        severity === sev 
                          ? severityColors[sev] + ' ring-2 ring-offset-1 ring-offset-zinc-900' 
                          : 'bg-zinc-800 border-zinc-700 text-slate-400 hover:border-zinc-600'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as InfractionCategory)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Brief description of the infraction"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  placeholder="Provide details about what happened, when, and any relevant context..."
                />
              </div>

              {/* People Involved */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Users size={16} /> People Involved (Optional)
                </h3>

                {/* Players */}
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-400">Players</span>
                  </div>
                  
                  {involvedPlayers.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {involvedPlayers.map((player, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-zinc-700/50 px-3 py-2 rounded-lg">
                          <span className="text-white text-sm">
                            {player.number && <span className="text-slate-400">#{player.number}</span>} {player.playerName}
                          </span>
                          <button
                            onClick={() => setInvolvedPlayers(involvedPlayers.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      placeholder="Player name"
                      className="flex-1 bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-1.5 text-sm text-white"
                    />
                    <input
                      type="text"
                      value={newPlayerNumber}
                      onChange={(e) => setNewPlayerNumber(e.target.value)}
                      placeholder="#"
                      className="w-16 bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-1.5 text-sm text-white"
                    />
                    <button
                      onClick={handleAddPlayer}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Coaches */}
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-400">Coaches</span>
                  </div>
                  
                  {involvedCoaches.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {involvedCoaches.map((coach, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-zinc-700/50 px-3 py-2 rounded-lg">
                          <span className="text-white text-sm">{coach.coachName}</span>
                          <button
                            onClick={() => setInvolvedCoaches(involvedCoaches.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCoachName}
                      onChange={(e) => setNewCoachName(e.target.value)}
                      placeholder="Coach name"
                      className="flex-1 bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-1.5 text-sm text-white"
                    />
                    <button
                      onClick={handleAddCoach}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Parents */}
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-400">Parents/Spectators</span>
                  </div>
                  
                  {involvedParents.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {involvedParents.map((parent, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-zinc-700/50 px-3 py-2 rounded-lg">
                          <span className="text-white text-sm">{parent}</span>
                          <button
                            onClick={() => setInvolvedParents(involvedParents.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newParentName}
                      onChange={(e) => setNewParentName(e.target.value)}
                      placeholder="Parent/spectator name or description"
                      className="flex-1 bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-1.5 text-sm text-white"
                    />
                    <button
                      onClick={handleAddParent}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10 bg-zinc-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedTeamId || !selectedLeagueId || !title.trim() || !description.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send size={16} />
                Submit Infraction
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfractionModal;
