/**
 * Commissioner Team Detail Component
 * Detailed view and management of a single team
 */

import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
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
  const { userData } = useAuth();
  const navigate = useNavigate();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [coaches, setCoaches] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLinkCheerModal, setShowLinkCheerModal] = useState(false);
  const [linkedCheerTeam, setLinkedCheerTeam] = useState<Team | null>(null);

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
        
      } catch (error) {
        console.error('Error loading team data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeamData();
  }, [teamId, userData?.programId, navigate]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Team Not Found</h2>
          <Link to="/commissioner/teams" className="text-purple-400 hover:text-purple-300">
            Back to Teams
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-20">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/commissioner" className="text-gray-400 hover:text-white">
                <Shield className="w-5 h-5" />
              </Link>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <Link to="/commissioner/teams" className="text-gray-400 hover:text-white">
                Teams
              </Link>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <h1 className="text-xl font-bold text-white">{team.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/commissioner/teams/${teamId}/edit`}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Edit2 className="w-5 h-5 text-gray-400" />
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 bg-gray-700 hover:bg-red-600/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5 text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Team Header Card */}
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-6">
            <div 
              className="w-20 h-20 rounded-xl flex items-center justify-center text-white text-3xl font-bold flex-shrink-0"
              style={{ backgroundColor: team.color || '#6366f1' }}
            >
              {team.name?.charAt(0) || 'T'}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">{team.name}</h2>
              <div className="flex items-center gap-4 mt-2 text-gray-400">
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
                <p className="text-2xl font-bold text-white">{players.length}</p>
                <p className="text-sm text-gray-400">Players</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{coaches.length}</p>
                <p className="text-sm text-gray-400">Coaches</p>
              </div>
            </div>
          </div>
        </div>

        {/* Linked Cheer Team */}
        {linkedCheerTeam ? (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link2 className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm text-purple-400">Linked Cheer Team</p>
                <p className="text-white font-medium">{linkedCheerTeam.name}</p>
              </div>
            </div>
            <Link
              to={`/commissioner/teams/${linkedCheerTeam.id}`}
              className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              View Team <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : !team.isCheerTeam && (
          <button
            onClick={() => setShowLinkCheerModal(true)}
            className="w-full bg-gray-800 hover:bg-gray-750 border border-dashed border-gray-600 hover:border-purple-500/50 rounded-xl p-4 flex items-center justify-center gap-2 transition-all text-gray-400 hover:text-purple-400"
          >
            <Link2 className="w-5 h-5" />
            Link Cheer Team
          </button>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coaches Section */}
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-green-400" />
                Coaches ({coaches.length})
              </h3>
              <Link
                to={`/commissioner/teams/${teamId}/assign-coach`}
                className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <UserPlus className="w-4 h-4" />
                Assign
              </Link>
            </div>
            
            {coaches.length === 0 ? (
              <div className="p-8 text-center">
                <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">No coaches assigned yet</p>
                <Link
                  to={`/commissioner/teams/${teamId}/assign-coach`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign Coach
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {coaches.map((coach) => (
                  <div key={coach.uid} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{coach.name}</p>
                        <p className="text-sm text-gray-400">{coach.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {coach.phone && (
                        <a href={`tel:${coach.phone}`} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                          <Phone className="w-4 h-4 text-gray-400" />
                        </a>
                      )}
                      <a href={`mailto:${coach.email}`} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                        <Mail className="w-4 h-4 text-gray-400" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Players Section */}
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Roster ({players.length}{team.maxRosterSize ? `/${team.maxRosterSize}` : ''})
              </h3>
              <Link
                to={`/commissioner/teams/${teamId}/roster`}
                className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                Manage <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            {players.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No players on roster yet</p>
                <p className="text-sm text-gray-500 mt-1">Coaches can add players to the roster</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
                {players.slice(0, 10).map((player) => (
                  <div key={player.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-sm font-medium text-blue-400">
                        {player.jerseyNumber || '-'}
                      </div>
                      <div>
                        <p className="text-white font-medium">{player.name}</p>
                        <p className="text-xs text-gray-400">{player.position || 'No position'}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {players.length > 10 && (
                  <div className="px-4 py-3 text-center">
                    <Link
                      to={`/commissioner/teams/${teamId}/roster`}
                      className="text-sm text-purple-400 hover:text-purple-300"
                    >
                      View all {players.length} players
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Team?</h3>
                <p className="text-sm text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete <strong>{team.name}</strong>? All players, stats, and team data will be permanently removed.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
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
    </div>
  );
};

export default CommissionerTeamDetail;
