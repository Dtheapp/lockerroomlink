/**
 * Commissioner Team Detail Component
 * Detailed view and management of a single team
 */

import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  updateDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Team, Player, UserProfile } from '../../types';
import TeamManagersPanel from './TeamManagersPanel';
import { 
  Shield, 
  ChevronRight, 
  Users, 
  Loader2, 
  User,
  UserPlus,
  Settings,
  Trash2,
  Edit2,
  Mail,
  Phone,
  Link2,
  AlertTriangle,
  CheckCircle2,
  X
} from 'lucide-react';

export const CommissionerTeamDetail: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const { userData, user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [coaches, setCoaches] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLinkCheerModal, setShowLinkCheerModal] = useState(false);
  const [linkedCheerTeam, setLinkedCheerTeam] = useState<Team | null>(null);
  const [availableCheerTeams, setAvailableCheerTeams] = useState<Team[]>([]);
  const [linkingCheerTeam, setLinkingCheerTeam] = useState(false);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }

    const loadTeamData = async () => {
      try {
        // Load team
        const teamDoc = await getDoc(doc(db, 'teams', teamId));
        if (!teamDoc.exists()) {
          navigate('/commissioner/teams');
          return;
        }
        const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
        setTeam(teamData);
        
        // Check program ownership
        if (teamData.programId !== userData?.programId) {
          navigate('/commissioner/teams');
          return;
        }
        
        // Load players
        const playersSnap = await getDocs(collection(db, 'teams', teamId, 'players'));
        setPlayers(playersSnap.docs.map(doc => ({ id: doc.id, teamId, ...doc.data() } as Player)));
        
        // Load coaches assigned to this team
        const coachesQuery = query(
          collection(db, 'users'),
          where('teamIds', 'array-contains', teamId)
        );
        const coachesSnap = await getDocs(coachesQuery);
        setCoaches(coachesSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
        
        // Load linked cheer team if exists
        if (teamData.linkedCheerTeamId) {
          const cheerDoc = await getDoc(doc(db, 'teams', teamData.linkedCheerTeamId));
          if (cheerDoc.exists()) {
            setLinkedCheerTeam({ id: cheerDoc.id, ...cheerDoc.data() } as Team);
          }
        }
        
        // Load available cheer teams for linking (only if this is NOT a cheer team)
        if (!teamData.isCheerTeam && user?.uid) {
          const cheerQuery = query(
            collection(db, 'teams'),
            where('ownerId', '==', user.uid),
            where('isCheerTeam', '==', true)
          );
          const cheerSnap = await getDocs(cheerQuery);
          const cheerTeams = cheerSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Team))
            .filter(t => !t.linkedToTeamId); // Only unlinked cheer teams
          setAvailableCheerTeams(cheerTeams);
        }
        
      } catch (error) {
        console.error('Error loading team data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeamData();
  }, [teamId, userData?.programId, user?.uid, navigate]);

  const handleDeleteTeam = async () => {
    if (!teamId) return;
    setDeleting(true);
    
    try {
      await deleteDoc(doc(db, 'teams', teamId));
      navigate('/commissioner/teams');
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Failed to delete team. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleLinkCheerTeam = async (cheerTeamId: string) => {
    if (!teamId || !team) return;
    setLinkingCheerTeam(true);
    
    try {
      // Update this sport team to link to cheer team
      await updateDoc(doc(db, 'teams', teamId), {
        linkedCheerTeamId: cheerTeamId,
        updatedAt: serverTimestamp()
      });
      
      // Update the cheer team to link back to this sport team
      await updateDoc(doc(db, 'teams', cheerTeamId), {
        linkedToTeamId: teamId,
        linkedToTeamName: team.name,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      const linkedTeam = availableCheerTeams.find(t => t.id === cheerTeamId);
      if (linkedTeam) {
        setLinkedCheerTeam(linkedTeam);
        setAvailableCheerTeams(prev => prev.filter(t => t.id !== cheerTeamId));
      }
      
      setShowLinkCheerModal(false);
    } catch (error) {
      console.error('Error linking cheer team:', error);
      alert('Failed to link cheer team. Please try again.');
    } finally {
      setLinkingCheerTeam(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Team Not Found</h2>
          <Link to="/commissioner/teams" className="text-purple-500 hover:text-purple-400">
            Back to Teams
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-20 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/commissioner" className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
                <Shield className="w-5 h-5" />
              </Link>
              <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
              <Link to="/commissioner/teams" className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}>
                Teams
              </Link>
              <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
              <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{team.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/commissioner/teams/${teamId}/edit`}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                <Edit2 className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-red-600/20' : 'bg-gray-100 hover:bg-red-50'}`}
              >
                <Trash2 className="w-5 h-5 text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Team Header Card */}
        <div className={`rounded-xl p-4 sm:p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center text-white text-2xl sm:text-3xl font-bold flex-shrink-0"
              style={{ backgroundColor: team.color || '#6366f1' }}
            >
              {team.name?.charAt(0) || 'T'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className={`text-xl sm:text-2xl font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{team.name}</h2>
              <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                <span>{team.sport}</span>
                <span>•</span>
                <span>{team.ageGroup || 'No age group'}</span>
                {team.maxRosterSize && (
                  <>
                    <span>•</span>
                    <span>Max {team.maxRosterSize} players</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="hidden md:flex items-center gap-6">
              <div className="text-center">
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{players.length}</p>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Players</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{coaches.length}</p>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Coaches</p>
              </div>
            </div>
          </div>
        </div>

        {/* Linked Cheer Team */}
        {linkedCheerTeam ? (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link2 className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-purple-500">Linked Cheer Team</p>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{linkedCheerTeam.name}</p>
              </div>
            </div>
            <Link
              to={`/commissioner/teams/${linkedCheerTeam.id}`}
              className="text-sm text-purple-500 hover:text-purple-400 flex items-center gap-1"
            >
              View Team <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : !team.isCheerTeam && (
          <button
            onClick={() => setShowLinkCheerModal(true)}
            className={`w-full rounded-xl p-4 flex items-center justify-center gap-2 transition-all border border-dashed ${
              theme === 'dark' 
                ? 'bg-gray-800 hover:bg-gray-750 border-gray-600 hover:border-purple-500/50 text-gray-400 hover:text-purple-400' 
                : 'bg-white hover:bg-gray-50 border-gray-300 hover:border-purple-400 text-gray-500 hover:text-purple-500'
            }`}
          >
            <Link2 className="w-5 h-5" />
            Link Cheer Team
          </button>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coaches Section */}
          <div className={`rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
            <div className={`px-4 py-3 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <User className="w-5 h-5 text-green-400" />
                Coaches ({coaches.length})
              </h3>
              <Link
                to={`/commissioner/teams/${teamId}/assign-coach`}
                className="text-sm text-purple-500 hover:text-purple-400 flex items-center gap-1"
              >
                <UserPlus className="w-4 h-4" />
                Assign
              </Link>
            </div>
            
            {coaches.length === 0 ? (
              <div className="p-8 text-center">
                <User className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
                <p className={`mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>No coaches assigned yet</p>
                <Link
                  to={`/commissioner/teams/${teamId}/assign-coach`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign Coach
                </Link>
              </div>
            ) : (
              <div className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {coaches.map((coach) => (
                  <div key={coach.uid} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{coach.name}</p>
                        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{coach.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {coach.phone && (
                        <a href={`tel:${coach.phone}`} className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                          <Phone className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
                        </a>
                      )}
                      <a href={`mailto:${coach.email}`} className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        <Mail className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Players Section */}
          <div className={`rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
            <div className={`px-4 py-3 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <Users className="w-5 h-5 text-blue-400" />
                Roster ({players.length}{team.maxRosterSize ? `/${team.maxRosterSize}` : ''})
              </h3>
              <Link
                to={`/commissioner/teams/${teamId}/roster`}
                className="text-sm text-purple-500 hover:text-purple-400 flex items-center gap-1"
              >
                Manage <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            {players.length === 0 ? (
              <div className="p-8 text-center">
                <Users className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>No players on roster yet</p>
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>Coaches can add players to the roster</p>
              </div>
            ) : (
              <div className={`divide-y max-h-96 overflow-y-auto ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {players.slice(0, 10).map((player) => (
                  <div key={player.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-sm font-medium text-blue-400">
                        {player.jerseyNumber || '-'}
                      </div>
                      <div>
                        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{player.name}</p>
                        <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{player.position || 'No position'}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {players.length > 10 && (
                  <div className="px-4 py-3 text-center">
                    <Link
                      to={`/commissioner/teams/${teamId}/roster`}
                      className="text-sm text-purple-500 hover:text-purple-400"
                    >
                      View all {players.length} players
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Team Managers Section */}
        {teamId && user?.uid && team && (
          <TeamManagersPanel teamId={teamId} teamName={team.name} />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl p-6 max-w-md w-full ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Delete Team?</h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>This action cannot be undone</p>
              </div>
            </div>
            
            <p className={`mb-6 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Are you sure you want to delete <strong>{team.name}</strong>? All players, stats, and team data will be permanently removed.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={`flex-1 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTeam}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Cheer Team Modal */}
      {showLinkCheerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-purple-500" />
                </div>
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Link Cheer Team</h3>
              </div>
              <button
                onClick={() => setShowLinkCheerModal(false)}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <X className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
              </button>
            </div>
            
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Select a cheer team to link to "{team.name}". This creates a two-way connection.
            </p>
            
            {availableCheerTeams.length === 0 ? (
              <div className="text-center py-8">
                <Users className={`w-12 h-12 mx-auto mb-3 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>No cheer teams available</p>
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                  Create a cheer team first, then you can link it here.
                </p>
                <Link
                  to="/commissioner/teams/create"
                  onClick={() => setShowLinkCheerModal(false)}
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                >
                  Create Cheer Team
                </Link>
              </div>
            ) : (
              <div className={`flex-1 overflow-y-auto space-y-2 ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {availableCheerTeams.map((cheerTeam) => (
                  <button
                    key={cheerTeam.id}
                    onClick={() => handleLinkCheerTeam(cheerTeam.id!)}
                    disabled={linkingCheerTeam}
                    className={`w-full p-4 rounded-lg text-left flex items-center gap-3 transition-all ${
                      theme === 'dark' 
                        ? 'bg-gray-700/50 hover:bg-purple-500/20 border border-gray-600 hover:border-purple-500/50' 
                        : 'bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-400'
                    } ${linkingCheerTeam ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{ backgroundColor: cheerTeam.color || '#ec4899' }}
                    >
                      {cheerTeam.name?.charAt(0) || 'C'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{cheerTeam.name}</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {cheerTeam.ageGroup || 'No age group'}
                      </p>
                    </div>
                    {linkingCheerTeam ? (
                      <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                    ) : (
                      <CheckCircle2 className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionerTeamDetail;
