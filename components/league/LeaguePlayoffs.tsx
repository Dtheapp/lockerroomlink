import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { PlayoffBracket, LeagueSeason, Team } from '../../types';
import { ChevronLeft, Trophy, Plus, Users, Loader2, AlertCircle, X, Crown, Medal, Award } from 'lucide-react';

interface BracketMatch {
  id: string;
  round: number;
  position: number;
  team1Id?: string;
  team2Id?: string;
  team1Score?: number;
  team2Score?: number;
  winnerId?: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed';
  dateTime?: any;
}

export default function LeaguePlayoffs() {
  const { leagueData, user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [bracket, setBracket] = useState<PlayoffBracket | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateBracket, setShowCreateBracket] = useState(false);

  useEffect(() => {
    loadData();
  }, [leagueData]);

  useEffect(() => {
    if (selectedSeasonId) {
      loadBracket(selectedSeasonId);
    }
  }, [selectedSeasonId]);

  const loadData = async () => {
    if (!leagueData) return;

    try {
      // Load seasons
      const seasonsQuery = query(
        collection(db, 'leagueSeasons'),
        where('leagueId', '==', leagueData.id)
      );
      const seasonsSnap = await getDocs(seasonsQuery);
      const seasonsList = seasonsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeagueSeason[];
      
      setSeasons(seasonsList);
      
      // Auto-select active season
      const activeSeason = seasonsList.find(s => s.status === 'active') || seasonsList[0];
      if (activeSeason) {
        setSelectedSeasonId(activeSeason.id);
      }

      // Load teams
      const programsQuery = query(
        collection(db, 'programs'),
        where('leagueId', '==', leagueData.id)
      );
      const programsSnap = await getDocs(programsQuery);
      const programIds = programsSnap.docs.map(d => d.id);

      if (programIds.length > 0) {
        const teamsQuery = query(
          collection(db, 'teams'),
          where('programId', 'in', programIds.slice(0, 10))
        );
        const teamsSnap = await getDocs(teamsQuery);
        setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBracket = async (seasonId: string) => {
    try {
      const bracketQuery = query(
        collection(db, 'playoffBrackets'),
        where('seasonId', '==', seasonId)
      );
      const bracketSnap = await getDocs(bracketQuery);
      
      if (!bracketSnap.empty) {
        const bracketData = bracketSnap.docs[0];
        setBracket({ id: bracketData.id, ...bracketData.data() } as PlayoffBracket);
      } else {
        setBracket(null);
      }
    } catch (error) {
      console.error('Error loading bracket:', error);
    }
  };

  if (!leagueData) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <AlertCircle className="w-16 h-16 text-red-500" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${
      theme === 'dark' ? 'bg-zinc-900 text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Header */}
      <div className={`border-b ${
        theme === 'dark' 
          ? 'bg-black/40 border-white/10' 
          : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/league" className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
              }`}>
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className={`text-xl font-bold flex items-center gap-2 ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Playoffs
                </h1>
                <p className={theme === 'dark' ? 'text-sm text-slate-400' : 'text-sm text-slate-600'}>{leagueData.name}</p>
              </div>
            </div>
            
            {/* Season Selector */}
            <div className="flex items-center gap-4">
              <select
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                className={`rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                  theme === 'dark'
                    ? 'bg-white/5 border border-white/10 text-white'
                    : 'bg-white border border-slate-200 text-slate-900'
                }`}
              >
                {seasons.map(season => (
                  <option key={season.id} value={season.id}>{season.name}</option>
                ))}
              </select>
              
              {!bracket && selectedSeasonId && (
                <button
                  onClick={() => setShowCreateBracket(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 px-4 py-2 rounded-xl font-medium text-white transition-all shadow-lg shadow-yellow-500/25"
                >
                  <Plus className="w-5 h-5" />
                  Create Bracket
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {seasons.length === 0 ? (
          <div className={`text-center py-12 rounded-2xl border ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10' 
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <Trophy className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
            }`} />
            <h3 className={`text-lg font-medium ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>No Seasons Available</h3>
            <p className={`mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Create a season first to set up playoffs</p>
            <Link
              to="/league/seasons"
              className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 px-4 py-2 rounded-xl font-medium text-white transition-all"
            >
              Go to Seasons
            </Link>
          </div>
        ) : !bracket ? (
          <div className={`text-center py-12 rounded-2xl border ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10' 
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <Trophy className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
            }`} />
            <h3 className={`text-lg font-medium ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>No Playoff Bracket</h3>
            <p className={`mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Create a playoff bracket for this season</p>
            <button
              onClick={() => setShowCreateBracket(true)}
              className="mt-4 flex items-center gap-2 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 px-4 py-2 rounded-xl font-medium text-white mx-auto transition-all"
            >
              <Plus className="w-5 h-5" />
              Create Bracket
            </button>
          </div>
        ) : (
          <BracketVisualization bracket={bracket} teams={teams} onUpdate={() => loadBracket(selectedSeasonId)} theme={theme} />
        )}
      </div>

      {/* Create Bracket Modal */}
      {showCreateBracket && selectedSeasonId && (
        <CreateBracketModal
          seasonId={selectedSeasonId}
          leagueId={leagueData.id}
          teams={teams}
          onClose={() => setShowCreateBracket(false)}
          onCreated={() => {
            setShowCreateBracket(false);
            loadBracket(selectedSeasonId);
          }}
          theme={theme}
        />
      )}
    </div>
  );
}

// Bracket Visualization Component
interface BracketVisualizationProps {
  bracket: PlayoffBracket;
  teams: Team[];
  onUpdate: () => void;
  theme: string;
}

function BracketVisualization({ bracket, teams, onUpdate, theme }: BracketVisualizationProps) {
  const matches = (bracket.matches || []) as unknown as BracketMatch[];
  const rounds = Math.max(...matches.map(m => m.round), 0);
  
  const getTeamName = (teamId?: string) => {
    if (!teamId) return 'TBD';
    return teams.find(t => t.id === teamId)?.name || 'Unknown';
  };

  const getRoundName = (round: number, totalRounds: number) => {
    const roundFromEnd = totalRounds - round + 1;
    if (roundFromEnd === 1) return 'Finals';
    if (roundFromEnd === 2) return 'Semi-Finals';
    if (roundFromEnd === 3) return 'Quarter-Finals';
    return `Round ${round}`;
  };

  // Group matches by round
  const matchesByRound: Record<number, BracketMatch[]> = {};
  matches.forEach(match => {
    if (!matchesByRound[match.round]) matchesByRound[match.round] = [];
    matchesByRound[match.round].push(match);
  });

  // Sort matches within each round by position
  Object.values(matchesByRound).forEach(roundMatches => {
    roundMatches.sort((a, b) => a.position - b.position);
  });

  if (matches.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className={`w-16 h-16 mx-auto mb-4 ${
          theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
        }`} />
        <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Bracket has no matches configured</p>
      </div>
    );
  }

  // Find winner
  const finalMatch = matches.find(m => m.round === rounds);
  const winner = finalMatch?.winnerId ? teams.find(t => t.id === finalMatch.winnerId) : null;

  return (
    <div className="space-y-6">
      {/* Champion Banner */}
      {winner && (
        <div className="bg-gradient-to-r from-yellow-600/20 to-yellow-500/20 border border-yellow-500/30 rounded-2xl p-6 text-center">
          <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-yellow-400">Champion</h2>
          <p className={`text-2xl font-bold mt-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>{winner.name}</p>
        </div>
      )}

      {/* Bracket Grid */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-8 min-w-max">
          {Array.from({ length: rounds }, (_, i) => i + 1).map(round => (
            <div key={round} className="flex flex-col gap-4">
              <h3 className={`text-center text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                {getRoundName(round, rounds)}
              </h3>
              <div 
                className="flex flex-col gap-4 justify-around"
                style={{ minHeight: `${Math.pow(2, rounds - round) * 120}px` }}
              >
                {(matchesByRound[round] || []).map((match) => (
                  <MatchCard 
                    key={match.id} 
                    match={match} 
                    teams={teams}
                    isFinal={round === rounds}
                    onUpdate={onUpdate}
                    theme={theme}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className={`flex items-center gap-6 text-sm justify-center ${
        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
      }`}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Winner</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span>Pending</span>
        </div>
      </div>
    </div>
  );
}

// Match Card Component
interface MatchCardProps {
  match: BracketMatch;
  teams: Team[];
  isFinal: boolean;
  onUpdate: () => void;
  theme: string;
}

function MatchCard({ match, teams, isFinal, onUpdate, theme }: MatchCardProps) {
  const [showEdit, setShowEdit] = useState(false);
  
  const getTeamName = (teamId?: string) => {
    if (!teamId) return 'TBD';
    return teams.find(t => t.id === teamId)?.name || 'Unknown';
  };

  const getBorderColor = () => {
    if (match.winnerId) return 'border-green-500/50';
    if (match.status === 'in_progress') return 'border-yellow-500/50';
    return theme === 'dark' ? 'border-white/10' : 'border-slate-200';
  };

  return (
    <>
      <div 
        className={`rounded-xl border-2 ${getBorderColor()} w-56 cursor-pointer transition-colors ${
          theme === 'dark'
            ? 'bg-white/5 hover:border-white/30'
            : 'bg-white shadow-sm hover:border-slate-300'
        } ${isFinal ? 'ring-2 ring-yellow-500/30' : ''}`}
        onClick={() => setShowEdit(true)}
      >
        {isFinal && (
          <div className="bg-yellow-600/20 text-yellow-400 text-xs font-medium text-center py-1 border-b border-yellow-500/30 rounded-t-lg">
            <Trophy className="w-3 h-3 inline mr-1" />
            Championship
          </div>
        )}
        
        {/* Team 1 */}
        <div className={`flex items-center justify-between p-3 ${match.winnerId === match.team1Id ? 'bg-green-500/10' : ''}`}>
          <div className="flex items-center gap-2">
            {match.winnerId === match.team1Id && <Crown className="w-4 h-4 text-yellow-400" />}
            <span className={`font-medium ${
              !match.team1Id 
                ? theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                : theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              {getTeamName(match.team1Id)}
            </span>
          </div>
          <span className={`font-bold text-lg ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            {match.team1Score ?? '-'}
          </span>
        </div>
        
        <div className={`border-t ${
          theme === 'dark' ? 'border-white/10' : 'border-slate-100'
        }`} />
        
        {/* Team 2 */}
        <div className={`flex items-center justify-between p-3 ${match.winnerId === match.team2Id ? 'bg-green-500/10' : ''}`}>
          <div className="flex items-center gap-2">
            {match.winnerId === match.team2Id && <Crown className="w-4 h-4 text-yellow-400" />}
            <span className={`font-medium ${
              !match.team2Id 
                ? theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                : theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              {getTeamName(match.team2Id)}
            </span>
          </div>
          <span className={`font-bold text-lg ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            {match.team2Score ?? '-'}
          </span>
        </div>
      </div>

      {/* Edit Match Modal */}
      {showEdit && (
        <EditMatchModal 
          match={match}
          teams={teams}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            onUpdate();
          }}
          theme={theme}
        />
      )}
    </>
  );
}

// Edit Match Modal
interface EditMatchModalProps {
  match: BracketMatch;
  teams: Team[];
  onClose: () => void;
  onSaved: () => void;
  theme: string;
}

function EditMatchModal({ match, teams, onClose, onSaved, theme }: EditMatchModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    team1Score: match.team1Score || 0,
    team2Score: match.team2Score || 0,
    status: match.status
  });

  const handleSave = async () => {
    // This would update the bracket in Firestore
    // For now, just close the modal
    setLoading(true);
    
    try {
      // TODO: Implement actual update logic
      // Would need to update the bracket document with the new match scores
      setTimeout(() => {
        onSaved();
      }, 500);
    } catch (error) {
      console.error('Error saving match:', error);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl w-full max-w-sm border ${
        theme === 'dark'
          ? 'bg-zinc-900 border-white/10'
          : 'bg-white border-slate-200 shadow-xl'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-white/10' : 'border-slate-200'
        }`}>
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>Edit Match</h2>
          <button onClick={onClose} className={`p-2 rounded-lg ${
            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
          }`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className={`font-medium ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>{teams.find(t => t.id === match.team1Id)?.name || 'TBD'}</span>
            <input
              type="number"
              min="0"
              value={formData.team1Score}
              onChange={(e) => setFormData({ ...formData, team1Score: parseInt(e.target.value) || 0 })}
              className={`w-20 rounded-xl px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white'
                  : 'bg-slate-50 border border-slate-200 text-slate-900'
              }`}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <span className={`font-medium ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>{teams.find(t => t.id === match.team2Id)?.name || 'TBD'}</span>
            <input
              type="number"
              min="0"
              value={formData.team2Score}
              onChange={(e) => setFormData({ ...formData, team2Score: parseInt(e.target.value) || 0 })}
              className={`w-20 rounded-xl px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white'
                  : 'bg-slate-50 border border-slate-200 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className={`w-full rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white'
                  : 'bg-slate-50 border border-slate-200 text-slate-900'
              }`}
            >
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 transition-colors ${
                theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 px-4 py-2 rounded-xl font-medium text-white transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Create Bracket Modal
interface CreateBracketModalProps {
  seasonId: string;
  leagueId: string;
  teams: Team[];
  onClose: () => void;
  onCreated: () => void;
  theme: string;
}

function CreateBracketModal({ seasonId, leagueId, teams, onClose, onCreated, theme }: CreateBracketModalProps) {
  const [loading, setLoading] = useState(false);
  const [bracketSize, setBracketSize] = useState(4);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [bracketName, setBracketName] = useState('Playoffs');

  const handleCreate = async () => {
    if (selectedTeams.length < 2) return;
    
    setLoading(true);

    try {
      // Generate matches based on bracket size
      const rounds = Math.ceil(Math.log2(bracketSize));
      const matches: BracketMatch[] = [];
      
      let matchId = 1;
      for (let round = 1; round <= rounds; round++) {
        const matchesInRound = Math.pow(2, rounds - round);
        for (let pos = 1; pos <= matchesInRound; pos++) {
          const match: BracketMatch = {
            id: `match-${matchId}`,
            round,
            position: pos,
            status: 'pending'
          };
          
          // Assign teams to first round
          if (round === 1) {
            const teamIndex1 = (pos - 1) * 2;
            const teamIndex2 = teamIndex1 + 1;
            if (selectedTeams[teamIndex1]) match.team1Id = selectedTeams[teamIndex1];
            if (selectedTeams[teamIndex2]) match.team2Id = selectedTeams[teamIndex2];
          }
          
          matches.push(match);
          matchId++;
        }
      }

      await addDoc(collection(db, 'playoffBrackets'), {
        leagueId,
        seasonId,
        name: bracketName,
        bracketSize,
        teams: selectedTeams,
        matches,
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      onCreated();
    } catch (error) {
      console.error('Error creating bracket:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTeam = (teamId: string) => {
    if (selectedTeams.includes(teamId)) {
      setSelectedTeams(selectedTeams.filter(id => id !== teamId));
    } else if (selectedTeams.length < bracketSize) {
      setSelectedTeams([...selectedTeams, teamId]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl w-full max-w-lg border max-h-[90vh] overflow-y-auto ${
        theme === 'dark'
          ? 'bg-zinc-900 border-white/10'
          : 'bg-white border-slate-200 shadow-xl'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b sticky top-0 ${
          theme === 'dark' 
            ? 'border-white/10 bg-zinc-900' 
            : 'border-slate-200 bg-white'
        }`}>
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>Create Playoff Bracket</h2>
          <button onClick={onClose} className={`p-2 rounded-lg ${
            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
          }`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Bracket Name
            </label>
            <input
              type="text"
              value={bracketName}
              onChange={(e) => setBracketName(e.target.value)}
              className={`w-full rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white'
                  : 'bg-slate-50 border border-slate-200 text-slate-900'
              }`}
              placeholder="e.g., Fall 2024 Playoffs"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Bracket Size
            </label>
            <div className="flex gap-2">
              {[4, 8, 16].map(size => (
                <button
                  key={size}
                  onClick={() => {
                    setBracketSize(size);
                    setSelectedTeams(selectedTeams.slice(0, size));
                  }}
                  className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
                    bracketSize === size 
                      ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white' 
                      : theme === 'dark'
                        ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {size} Teams
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Select Teams ({selectedTeams.length}/{bracketSize})
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {teams.map(team => {
                const isSelected = selectedTeams.includes(team.id);
                const seedNumber = selectedTeams.indexOf(team.id) + 1;
                
                return (
                  <button
                    key={team.id}
                    onClick={() => toggleTeam(team.id)}
                    disabled={!isSelected && selectedTeams.length >= bracketSize}
                    className={`flex items-center gap-2 p-2 rounded-xl text-left text-sm transition-colors ${
                      isSelected 
                        ? 'bg-purple-600/20 border border-purple-500' 
                        : theme === 'dark'
                          ? 'bg-white/5 border border-white/10 hover:border-white/20 disabled:opacity-50'
                          : 'bg-slate-50 border border-slate-200 hover:border-slate-300 disabled:opacity-50'
                    }`}
                  >
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white">
                        {seedNumber}
                      </span>
                    )}
                    <span className={`flex-1 truncate ${
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}>{team.name}</span>
                  </button>
                );
              })}
            </div>
            <p className={`text-xs mt-2 ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
            }`}>
              Selection order determines seeding (1st selected = #1 seed)
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 transition-colors ${
                theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || selectedTeams.length < 2}
              className="flex items-center gap-2 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 disabled:opacity-50 px-4 py-2 rounded-xl font-medium text-white transition-all shadow-lg shadow-yellow-500/25"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
              Create Bracket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
